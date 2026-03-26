"""
PyReason-backed course recommendation status inference.

This script reads a JSON payload from stdin, converts the payload into a small
graph + fact set for PyReason, runs the rule engine, and writes inferred status
labels back to stdout as JSON.

The surrounding Next.js app intentionally treats this script as a narrow
reasoning service. Schedule generation remains in the existing TypeScript
frontend and only consumes the ranked recommendations produced downstream.
"""

from __future__ import annotations

import json
import sys
import io
import contextlib
import os
from typing import Dict, Iterable, List, Tuple

# Work around a Numba cache locator issue that can occur when importing
# cache-enabled packages from user site-packages on local developer machines.
sys.frozen = True


def emit_error(message: str, code: int = 1) -> None:
    """Emit a structured error so the caller can fall back cleanly."""
    sys.stderr.write(message + "\n")
    raise SystemExit(code)


def load_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        emit_error("No PyReason payload was provided on stdin")
    return json.loads(raw)


def is_debug_enabled(payload: dict) -> bool:
    """Enable verbose trace output when debugging PyReason locally."""
    return os.environ.get("PYREASON_DEBUG") == "1" or bool(payload.get("debug"))


def summarize_facts(payload: dict) -> Dict[str, int]:
    """Return fact counts so we can quickly verify the payload shape."""
    return {
        key: len(value) if isinstance(value, list) else 0
        for key, value in payload.get("facts", {}).items()
    }


def _safe_import_pyreason():
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            import networkx as nx
            import pyreason as pr

        return nx, pr
    except Exception as exc:  # pragma: no cover - exercised in runtime fallback
        emit_error(f"PyReason import failed: {exc}")


def build_graph(nx_module, payload: dict):
    """Create the graph that PyReason reasons over."""
    graph = nx_module.DiGraph()

    student_id = payload["studentId"]
    graph.add_node(student_id)
    graph.add_node(payload["term"])

    for candidate in payload.get("candidateCourses", []):
        graph.add_node(candidate["courseCode"])

    for fact in payload["facts"].get("neededForStudent", []):
        graph.add_node(fact["requirement"])
        graph.add_edge(fact["student"], fact["requirement"], needed_for_student=1)

    for fact in payload["facts"].get("countsForRequirement", []):
        graph.add_node(fact["requirement"])
        graph.add_edge(fact["course"], fact["requirement"], counts_for_requirement=1)

    edge_fact_mappings = {
        "passed": ("student", "course", "passed"),
        "failed": ("student", "course", "failed"),
        "inProgress": ("student", "course", "in_progress"),
        "notPassed": ("student", "course", "not_passed"),
        "targetCourse": ("student", "course", "target_course"),
        "offeredIn": ("course", "term", "offered_in"),
        "notOfferedIn": ("course", "term", "not_offered_in"),
        "requires": ("course", "prerequisite", "requires"),
        "corequires": ("course", "corequisite", "corequires"),
        "allPrereqsSatisfied": ("student", "course", "all_prereqs_satisfied"),
        "allCoreqsSatisfied": ("student", "course", "all_coreqs_satisfied"),
        "unlocks": ("course", "unlockedCourse", "unlocks"),
        "candidateBottleneck": ("student", "course", "candidate_bottleneck"),
    }

    for fact_key, (source_key, target_key, attribute_name) in edge_fact_mappings.items():
        for fact in payload["facts"].get(fact_key, []):
            graph.add_node(fact[source_key])
            graph.add_node(fact[target_key])
            graph.add_edge(fact[source_key], fact[target_key], **{attribute_name: 1})

    graph.nodes[payload["term"]]["current_term"] = 1
    return graph


def configure_pyreason(pr, graph) -> None:
    """Load graph and rules into PyReason."""
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        pr.reset()
        pr.load_graph(graph)

    rules = [
        ("prereqs_ready(s,c) <-1 target_course(s,c), all_prereqs_satisfied(s,c)", "prereqs_ready_rule"),
        ("coreqs_ready(s,c) <-1 target_course(s,c), all_coreqs_satisfied(s,c)", "coreqs_ready_rule"),
        ("missing_prereq(s,c) <-1 target_course(s,c), requires(c,p), not_passed(s,p)", "missing_prereq_rule"),
        ("missing_coreq(s,c) <-1 target_course(s,c), corequires(c,p), not_passed(s,p)", "missing_coreq_rule"),
        ("offered_this_term(s,c) <-1 target_course(s,c), offered_in(c,t), current_term(t)", "offered_this_term_rule"),
        ("not_offered_now(s,c) <-1 target_course(s,c), not_offered_in(c,t), current_term(t)", "not_offered_now_rule"),
        ("satisfies_needed_requirement(s,c) <-1 target_course(s,c), counts_for_requirement(c,r), needed_for_student(s,r)", "needed_requirement_rule"),
        ("unlocks_future_courses(s,c) <-1 target_course(s,c), unlocks(c,n)", "unlocks_rule"),
        ("bottleneck_course(s,c) <-1 target_course(s,c), candidate_bottleneck(s,c)", "bottleneck_rule"),
        ("eligible_now(s,c) <-1 prereqs_ready(s,c), coreqs_ready(s,c), offered_this_term(s,c)", "eligible_now_rule"),
        ("blocked(s,c) <-1 missing_prereq(s,c)", "blocked_prereq_rule"),
        ("blocked(s,c) <-1 missing_coreq(s,c)", "blocked_coreq_rule"),
        ("blocked(s,c) <-1 not_offered_now(s,c)", "blocked_offering_rule"),
        ("high_priority(s,c) <-1 eligible_now(s,c), satisfies_needed_requirement(s,c), bottleneck_course(s,c)", "high_priority_bottleneck_rule"),
        ("high_priority(s,c) <-1 eligible_now(s,c), satisfies_needed_requirement(s,c), unlocks_future_courses(s,c)", "high_priority_unlock_rule"),
        ("recommended(s,c) <-1 eligible_now(s,c), satisfies_needed_requirement(s,c)", "recommended_requirement_rule"),
        ("recommended(s,c) <-1 eligible_now(s,c), high_priority(s,c)", "recommended_priority_rule"),
    ]

    for rule_text, rule_name in rules:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            pr.add_rule(pr.Rule(rule_text, rule_name))

    return rules


def dataframe_to_pairs(frame) -> List[Tuple[str, str]]:
    """
    Convert a PyReason edge dataframe into (source, target) pairs.

    The exact dataframe column names vary slightly by version, so we search
    several likely column names defensively.
    """
    if frame is None or getattr(frame, "empty", True):
        return []

    columns = {str(column).lower(): column for column in frame.columns}

    component_column = next(
        (
            columns[name]
            for name in ("component", "components")
            if name in columns
        ),
        None,
    )

    if component_column is not None:
        pairs: List[Tuple[str, str]] = []
        for _, row in frame.iterrows():
            component = row[component_column]
            if isinstance(component, (list, tuple)) and len(component) >= 2:
                pairs.append((str(component[0]), str(component[1])))
        return pairs

    source_column = next(
        (
            columns[name]
            for name in ("source", "component1", "component_1", "u", "from")
            if name in columns
        ),
        None,
    )
    target_column = next(
        (
            columns[name]
            for name in ("target", "component2", "component_2", "v", "to")
            if name in columns
        ),
        None,
    )

    if source_column is None or target_column is None:
        return []

    pairs: List[Tuple[str, str]] = []
    for _, row in frame.iterrows():
        pairs.append((str(row[source_column]), str(row[target_column])))

    return pairs


def extract_edge_labels(pr, interpretation, labels: Iterable[str]) -> Dict[str, List[Tuple[str, str]]]:
    """Read inferred edge labels back out of PyReason."""
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        dataframes = pr.filter_and_sort_edges(interpretation, list(labels))
    label_map: Dict[str, List[Tuple[str, str]]] = {}

    for label, frame in zip(labels, dataframes):
        label_map[label] = dataframe_to_pairs(frame)

    return label_map


def summarize_label_frames(pr, interpretation, labels: Iterable[str]) -> Dict[str, dict]:
    """
    Capture raw dataframe metadata for debugging.

    This makes it much easier to see whether PyReason is inferring labels but
    the extraction logic is mismatched to the installed version's dataframe
    shape.
    """
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        dataframes = pr.filter_and_sort_edges(interpretation, list(labels))

    summaries: Dict[str, dict] = {}
    for label, frame in zip(labels, dataframes):
        if frame is None:
            summaries[label] = {"empty": True, "columns": [], "preview": []}
            continue

        preview_rows = []
        if not getattr(frame, "empty", True):
            preview_rows = frame.head(5).to_dict("records")

        summaries[label] = {
            "empty": bool(getattr(frame, "empty", True)),
            "columns": [str(column) for column in getattr(frame, "columns", [])],
            "preview": preview_rows,
        }

    return summaries


def build_results(payload: dict, label_map: Dict[str, List[Tuple[str, str]]]) -> List[dict]:
    """Build per-course status flags from inferred edge labels."""
    student_id = payload["studentId"]
    by_label = {label: set(pairs) for label, pairs in label_map.items()}
    results = []

    for candidate in payload.get("candidateCourses", []):
        course_code = candidate["courseCode"]

        def has(label: str) -> bool:
            return (student_id, course_code) in by_label.get(label, set())

        flags = {
            "eligible_now": has("eligible_now"),
            "blocked": has("blocked"),
            "missing_prereq": has("missing_prereq"),
            "missing_coreq": has("missing_coreq"),
            "offered_this_term": has("offered_this_term"),
            "not_offered_now": has("not_offered_now"),
            "satisfies_needed_requirement": has("satisfies_needed_requirement"),
            "high_priority": has("high_priority"),
            "bottleneck_course": has("bottleneck_course"),
            "unlocks_future_courses": has("unlocks_future_courses"),
            "recommended": has("recommended"),
        }

        raw_labels = [label for label, present in flags.items() if present]
        results.append(
            {
                "courseCode": course_code,
                "flags": flags,
                "rawLabels": raw_labels,
            }
        )

    return results


def main() -> None:
    payload = load_payload()
    debug_enabled = is_debug_enabled(payload)
    nx_module, pr = _safe_import_pyreason()
    graph = build_graph(nx_module, payload)
    rules = configure_pyreason(pr, graph)

    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        interpretation = pr.reason(timesteps=4)
    labels = [
        "eligible_now",
        "blocked",
        "missing_prereq",
        "missing_coreq",
        "offered_this_term",
        "not_offered_now",
        "satisfies_needed_requirement",
        "high_priority",
        "bottleneck_course",
        "unlocks_future_courses",
        "recommended",
    ]
    label_map = extract_edge_labels(pr, interpretation, labels)

    output = {
        "results": build_results(payload, label_map),
        "rawTrace": {
            "labels": {label: len(pairs) for label, pairs in label_map.items()},
        },
    }

    if debug_enabled:
        output["rawTrace"]["debug"] = {
            "factCounts": summarize_facts(payload),
            "rules": [{"name": name, "text": text} for text, name in rules],
            "interpretationType": str(type(interpretation)),
            "labelFrames": summarize_label_frames(pr, interpretation, labels),
            "candidateCourses": [course["courseCode"] for course in payload.get("candidateCourses", [])],
        }

    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    main()

import type { CourseData } from "./types";

type AlertLevel = "critical" | "warning" | "on_track";

export interface AdvisorAlert {
  id: string;
  title: string;
  level: AlertLevel;
  detail: string;
  nextAction: string;
}

const GRADE_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  "D-": 0.7,
  F: 0.0,
};

const CS_CORE = [
  "CIS 252",
  "CIS 341",
  "CIS 351",
  "CIS 352",
  "CSE 384",
  "CIS 375",
  "CIS 453",
  "CIS 454",
  "CIS 473",
  "CIS 477",
  "CSE 486",
];

const WRITING_REQUIRED = ["WRT 105", "WRT 205"];
const PRESENTATIONAL_OPTIONS = ["CRS 225", "CRS 325", "IST 344"];

/** Courses counted toward ECS / Math / Science GPA in the advisor reference (subset; confirm with catalog). */
const ECS_MATH_SCIENCE_GPA_CODES = [
  "ECS 101",
  "CIS 151",
  "MAT 295",
  "MAT 296",
  "MAT 397",
  "MAT 331",
  "CIS 321",
  "PHY 211",
  "CHE 106",
];
const MATH_REQUIRED_GROUPS = [
  ["MAT 295"],
  ["MAT 296"],
  ["MAT 397", "MAT 331"],
  ["CIS 321"],
];
/** Natural sciences (8 cr): PHY 211 + CHE 106 per CS BS reference in app data. */
const SCIENCE_REQUIRED = ["PHY 211", "CHE 106"];

function normalizeCode(code?: string) {
  return (code || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function parseCredits(credits?: string) {
  const n = Number.parseFloat(credits || "");
  return Number.isFinite(n) ? n : 0;
}

function isCompletedGrade(grade?: string) {
  const g = (grade || "").toUpperCase();
  return g !== "" && g !== "IP" && g !== "WD" && g !== "F";
}

function isAtLeastCMinus(grade?: string) {
  const g = (grade || "").toUpperCase();
  if (!GRADE_POINTS[g] && GRADE_POINTS[g] !== 0) return false;
  return GRADE_POINTS[g] >= GRADE_POINTS["C-"];
}

export function evaluateCsGraduationReadiness(courses: CourseData[]): AdvisorAlert[] {
  const completedByCode = new Map<string, CourseData[]>();

  courses.forEach((c) => {
    const code = normalizeCode(c.code);
    if (!code) return;
    if (!completedByCode.has(code)) completedByCode.set(code, []);
    completedByCode.get(code)?.push(c);
  });

  const hasCompleted = (code: string) =>
    (completedByCode.get(normalizeCode(code)) || []).some((c) => isCompletedGrade(c.grade));

  const alerts: AdvisorAlert[] = [];

  // 1) CS core completion coverage
  const missingCore = CS_CORE.filter((code) => !hasCompleted(code));
  alerts.push({
    id: "core-coverage",
    title: "Computer Science Core Coverage",
    level: missingCore.length >= 5 ? "critical" : missingCore.length > 0 ? "warning" : "on_track",
    detail:
      missingCore.length > 0
        ? `Missing ${missingCore.length} CS core course(s): ${missingCore.slice(0, 5).join(", ")}${missingCore.length > 5 ? "..." : ""}`
        : "All listed CS core courses are completed.",
    nextAction:
      missingCore.length > 0
        ? "Prioritize missing core courses in upcoming terms, especially prerequisites for senior-level sequence."
        : "Keep monitoring core GPA and upper-division progress.",
  });

  // 2) Writing requirements
  const missingWriting = WRITING_REQUIRED.filter((code) => !hasCompleted(code));
  alerts.push({
    id: "writing",
    title: "Writing Requirement (WRT 105, WRT 205)",
    level: missingWriting.length === 2 ? "critical" : missingWriting.length > 0 ? "warning" : "on_track",
    detail:
      missingWriting.length > 0
        ? `Missing writing course(s): ${missingWriting.join(", ")}`
        : "Both required writing courses are completed.",
    nextAction:
      missingWriting.length > 0
        ? "Plan missing writing course(s) in the next available term."
        : "No action needed.",
  });

  // 3) Presentational skills (one of three)
  const hasPresentational = PRESENTATIONAL_OPTIONS.some((code) => hasCompleted(code));
  alerts.push({
    id: "presentational",
    title: "Presentational Skills Requirement",
    level: hasPresentational ? "on_track" : "warning",
    detail: hasPresentational
      ? "Presentational skills requirement is satisfied."
      : `No presentational course found (choose one: ${PRESENTATIONAL_OPTIONS.join(", ")}).`,
    nextAction: hasPresentational
      ? "No action needed."
      : "Recommend IST 344 (or CRS 225 / CRS 325) for requirement completion.",
  });

  // 4) Math chain completion
  const missingMathGroups = MATH_REQUIRED_GROUPS.filter((group) => !group.some((code) => hasCompleted(code)));
  alerts.push({
    id: "math-chain",
    title: "Mathematics Section Progress",
    level: missingMathGroups.length >= 2 ? "critical" : missingMathGroups.length > 0 ? "warning" : "on_track",
    detail:
      missingMathGroups.length > 0
        ? `Missing math requirement group(s): ${missingMathGroups.map((g) => g.join(" or ")).join("; ")}`
        : "Math section requirements are covered.",
    nextAction:
      missingMathGroups.length > 0
        ? "Schedule remaining math course(s) before upper-level CS bottlenecks."
        : "No action needed.",
  });

  // 5) Science sequence completion
  const missingScience = SCIENCE_REQUIRED.filter((code) => !hasCompleted(code));
  const scienceLevel: AlertLevel = missingScience.length > 0 ? "critical" : "on_track";
  alerts.push({
    id: "science-sequence",
    title: "Natural Sciences (PHY 211 + CHE 106)",
    level: scienceLevel,
    detail:
      missingScience.length > 0
        ? `Missing natural science course(s): ${missingScience.join(", ")}`
        : "PHY 211 and CHE 106 are both completed.",
    nextAction:
      scienceLevel === "on_track"
        ? "No action needed."
        : "Schedule remaining natural science course(s) to reach 8 credits in this track.",
  });

  // 6) Grade policy checks: below C- in required areas
  const requiredForCMinusPolicy = [
    ...WRITING_REQUIRED,
    ...CS_CORE,
    "MAT 295",
    "MAT 296",
    "MAT 397",
    "MAT 331",
    "CIS 321",
    "ECS 101",
    "CIS 151",
    "PHY 211",
    "CHE 106",
    "IST 344",
    "ECS 392",
  ];
  const belowCMinus = new Set<string>();
  requiredForCMinusPolicy.forEach((code) => {
    const entries = completedByCode.get(normalizeCode(code)) || [];
    entries.forEach((c) => {
      if (isCompletedGrade(c.grade) && !isAtLeastCMinus(c.grade)) {
        belowCMinus.add(code);
      }
    });
  });
  alerts.push({
    id: "min-grade-policy",
    title: "Minimum Grade Policy (C- or better)",
    level: belowCMinus.size > 0 ? "critical" : "on_track",
    detail:
      belowCMinus.size > 0
        ? `Course(s) below C- in required areas: ${Array.from(belowCMinus).join(", ")}`
        : "No detected violations of C- minimum in tracked required courses.",
    nextAction:
      belowCMinus.size > 0
        ? "Discuss retake planning for courses below C- that are in required sections."
        : "No action needed.",
  });

  // 7) Core GPA (B- minimum target for CS core)
  let totalCorePoints = 0;
  let totalCoreCredits = 0;
  CS_CORE.forEach((code) => {
    const entries = completedByCode.get(normalizeCode(code)) || [];
    entries.forEach((c) => {
      const grade = (c.grade || "").toUpperCase();
      if (!isCompletedGrade(grade)) return;
      const points = GRADE_POINTS[grade];
      if (points === undefined) return;
      const credits = parseCredits(c.credits || "3");
      if (credits <= 0) return;
      totalCorePoints += points * credits;
      totalCoreCredits += credits;
    });
  });
  const coreGpa = totalCoreCredits > 0 ? totalCorePoints / totalCoreCredits : 0;
  let totalEmsPoints = 0;
  let totalEmsCredits = 0;
  ECS_MATH_SCIENCE_GPA_CODES.forEach((code) => {
    const entries = completedByCode.get(normalizeCode(code)) || [];
    entries.forEach((c) => {
      const grade = (c.grade || "").toUpperCase();
      if (!isCompletedGrade(grade)) return;
      const points = GRADE_POINTS[grade];
      if (points === undefined) return;
      const credits = parseCredits(c.credits || "3");
      if (credits <= 0) return;
      totalEmsPoints += points * credits;
      totalEmsCredits += credits;
    });
  });
  const emsGpa = totalEmsCredits > 0 ? totalEmsPoints / totalEmsCredits : 0;
  alerts.push({
    id: "ems-gpa",
    title: "ECS / Math / Science GPA (2.0 minimum)",
    level: totalEmsCredits === 0 ? "warning" : emsGpa < 2.0 ? "critical" : "on_track",
    detail:
      totalEmsCredits === 0
        ? "Not enough completed ECS/math/science courses in the tracked set to estimate this GPA yet."
        : `Estimated ECS/math/science GPA: ${emsGpa.toFixed(2)} (${emsGpa < 2.0 ? "below 2.0" : "meets or exceeds 2.0"}).`,
    nextAction:
      totalEmsCredits === 0
        ? "Re-evaluate as math and science courses complete."
        : emsGpa < 2.0
          ? "Discuss grade recovery options for courses in this bucket."
          : "No action needed.",
  });

  alerts.push({
    id: "core-gpa",
    title: "CS Core GPA Check (2.667 minimum)",
    level: totalCoreCredits === 0 ? "warning" : coreGpa < 2.667 ? "critical" : "on_track",
    detail:
      totalCoreCredits === 0
        ? "Not enough completed CS core courses to calculate core GPA yet."
        : `Estimated CS core GPA: ${coreGpa.toFixed(2)} (${coreGpa < 2.667 ? "below 2.667" : "meets or exceeds 2.667"}).`,
    nextAction:
      totalCoreCredits === 0
        ? "Re-evaluate once core courses are completed."
        : coreGpa < 2.667
          ? "Prioritize stronger performance in remaining core courses and consider retakes where policy allows."
          : "Maintain performance in remaining core requirements.",
  });

  return alerts;
}


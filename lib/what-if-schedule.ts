import type { SelectedCourse } from "@/lib/types";

export const ENTIRE_SCHEDULE = "__ENTIRE__" as const;

export type TermMode = typeof ENTIRE_SCHEDULE | string;

export function collectTermLabels(courses: SelectedCourse[]): string[] {
  const set = new Set<string>();
  for (const c of courses) {
    const t = (c as SelectedCourse & { term?: string }).term;
    if (t && String(t).trim()) {
      set.add(String(t).trim());
    }
  }
  return Array.from(set).sort();
}

export function sliceScheduleForTerm(courses: SelectedCourse[], termMode: TermMode): SelectedCourse[] {
  if (termMode === ENTIRE_SCHEDULE) {
    return [...courses];
  }
  return courses.filter(
    (c) => ((c as SelectedCourse & { term?: string }).term || "").trim() === termMode
  );
}

export function cloneScheduleWithNewIds(courses: SelectedCourse[]): SelectedCourse[] {
  const t = Date.now();
  return courses.map((c, i) => ({
    ...c,
    id: `whatif-${t}-${i}-${Math.random().toString(36).slice(2, 11)}`,
  }));
}

export function courseKey(c: SelectedCourse): string {
  return `${(c.Class || "").trim().toUpperCase()}::${(c.Section || "").trim().toUpperCase()}`;
}

export function diffBaselineVsScratch(
  baseline: SelectedCourse[],
  scratch: SelectedCourse[]
): { added: SelectedCourse[]; removed: SelectedCourse[] } {
  const baseKeys = new Set(baseline.map(courseKey));
  const scratchKeys = new Set(scratch.map(courseKey));

  const added = scratch.filter((s) => !baseKeys.has(courseKey(s)));
  const removed = baseline.filter((b) => !scratchKeys.has(courseKey(b)));

  return { added, removed };
}

export function mergeWhatIfApply(
  fullSchedule: SelectedCourse[],
  baselineOriginalIds: Set<string>,
  scratchRows: SelectedCourse[]
): SelectedCourse[] {
  const kept = fullSchedule.filter((c) => !baselineOriginalIds.has(c.id));
  const appliedScratch = scratchRows.map((c, i) => ({
    ...c,
    id: `course-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
  }));
  return [...kept, ...appliedScratch];
}

import type { Course } from "@/lib/types";
import { extractCourseCodesFromText } from "@/lib/recommendation/build-recommendation-payload";

export type WorkloadLevel = "low" | "medium" | "high";

export type ScheduleSlot = { alternatives: string[]; source: string };

/** One slot per requirement row; OR-rows share alternatives. */
export function requirementStringsToSlots(entries: string[]): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  for (const entry of entries) {
    const codes = extractCourseCodesFromText(entry);
    const hasOr = /\bor\b/i.test(entry);
    if (codes.length >= 2 && hasOr) {
      slots.push({ alternatives: codes, source: entry });
    } else if (codes.length === 1) {
      slots.push({ alternatives: codes, source: entry });
    } else if (codes.length > 1 && !hasOr) {
      for (const c of codes) {
        slots.push({ alternatives: [c], source: entry });
      }
    } else {
      slots.push({ alternatives: codes, source: entry });
    }
  }
  return slots;
}

export function countSchedulableSlots(slots: ScheduleSlot[]): number {
  return slots.filter((s) => s.alternatives.length > 0).length;
}

/**
 * Low workload: drop one course from this term (push to a later semester conceptually).
 * Prefers distributional / elective-like rows; otherwise drops the last slot.
 */
export function applyLowWorkloadPostpone(slots: ScheduleSlot[]): ScheduleSlot[] {
  if (slots.length <= 1) return slots;
  const deferPattern =
    /SOC|PHI|FYS|IDEA|SSH|HST|PSY|ANT|ECN|IST\s*323|IST\s*343|IST\s*359|elective|distribution|topics/i;
  let idx = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (deferPattern.test(slots[i].source)) {
      idx = i;
      break;
    }
  }
  if (idx < 0) idx = slots.length - 1;
  return slots.filter((_, i) => i !== idx);
}

const SPARSE_SEMESTER_IDS = new Set(["y3s", "y4f", "y4s"]);

export function isSparseSemesterBucket(semesterId: string, slots: ScheduleSlot[]): boolean {
  if (SPARSE_SEMESTER_IDS.has(semesterId)) return true;
  return countSchedulableSlots(slots) <= 2;
}

/** Prefer UD CIS, then SSH distribution subjects, then common free-elective IST courses. */
export function buildFillerCourseQueue(catalog: Course[]): string[] {
  const labels = [
    ...new Set(
      catalog.map((c) => String(c.Class || "").trim()).filter(Boolean)
    ),
  ];
  const out: string[] = [];
  const push = (code: string) => {
    if (!out.includes(code)) out.push(code);
  };

  const cisUd = labels
    .filter((cl) => /^CIS\s+4\d{2}/i.test(cl))
    .sort((a, b) => a.localeCompare(b));
  for (const c of cisUd) push(c);

  const ssh = labels
    .filter((cl) => /^(ECN|ANT|SOC|PSY|PHI|HST)\s+\d/i.test(cl))
    .sort((a, b) => a.localeCompare(b));
  for (const c of ssh) push(c);

  for (const c of ["IST 323", "IST 343", "IST 359", "IST 344"]) {
    if (labels.includes(c)) push(c);
  }

  return out;
}

/** ECN / ANT catalog codes only — used to fill y4f schedules when matrix rows conflict or are missing. */
export function buildEcnAntFillQueue(catalog: Course[]): string[] {
  const labels = new Set(
    catalog.map((c) => String(c.Class || "").trim()).filter(Boolean)
  );
  const out: string[] = [];
  for (const cl of [...labels].sort((a, b) => a.localeCompare(b))) {
    if (/^(ECN|ANT)\s+\d/i.test(cl)) out.push(cl);
  }
  return out;
}

export function workloadTargetCredits(workload: WorkloadLevel): number {
  const map = { low: 12, medium: 15, high: 18 } as const;
  return map[workload];
}

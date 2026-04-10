import { CS_GRADUATION_SEMESTERS } from "@/lib/cs-graduation-path";
import { normalizeAcademicYearLabel } from "@/lib/class-year";

/** Eight-term CS BS planner ids (aligned with path-to-graduation). */
export const PLAN_SEMESTER_IDS = CS_GRADUATION_SEMESTERS.map((s) => s.id) as readonly string[];
export type PlanSemesterId = (typeof PLAN_SEMESTER_IDS)[number];

export const PLAN_SEMESTER_ORDER = [...PLAN_SEMESTER_IDS];

export const PLAN_SEMESTER_OPTIONS = CS_GRADUATION_SEMESTERS.map((s) => ({
  value: s.id,
  label: s.fullLabel,
}));

const LEGACY_TO_SEMESTER: Record<string, PlanSemesterId> = {
  Freshman: "y1f",
  Sophomore: "y2f",
  Junior: "y3f",
  Senior: "y4f",
};

export function isPlanSemesterId(value: string | null | undefined): value is PlanSemesterId {
  return Boolean(value && (PLAN_SEMESTER_IDS as readonly string[]).includes(value));
}

/** True when this major uses y1f…y4s buckets (CS BS from graduation JSON). */
export function isPlanSemesterMode(requirementsForMajor: Record<string, unknown> | undefined): boolean {
  if (!requirementsForMajor) return false;
  return PLAN_SEMESTER_IDS.some((id) => Object.prototype.hasOwnProperty.call(requirementsForMajor, id));
}

/** Resolve localStorage / student label to a semester id or legacy class year string. */
export function normalizePlannerTerm(
  stored: string | null | undefined,
  academicYearLabel: string | null | undefined
): string {
  if (stored && isPlanSemesterId(stored)) return stored;
  if (stored && stored in LEGACY_TO_SEMESTER) return LEGACY_TO_SEMESTER[stored];

  const fromStudent = normalizeAcademicYearLabel(academicYearLabel);
  if (fromStudent && fromStudent in LEGACY_TO_SEMESTER) {
    return LEGACY_TO_SEMESTER[fromStudent];
  }

  return "y1f";
}

/** Ordered keys present on this major (semesters first if any semester key exists, else legacy years). */
export function orderedRequirementKeys(requirementsForMajor: Record<string, string[]> | undefined): string[] {
  if (!requirementsForMajor) return [];
  const keys = Object.keys(requirementsForMajor);
  if (keys.some((k) => isPlanSemesterId(k))) {
    return PLAN_SEMESTER_ORDER.filter((k) => keys.includes(k));
  }
  const legacy = ["Freshman", "Sophomore", "Junior", "Senior"];
  return legacy.filter((k) => keys.includes(k));
}

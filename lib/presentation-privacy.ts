import type { AdvisorAlert } from "@/lib/graduation-readiness"

export const PRESENTATION_PRIVACY_STORAGE_KEY = "course-planner-presentation-privacy"

/** Alerts that expose letter grades, GPA numbers, or “below C-” style detail. */
const SENSITIVE_ALERT_IDS = new Set(["min-grade-policy", "core-gpa", "ems-gpa"])

export function formatGradeForPresentation(
  grade: string | undefined | null,
  hideSensitive: boolean,
): string {
  const raw = (grade ?? "").trim()
  if (!hideSensitive) return raw || "—"
  if (!raw) return "—"
  const g = raw.toUpperCase()
  if (g === "IP") return "In progress"
  if (g === "WD") return "Withdrawn"
  if (g === "F") return "Not completed"
  if (g === "P" || g === "S" || g === "U" || g === "CR") return "Completed"
  if (/^[ABCDF](\+|-)?$/.test(g)) {
    if (g.startsWith("F")) return "Not completed"
    return "Completed"
  }
  return "•••"
}

export function formatGpaForPresentation(gpa: string | undefined | null, hideSensitive: boolean): string {
  if (!hideSensitive) return (gpa ?? "").trim() || "—"
  return "Hidden"
}

export function privacySanitizeAdvisorAlert(
  alert: AdvisorAlert,
  hideSensitive: boolean,
): AdvisorAlert {
  if (!hideSensitive || !SENSITIVE_ALERT_IDS.has(alert.id)) return alert
  return {
    ...alert,
    detail:
      "Detailed grades and GPA values are hidden in presentation mode. The same checks still run in the background.",
    nextAction:
      'Turn off "Hide grades" in the header (next to the theme toggle) to see specific grades and GPA on a private screen.',
  }
}

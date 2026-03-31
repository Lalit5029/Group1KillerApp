/** Class years used for suggested-course buckets in degree requirements. */
export const CLASS_YEARS = ["Freshman", "Sophomore", "Junior", "Senior"] as const

export type ClassYear = (typeof CLASS_YEARS)[number]

/**
 * Map free-text academic year (from student record or imports) to a class year bucket.
 */
export function normalizeAcademicYearLabel(raw: string | null | undefined): ClassYear | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  if ((CLASS_YEARS as readonly string[]).includes(t)) return t as ClassYear
  const s = t.toLowerCase()
  if (/\b1\b|fresh|first/i.test(s)) return "Freshman"
  if (/\b2\b|soph/i.test(s)) return "Sophomore"
  if (/\b3\b|junior|third/i.test(s)) return "Junior"
  if (/\b4\b|senior|fourth/i.test(s)) return "Senior"
  return null
}

import type { Course, SelectedCourse } from "@/lib/types"
import { hasConflict, parseDaysTimes } from "@/lib/schedule-utils"

export type ScheduleConstraints = {
  courseCodes: string[]
  avoidFriday: boolean
  maxEndMinutes: number | null
}

export function normalizeCourseClass(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
}

/** Pull DEPT + NNN from free text (e.g. CIS 375, cis341). */
export function extractCourseCodesFromText(text: string): string[] {
  const codes: string[] = []
  const re = /\b([A-Z]{2,4})\s*(\d{3}[A-Z]?)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    codes.push(`${m[1].toUpperCase()} ${m[2].toUpperCase()}`)
  }
  return [...new Set(codes)]
}

export function parseScheduleConstraintsFromText(text: string): ScheduleConstraints {
  const courseCodes = extractCourseCodesFromText(text)
  const avoidFriday =
    /no\s+fridays?|avoid\s+fridays?|without\s+fridays?|not\s+on\s+fridays?|zero\s+fridays?/i.test(
      text,
    )

  let maxEndMinutes: number | null = null
  if (
    /no\s+later\s+than\s*6(?:\s*:00)?\s*pm|not\s+later\s+than\s*6(?:\s*:00)?\s*pm|before\s+6(?:\s*:00)?\s*pm|by\s+6(?:\s*:00)?\s*pm|end\s+(?:before|by)\s+6|nothing\s+after\s+6|courses?\s+no\s+later\s+than\s*6/i.test(
      text,
    )
  ) {
    maxEndMinutes = 18 * 60
  }
  if (maxEndMinutes == null && /before\s+6(?!\d)/i.test(text)) {
    maxEndMinutes = 18 * 60
  }

  return { courseCodes, avoidFriday, maxEndMinutes }
}

function sectionMeetsHardFilters(course: Course, c: ScheduleConstraints): boolean {
  const dt = course.DaysTimes?.trim() || ""
  if (!dt) return false
  const parsed = parseDaysTimes(dt)
  if (!parsed) return false
  if (c.avoidFriday && parsed.days.includes("Fr")) return false
  if (c.maxEndMinutes != null && parsed.endMinutes > c.maxEndMinutes) return false
  return true
}

function courseToSelected(row: Course, idx: number): SelectedCourse {
  return {
    id: String(row.id || `asst-${normalizeCourseClass(row.Class || "")}-${row.Section || idx}-${idx}`),
    Class: row.Class,
    Section: row.Section,
    DaysTimes: row.DaysTimes,
    Room: row.Room,
    Instructor: row.Instructor,
  }
}

export type ScheduleSolveResult = {
  ok: boolean
  selection: SelectedCourse[]
  issues: string[]
  constraints: ScheduleConstraints
}

/**
 * Picks one section per requested course from catalog, respecting filters and pairwise time conflicts.
 */
export function solveSchedule(catalog: Course[], constraints: ScheduleConstraints): ScheduleSolveResult {
  const issues: string[] = []

  if (constraints.courseCodes.length === 0) {
    return {
      ok: false,
      selection: [],
      issues: [
        "I did not find any course codes in your message. Try something like: “I want CIS 375, MAT 331, and IST 344 with no Fridays and nothing ending after 6 PM.”",
      ],
      constraints,
    }
  }

  const byClass = new Map<string, Course[]>()
  for (const row of catalog) {
    const cls = normalizeCourseClass(row.Class || "")
    if (!cls) continue
    if (!byClass.has(cls)) byClass.set(cls, [])
    byClass.get(cls)!.push(row)
  }

  const optionLists: Course[][] = []
  for (const want of constraints.courseCodes) {
    const rows = byClass.get(want) || []
    const filtered = rows.filter((r) => sectionMeetsHardFilters(r, constraints))
    if (filtered.length === 0) {
      if (rows.length === 0) {
        issues.push(
          `${want}: no sections appear in the current course catalog. Add or refresh offerings data, or check the department code.`,
        )
      } else {
        const parts: string[] = []
        if (constraints.avoidFriday) parts.push("no Friday meetings")
        if (constraints.maxEndMinutes != null) parts.push("all meetings must end by 6:00 PM")
        issues.push(
          `${want}: the catalog has ${rows.length} section(s), but none satisfy ${parts.join(" and ") || "your filters"}.`,
        )
      }
      return { ok: false, selection: [], issues, constraints }
    }
    optionLists.push(filtered)
  }

  const picked: SelectedCourse[] = []

  function dfs(depth: number): boolean {
    if (depth >= optionLists.length) return true
    const choices = optionLists[depth]
    for (let i = 0; i < choices.length; i++) {
      const row = choices[i]
      const sel = courseToSelected(row, depth * 1000 + i)
      if (!hasConflict(row, picked)) {
        picked.push(sel)
        if (dfs(depth + 1)) return true
        picked.pop()
      }
    }
    return false
  }

  if (!dfs(0)) {
    issues.push(
      `Each course has sections that match your day/time rules, but there is no combination that avoids time overlaps between them. Try relaxing a constraint (e.g. allow one evening section) or drop one course from the set.`,
    )
    return { ok: false, selection: [], issues, constraints }
  }

  return { ok: true, selection: picked, issues: [], constraints }
}

export function shouldAttemptScheduleSolve(message: string): boolean {
  const lower = message.toLowerCase()
  if (/\bwhat\s+is\b|\babout\b|\bdefine\b|\bexplain\b|\bdescribe\b/.test(lower) && !/\bschedule\b|\bregister\b|\bplan\b/.test(lower)) {
    const codes = extractCourseCodesFromText(message)
    if (codes.length <= 1) return false
  }
  const codes = extractCourseCodesFromText(message)
  if (codes.length === 0) return false
  if (codes.length >= 2) return true
  return /\b(schedule|register|take|add|plan|section|fit|want|need)\b/i.test(message)
}

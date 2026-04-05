import type { Course } from "@/lib/types"
import { extractCourseCodesFromText, normalizeCourseClass } from "@/lib/assistant-schedule-engine"

const MAX_SECTIONS_PER_COURSE = 45

function isOfferingAvailabilityQuestion(message: string): boolean {
  const q = message.toLowerCase()
  return (
    /\b(can|could)\s+(i|we|you)\s+take\b/.test(q) ||
    /\bcan\s+.+\s+be\s+taken\b/.test(q) ||
    /\b(is|are)\b[\s\w]{0,40}\b(offered|available)\b/.test(q) ||
    /\b(offered|available)\s+(in|for|during|this|the)\b/.test(q) ||
    /\bwill\b[\s\w]{0,40}\b(be\s+offered|run)\b/.test(q) ||
    /\btake\b.*\b(semester|term)\b/.test(q) ||
    /\b(semester|term)\b.*\b(take|offer|available)\b/.test(q)
  )
}

/** Parse Fall/Spring/Summer/Winter or a bare 4-digit year (calendar year). */
function getTermWindowForMessage(message: string): { label: string; start: Date; end: Date } | null {
  const q = message.toLowerCase()
  const yearMatch = message.match(/\b(20[2-3]\d)\b/)
  const defaultYear = new Date().getFullYear()
  const year = yearMatch ? parseInt(yearMatch[1], 10) : defaultYear

  if (/\b(fall|autumn)\b/.test(q)) {
    return {
      label: `Fall ${year}`,
      start: new Date(year, 7, 1),
      end: new Date(year, 11, 31),
    }
  }
  if (/\b(spring)\b/.test(q)) {
    return {
      label: `Spring ${year}`,
      start: new Date(year, 0, 1),
      end: new Date(year, 4, 31),
    }
  }
  if (/\b(summer)\b/.test(q)) {
    return {
      label: `Summer ${year}`,
      start: new Date(year, 4, 1),
      end: new Date(year, 7, 31),
    }
  }
  if (/\b(winter)\b/.test(q)) {
    return {
      label: `Winter ${year}`,
      start: new Date(year, 11, 1),
      end: new Date(year + 1, 0, 31),
    }
  }
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10)
    return {
      label: `${y}`,
      start: new Date(y, 0, 1),
      end: new Date(y, 11, 31),
    }
  }
  return null
}

function parseMeetingDateRange(raw: string): { start: Date; end: Date } | null {
  const m = String(raw || "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const start = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]))
  const end = new Date(Number(m[6]), Number(m[4]) - 1, Number(m[5]))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { start, end }
}

function dateRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  const a0 = new Date(aStart).setHours(0, 0, 0, 0)
  const a1 = new Date(aEnd).setHours(23, 59, 59, 999)
  const b0 = new Date(bStart).setHours(0, 0, 0, 0)
  const b1 = new Date(bEnd).setHours(23, 59, 59, 999)
  return !(a1 < b0 || a0 > b1)
}

function inferTermLabelFromMeetingStart(start: Date): string {
  const m = start.getMonth()
  const y = start.getFullYear()
  if (m >= 7) return `Fall ${y}`
  if (m <= 3) return `Spring ${y}`
  if (m >= 4 && m <= 6) return `Summer ${y}`
  return `starting ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
}

function shouldAnswerSemesterOffering(message: string): boolean {
  if (extractCourseCodesFromText(message).length === 0) return false
  if (!isOfferingAvailabilityQuestion(message)) return false
  return getTermWindowForMessage(message) !== null
}

/** True when the user is asking for factual catalog info (room, time, instructor), not a full schedule build. */
export function isCatalogLookupQuestion(message: string): boolean {
  const codes = extractCourseCodesFromText(message)
  if (codes.length === 0) return false

  if (shouldAnswerSemesterOffering(message)) return true

  const q = message.toLowerCase()

  if (
    /\b(where|locations?|which\s+room|what\s+room|what'?s\s+the\s+room|in\s+what\s+room|building|campus|address|held)\b/.test(
      q,
    )
  ) {
    return true
  }
  if (/\b(who\s+teaches|instructor|professor|who'?s\s+teaching|taught\s+by)\b/.test(q)) {
    return true
  }
  if (
    /\b(what\s+time|when\s+does|when\s+is|when\s+are|meeting\s+time|class\s+times?|days\s*(and|&)\s*times)\b/.test(
      q,
    )
  ) {
    return true
  }
  if (/\b(section\s+details|list\s+sections|all\s+sections|catalog\s+for|offerings?\s+for)\b/.test(q)) {
    return true
  }
  // "CIS 375 room" / "room for CIS 375"
  if (/\broom\b/.test(q) && /\b([a-z]{2,4}\s*\d{3}[a-z]?)\b/i.test(message)) {
    return true
  }

  return false
}

type Emphasis = "room" | "time" | "instructor" | "all"

function detectEmphasis(message: string): Emphasis {
  const q = message.toLowerCase()
  if (
    /\b(where|locations?|room|building|campus|address|held)\b/.test(q) &&
    !/\b(what\s+time|when\s+does|when\s+is)\b/.test(q)
  ) {
    return "room"
  }
  if (/\b(what\s+time|when\s+does|when\s+is|when\s+are|meeting\s+time|class\s+times?|days)\b/.test(q)) {
    return "time"
  }
  if (/\b(who\s+teaches|instructor|professor|taught\s+by)\b/.test(q)) {
    return "instructor"
  }
  return "all"
}

function answerSemesterAvailability(catalog: Course[], message: string, codes: string[]): string {
  const term = getTermWindowForMessage(message)
  if (!term) {
    return "Add a semester or year (for example **Fall 2026** or **2026**) so I can compare against catalog meeting dates."
  }

  const byClass = new Map<string, Course[]>()
  for (const row of catalog) {
    const cls = normalizeCourseClass(row.Class || "")
    if (!cls) continue
    if (!byClass.has(cls)) byClass.set(cls, [])
    byClass.get(cls)!.push(row)
  }

  const blocks: string[] = []
  for (const code of codes) {
    const rows = byClass.get(code) || []
    if (rows.length === 0) {
      blocks.push(
        `**${code}** — not listed in this catalog snapshot, so nothing here confirms **${term.label}**.`,
      )
      continue
    }

    const matching: Course[] = []
    const undated: Course[] = []
    for (const row of rows) {
      const range = parseMeetingDateRange(row.MeetingDates || "")
      if (!range) {
        undated.push(row)
        continue
      }
      if (dateRangesOverlap(range.start, range.end, term.start, term.end)) {
        matching.push(row)
      }
    }

    if (matching.length > 0) {
      const shown = matching.slice(0, MAX_SECTIONS_PER_COURSE)
      const extra = matching.length - shown.length
      const lines = shown.map((r) => {
        const dates = (r.MeetingDates || "").trim() || "TBA"
        const sec = (r.Section || "").trim() || "—"
        return `• **${sec}** — ${dates}${r.DaysTimes ? ` — ${r.DaysTimes}` : ""}`
      })
      blocks.push(
        [
          `**Yes** — **${code}** has ${matching.length} section(s) in this catalog whose meeting dates overlap **${term.label}**:`,
          ...lines,
          extra > 0 ? `\n… and ${extra} more matching section(s).` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      continue
    }

    if (rows.length > 0 && undated.length === rows.length) {
      blocks.push(
        `**${code}** — listed (${rows.length} section(s)), but **meeting dates are missing or unparsed**, so **${term.label}** can’t be confirmed from this file.`,
      )
      continue
    }

    const otherLabels = new Map<string, number>()
    for (const row of rows) {
      const range = parseMeetingDateRange(row.MeetingDates || "")
      if (!range) continue
      const label = inferTermLabelFromMeetingStart(range.start)
      otherLabels.set(label, (otherLabels.get(label) || 0) + 1)
    }
    const summary =
      otherLabels.size > 0
        ? Array.from(otherLabels.entries())
            .map(([lab, n]) => `${n}× ${lab}`)
            .join(", ")
        : "see catalog"
    blocks.push(
      `**No** — none of the **${code}** sections in this catalog overlap **${term.label}** by meeting dates. Other ranges present: ${summary}. Double-check **MySlice** for the term you need.`,
    )
  }

  const header = `Compared to **${term.label}** (approximate calendar window in this assistant — always confirm in **MySlice**):\n\n`
  return header + blocks.join("\n\n")
}

function formatSectionLine(row: Course, emphasis: Emphasis): string {
  const section = (row.Section || "").trim() || "—"
  const room = (row.Room || "").trim() || "TBA"
  const times = (row.DaysTimes || "").trim() || "TBA"
  const instructor = (row.Instructor || "").trim() || "TBA"
  switch (emphasis) {
    case "room":
      return `• **${section}** — ${room}`
    case "time":
      return `• **${section}** — ${times}`
    case "instructor":
      return `• **${section}** — ${instructor}`
    default:
      return `• **${section}** — ${times} — ${room}${instructor !== "TBA" ? ` — ${instructor}` : ""}`
  }
}

/**
 * Answers from the loaded catalog (rooms, times, instructors). No LLM required.
 */
export function answerCatalogLookup(catalog: Course[], message: string): string {
  const codes = extractCourseCodesFromText(message)
  if (codes.length === 0) {
    return "I need a course code (for example CIS 375) to look up catalog details."
  }

  if (shouldAnswerSemesterOffering(message)) {
    return answerSemesterAvailability(catalog, message, codes)
  }

  const emphasis = detectEmphasis(message)
  const byClass = new Map<string, Course[]>()
  for (const row of catalog) {
    const cls = normalizeCourseClass(row.Class || "")
    if (!cls) continue
    if (!byClass.has(cls)) byClass.set(cls, [])
    byClass.get(cls)!.push(row)
  }

  const blocks: string[] = []
  for (const code of codes) {
    const rows = byClass.get(code) || []
    if (rows.length === 0) {
      blocks.push(`**${code}** — no sections appear in the current catalog data.`)
      continue
    }
    const shown = rows.slice(0, MAX_SECTIONS_PER_COURSE)
    const extra = rows.length - shown.length
    const lines = shown.map((r) => formatSectionLine(r, emphasis))
    let intro = `**${code}** (${rows.length} section${rows.length === 1 ? "" : "s"} in this catalog):`
    if (emphasis === "room") {
      intro += "\nRooms are taken from the catalog; confirm in MySlice or with the department if needed."
    }
    blocks.push([intro, ...lines, extra > 0 ? `\n… and ${extra} more section(s).` : ""].filter(Boolean).join("\n"))
  }

  return blocks.join("\n\n")
}

const fs = require("fs")
const path = require("path")
const cheerio = require("cheerio")

const ROOT = path.join(__dirname, "..")
const DEFAULT_INPUTS = [
  path.join(__dirname, "cis-response.xml"),
  path.join(__dirname, "ecs-response.xml"),
]
const DEFAULT_JSON_OUT = path.join(ROOT, "public", "data", "course_offerings_from_saved_responses.json")
const DEFAULT_JSONL_OUT = path.join(ROOT, "public", "data", "course_offerings_from_saved_responses.jsonl")

function parseArgs(argv) {
  const args = {
    inputs: [...DEFAULT_INPUTS],
    jsonOut: DEFAULT_JSON_OUT,
    jsonlOut: DEFAULT_JSONL_OUT,
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === "--inputs") {
      args.inputs = argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((p) => path.resolve(p))
    } else if (token === "--json-out") {
      args.jsonOut = path.resolve(argv[++i])
    } else if (token === "--jsonl-out") {
      args.jsonlOut = path.resolve(argv[++i])
    }
  }

  return args
}

function textOf($, el) {
  return $(el).text().replace(/\s+/g, " ").trim()
}

function parseSubjectCatalogAndTitle(groupLabel) {
  // Example: "CIS 151 - Fundamentals of Computing and Programming"
  const raw = String(groupLabel || "").replace(/\u00a0/g, " ").trim()
  const m = raw.match(/([A-Z]{2,6})\s*([0-9]{3}[A-Z]?)\s*-\s*(.+)$/i)
  if (!m) {
    return {
      subject: "",
      catalog: "",
      courseCode: "",
      courseTitle: raw || null,
    }
  }
  const subject = m[1].toUpperCase()
  const catalog = m[2].toUpperCase()
  return {
    subject,
    catalog,
    courseCode: `${subject} ${catalog}`,
    courseTitle: m[3].trim() || null,
  }
}

function parseMeetingDateRange(raw) {
  const text = String(raw || "").trim()
  const m = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/)
  if (!m) return { meetingStart: null, meetingEnd: null }
  return { meetingStart: m[1], meetingEnd: m[2] }
}

function parseDaysTimes(raw) {
  const text = String(raw || "").trim()
  const dayMatches = text.match(/Mo|Tu|We|Th|Fr|Sa|Su/g) || []
  const days = Array.from(new Set(dayMatches))
  const times = Array.from(text.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi)).map((m) => m[1])
  return {
    days,
    startTime: times[0] || null,
    endTime: times[1] || null,
  }
}

function parseSingleResponse(xmlPath) {
  const xml = fs.readFileSync(xmlPath, "utf8")
  const $xml = cheerio.load(xml, { xmlMode: true, decodeEntities: true })

  // PeopleSoft wraps page HTML inside FIELD CDATA.
  const pageContainerHtml = $xml("FIELD[id='win0divPAGECONTAINER']").text() || ""
  if (!pageContainerHtml.trim()) return []

  const $ = cheerio.load(pageContainerHtml, { decodeEntities: true })

  const pageKey = textOf($, "#DERIVED_CLSRCH_SSS_PAGE_KEYDESCR")
  // Example: "Syracuse University | Fall 2026"
  const term = pageKey.includes("|") ? pageKey.split("|").pop().trim() : null

  const fileTag = path.basename(xmlPath)
  const rows = []

  // Each course bucket has a group label with an index suffix:
  // win0divSSR_CLSRSLT_WRK_GROUPBOX2GP$<idx>
  $("div[id^='win0divSSR_CLSRSLT_WRK_GROUPBOX2GP$']").each((_, groupEl) => {
    const groupId = $(groupEl).attr("id") || ""
    const idxMatch = groupId.match(/\$(\d+)$/)
    if (!idxMatch) return
    const idx = idxMatch[1]

    const groupLabel = textOf($, groupEl)
    const parsedCourse = parseSubjectCatalogAndTitle(groupLabel)

    // Meeting rows for this course group:
    // trSSR_CLSRCH_MTG1$<idx>_row1, row2, ...
    const rowSelector = `tr[id^='trSSR_CLSRCH_MTG1$${idx}_row']`
    $(rowSelector).each((__, tr) => {
      const tds = $(tr).find("td")
      if (tds.length < 8) return

      // Column mapping based on response structure:
      // 0 expand icon, 1 classNbr, 2 section, 3 days/times, 4 room, 5 instructor, 6 meeting dates, 7 status
      const classNbr = textOf($, tds.eq(1)) || null
      const section = textOf($, tds.eq(2)).replace(/\s+/g, " ").trim() || null
      const daysTimesRaw = textOf($, tds.eq(3)) || null
      const room = textOf($, tds.eq(4)) || null
      const instructor = textOf($, tds.eq(5)) || null
      const meetingDatesRaw = textOf($, tds.eq(6)) || null

      // Status often represented as image alt text (Open / Closed / Wait List)
      const statusFromAlt = $(tds.eq(7)).find("img").attr("alt") || ""
      const statusText = textOf($, tds.eq(7))
      const status = (statusFromAlt || statusText || "").trim() || null

      const { meetingStart, meetingEnd } = parseMeetingDateRange(meetingDatesRaw)
      const { days, startTime, endTime } = parseDaysTimes(daysTimesRaw)

      rows.push({
        term,
        subject: parsedCourse.subject || null,
        catalog: parsedCourse.catalog || null,
        courseCode: parsedCourse.courseCode || null,
        courseTitle: parsedCourse.courseTitle || null,
        classNbr,
        section,
        daysTimesRaw,
        days,
        startTime,
        endTime,
        room,
        instructor,
        meetingDatesRaw,
        meetingStart,
        meetingEnd,
        status,
        sourceFile: fileTag,
      })
    })
  })

  return rows
}

function dedupe(rows) {
  const seen = new Set()
  return rows.filter((r) => {
    const key = [
      (r.term || "").toUpperCase(),
      (r.courseCode || "").toUpperCase(),
      (r.section || "").toUpperCase(),
      (r.classNbr || "").toUpperCase(),
    ].join("|")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const allRows = []

  for (const inputPath of args.inputs) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`)
    }
    const rows = parseSingleResponse(inputPath)
    console.log(`${path.basename(inputPath)} -> parsed ${rows.length} row(s)`)
    allRows.push(...rows)
  }

  const deduped = dedupe(allRows)
  fs.writeFileSync(args.jsonOut, `${JSON.stringify(deduped, null, 2)}\n`, "utf8")
  fs.writeFileSync(args.jsonlOut, `${deduped.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8")

  console.log(`Wrote ${deduped.length} unique offering rows`)
  console.log(`JSON:  ${path.relative(ROOT, args.jsonOut)}`)
  console.log(`JSONL: ${path.relative(ROOT, args.jsonlOut)}`)
}

main()


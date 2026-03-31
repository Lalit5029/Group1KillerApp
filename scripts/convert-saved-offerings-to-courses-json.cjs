const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")
const DEFAULT_INPUT = path.join(ROOT, "public", "data", "course_offerings_from_saved_responses.json")
const DEFAULT_OUTPUT = path.join(ROOT, "public", "data", "courses.from_saved_responses.json")

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    overwriteCoursesJson: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === "--input") args.input = path.resolve(argv[++i])
    else if (token === "--output") args.output = path.resolve(argv[++i])
    else if (token === "--overwrite-courses-json") args.overwriteCoursesJson = true
  }

  return args
}

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function toCourseRow(offering, idx) {
  const courseCode = normalizeSpaces(offering.courseCode)
  const section = normalizeSpaces(offering.section) || "TBA"
  const daysTimes = normalizeSpaces(offering.daysTimesRaw)
  const room = normalizeSpaces(offering.room)
  const instructor = normalizeSpaces(offering.instructor)
  const meetingDates = normalizeSpaces(offering.meetingDatesRaw)

  return {
    id: `course-${idx + 1}`,
    Class: courseCode,
    Section: section,
    DaysTimes: daysTimes,
    Room: room,
    Instructor: instructor,
    MeetingDates: meetingDates,
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!fs.existsSync(args.input)) {
    throw new Error(`Input not found: ${args.input}`)
  }

  const parsed = JSON.parse(fs.readFileSync(args.input, "utf8"))
  if (!Array.isArray(parsed)) {
    throw new Error("Input JSON must be an array of offerings")
  }

  const seen = new Set()
  const out = []
  for (const row of parsed) {
    const key = [
      normalizeSpaces(row.courseCode || "").toUpperCase(),
      normalizeSpaces(row.section || "").toUpperCase(),
      normalizeSpaces(row.meetingDatesRaw || "").toUpperCase(),
      normalizeSpaces(row.instructor || "").toUpperCase(),
      normalizeSpaces(row.room || "").toUpperCase(),
    ].join("|")
    if (!normalizeSpaces(row.courseCode)) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }

  const courses = out.map((r, i) => toCourseRow(r, i))
  fs.writeFileSync(args.output, `${JSON.stringify(courses, null, 2)}\n`, "utf8")

  console.log(`Converted ${parsed.length} offerings -> ${courses.length} unique course rows`)
  console.log(`Output: ${path.relative(ROOT, args.output)}`)

  if (args.overwriteCoursesJson) {
    const target = path.join(ROOT, "public", "data", "courses.json")
    fs.writeFileSync(target, `${JSON.stringify(courses, null, 2)}\n`, "utf8")
    console.log(`Also wrote: ${path.relative(ROOT, target)}`)
  }
}

main()


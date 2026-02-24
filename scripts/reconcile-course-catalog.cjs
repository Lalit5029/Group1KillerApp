const fs = require("fs");
const path = require("path");

const REQUIREMENTS_PATH = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "engineering_majors_requirements.json",
);
const COURSES_CSV_PATH = path.join(__dirname, "..", "public", "data", "courses.csv");
const COURSES_JSON_PATH = path.join(__dirname, "..", "public", "data", "courses.json");
const MISSING_REPORT_PATH = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "missing_required_courses.json",
);

const shouldWritePlaceholders = process.argv.includes("--write-placeholders");

function normalizeCode(value) {
  return (value || "").replace(/\s+/g, "").toUpperCase();
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function toCsvCell(value) {
  const str = value == null ? "" : String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = (cells[idx] || "").trim();
    });
    return row;
  });

  return { headers, rows };
}

function writeCsv(filePath, headers, rows) {
  const csvLines = [
    headers.map((header) => toCsvCell(header)).join(","),
    ...rows.map((row) => headers.map((header) => toCsvCell(row[header] || "")).join(",")),
  ];
  fs.writeFileSync(filePath, `${csvLines.join("\n")}\n`, "utf8");
}

function collectRequiredCodes(requirements) {
  const requiredCodes = new Set();
  for (const majorData of Object.values(requirements)) {
    for (const yearCourses of Object.values(majorData || {})) {
      if (!Array.isArray(yearCourses)) continue;
      yearCourses.forEach((code) => {
        if (typeof code === "string" && code.trim()) {
          requiredCodes.add(code.trim());
        }
      });
    }
  }
  return Array.from(requiredCodes).sort((a, b) => a.localeCompare(b));
}

function syncJsonFromCsv(rows) {
  const jsonRows = rows.map((row, idx) => ({
    id: `catalog-course-${idx + 1}`,
    Class: row.Class || "",
    Section: row.Section || "",
    DaysTimes: row["Days & Times"] || "",
    Room: row.Room || "",
    Instructor: row.Instructor || "",
    MeetingDates: row["Meeting Dates"] || "",
    Status: row.Status || "",
    Reviews: [],
    RMP_Rating: "N/A",
  }));

  fs.writeFileSync(COURSES_JSON_PATH, `${JSON.stringify(jsonRows, null, 2)}\n`, "utf8");
}

function main() {
  if (!fs.existsSync(REQUIREMENTS_PATH)) {
    throw new Error(`Missing requirements file: ${REQUIREMENTS_PATH}`);
  }
  if (!fs.existsSync(COURSES_CSV_PATH)) {
    throw new Error(`Missing courses CSV file: ${COURSES_CSV_PATH}`);
  }

  const requirements = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, "utf8"));
  const { headers, rows } = readCsv(COURSES_CSV_PATH);
  const requiredCodes = collectRequiredCodes(requirements);

  const existingCodes = new Set(rows.map((row) => normalizeCode(row.Class)));
  const missingCodes = requiredCodes.filter((code) => !existingCodes.has(normalizeCode(code)));

  const report = {
    scannedAt: new Date().toISOString(),
    requiredCodeCount: requiredCodes.length,
    currentCourseRowCount: rows.length,
    missingCount: missingCodes.length,
    missingCodes,
  };
  fs.writeFileSync(MISSING_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Required codes: ${requiredCodes.length}`);
  console.log(`Current CSV rows: ${rows.length}`);
  console.log(`Missing required codes: ${missingCodes.length}`);
  console.log(`Report written to: ${path.relative(process.cwd(), MISSING_REPORT_PATH)}`);

  if (!shouldWritePlaceholders) {
    console.log("Dry run only. Re-run with --write-placeholders to append placeholder sections.");
    return;
  }

  if (missingCodes.length === 0) {
    console.log("No missing required codes. Nothing to append.");
    return;
  }

  missingCodes.forEach((code) => {
    rows.push({
      Class: code,
      Section: "CATALOG-TBA",
      "Days & Times": "",
      Room: "",
      Instructor: "TBA",
      "Meeting Dates": "",
      Status: "Catalog requirement (no section in feed)",
    });
  });

  writeCsv(COURSES_CSV_PATH, headers, rows);
  syncJsonFromCsv(rows);

  console.log(`Appended ${missingCodes.length} placeholder rows to courses.csv`);
  console.log("Regenerated courses.json from updated CSV");
}

main();

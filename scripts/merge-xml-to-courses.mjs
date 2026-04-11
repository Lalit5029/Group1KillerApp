/**
 * Merge PeopleSoft class-search XML files into public/data/courses.json.
 *
 * Usage:
 *   node scripts/merge-xml-to-courses.mjs                    # all scripts/*-all.xml (excludes *response*)
 *   node scripts/merge-xml-to-courses.mjs path/to/a.xml ...  # specific files
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const COURSES_JSON = path.join(ROOT, "public", "data", "courses.json");

function nextCourseIds(existing, count) {
  let max = 0;
  for (const c of existing) {
    const m = String(c.id || "").match(/^course-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `course-${max + i + 1}`);
}

function normalizeSectionText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

/** PeopleSoft sometimes yields the same label twice (e.g. "M001-SEC RegularM001-SEC Regular"). */
function dedupeRepeatedSectionLabel(text) {
  const t = normalizeSectionText(text);
  if (t.length < 4 || t.length % 2 !== 0) return t;
  const half = t.length / 2;
  const a = t.slice(0, half);
  const b = t.slice(half);
  return a === b ? a : t;
}

function parseXmlToOfferings(xmlPath) {
  const raw = fs.readFileSync(xmlPath, "utf8");
  const $ = cheerio.load(raw, { decodeEntities: true });
  const offerings = [];

  $('div[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]').each((_, groupEl) => {
    const headerText = normalizeSectionText(
      $(groupEl).find("tr td.PAGROUPBOXLABELLEVEL1").first().text()
    );
    const headerMatch = headerText.match(/^([A-Z]{2,4})\s+(\d{3}[A-Z]?)\s*-\s*(.+)$/i);
    if (!headerMatch) return;

    const subject = headerMatch[1].toUpperCase();
    const catalog = headerMatch[2].toUpperCase();
    const classLabel = `${subject} ${catalog}`;

    $(groupEl)
      .find('tr[id^="trSSR_CLSRCH_MTG1"]')
      .each((__, row) => {
        const $row = $(row);
        const section = dedupeRepeatedSectionLabel($row.find('[id^="MTG_CLASSNAME"]').text());
        const daysTimes = normalizeSectionText($row.find('[id^="MTG_DAYTIME"]').text()) || "TBA";
        const room = normalizeSectionText($row.find('[id^="MTG_ROOM"]').text()) || "TBA";
        const instructor = normalizeSectionText($row.find('[id^="MTG_INSTR"]').text()) || "Staff";
        const meetingDates = normalizeSectionText($row.find('[id^="MTG_TOPIC"]').text()) || "TBA";

        if (!section) return;

        offerings.push({
          Class: classLabel,
          Section: section,
          DaysTimes: daysTimes,
          Room: room,
          Instructor: instructor,
          MeetingDates: meetingDates,
        });
      });
  });

  return offerings;
}

function defaultXmlFiles() {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith("-all.xml") && !/response/i.test(f))
    .map((f) => path.join(SCRIPTS_DIR, f));
}

function main() {
  const argv = process.argv.slice(2);
  const files = argv.length > 0 ? argv.map((p) => path.resolve(p)) : defaultXmlFiles();

  if (files.length === 0) {
    console.error("No XML files to merge.");
    process.exit(1);
  }
  if (!fs.existsSync(COURSES_JSON)) {
    console.error("courses.json not found:", COURSES_JSON);
    process.exit(1);
  }

  const existing = JSON.parse(fs.readFileSync(COURSES_JSON, "utf8"));
  if (!Array.isArray(existing)) {
    console.error("courses.json must be a JSON array");
    process.exit(1);
  }

  function catalogRowKey(c) {
    const cls = String(c.Class || "").trim();
    const sec = dedupeRepeatedSectionLabel(String(c.Section || ""));
    return `${cls}::${sec}`;
  }

  /** Collapse rows whose section label only differed by duplication (M001…M001). */
  const dedupedExistingMap = new Map();
  for (const c of existing) {
    const normalized = {
      ...c,
      Class: String(c.Class || "").trim(),
      Section: dedupeRepeatedSectionLabel(String(c.Section || "")),
    };
    dedupedExistingMap.set(catalogRowKey(normalized), normalized);
  }
  const dedupedExisting = [...dedupedExistingMap.values()];

  const byKey = new Map();
  let totalRows = 0;

  for (const xmlPath of files) {
    if (!fs.existsSync(xmlPath)) {
      console.warn("Skip (missing):", xmlPath);
      continue;
    }
    const parsed = parseXmlToOfferings(xmlPath);
    totalRows += parsed.length;
    for (const o of parsed) {
      const row = {
        ...o,
        Class: String(o.Class || "").trim(),
        Section: dedupeRepeatedSectionLabel(o.Section),
      };
      const key = catalogRowKey(row);
      // Later files / rows overwrite so refreshed XML updates existing catalog rows.
      byKey.set(key, row);
    }
    console.log(`${path.basename(xmlPath)}: ${parsed.length} rows → ${byKey.size} unique sections so far`);
  }

  const uniqueOfferings = Array.from(byKey.values());

  let updatedCount = 0;
  const refreshed = dedupedExisting.map((c) => {
    const fresh = byKey.get(catalogRowKey(c));
    if (!fresh) return c;
    const changed =
      c.DaysTimes !== fresh.DaysTimes ||
      c.Room !== fresh.Room ||
      c.Instructor !== fresh.Instructor ||
      c.MeetingDates !== fresh.MeetingDates ||
      c.Section !== fresh.Section;
    if (changed) updatedCount++;
    return {
      ...c,
      Class: fresh.Class,
      Section: fresh.Section,
      DaysTimes: fresh.DaysTimes,
      Room: fresh.Room,
      Instructor: fresh.Instructor,
      MeetingDates: fresh.MeetingDates,
    };
  });

  const haveKeys = new Set(dedupedExisting.map(catalogRowKey));
  const toAdd = uniqueOfferings.filter((o) => !haveKeys.has(catalogRowKey(o)));
  const ids = nextCourseIds(refreshed, toAdd.length);
  const merged = [
    ...refreshed,
    ...toAdd.map((o, i) => ({
      id: ids[i],
      ...o,
    })),
  ];

  fs.writeFileSync(COURSES_JSON, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(
    `Total parsed rows: ${totalRows}; unique across XML: ${uniqueOfferings.length}; updated ${updatedCount} existing; added ${toAdd.length} new → courses.json now ${merged.length} courses.`
  );
}

main();

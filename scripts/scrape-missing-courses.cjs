const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = path.join(__dirname, "..");
const DEFAULT_MISSING_PATH = path.join(ROOT, "public", "data", "missing_required_courses.json");
const DEFAULT_COURSES_CSV_PATH = path.join(ROOT, "public", "data", "courses.csv");
const DEFAULT_SCRAPED_JSON_PATH = path.join(ROOT, "public", "data", "scraped_missing_courses.json");
const DEFAULT_CONFIG_PATH = path.join(__dirname, "syracuse-class-search.config.json");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = {
    config: DEFAULT_CONFIG_PATH,
    missing: DEFAULT_MISSING_PATH,
    csv: DEFAULT_COURSES_CSV_PATH,
    output: DEFAULT_SCRAPED_JSON_PATH,
    limit: null,
    headful: false,
    dryRun: false,
    debugDom: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--config") args.config = path.resolve(argv[++i]);
    else if (token === "--missing") args.missing = path.resolve(argv[++i]);
    else if (token === "--csv") args.csv = path.resolve(argv[++i]);
    else if (token === "--output") args.output = path.resolve(argv[++i]);
    else if (token === "--limit") args.limit = Number(argv[++i]);
    else if (token === "--headful") args.headful = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token === "--debug-dom") args.debugDom = true;
    else if (token === "--help" || token === "-h") args.help = true;
  }

  return args;
}

function usage() {
  console.log(
    [
      "Usage: node scripts/scrape-missing-courses.cjs [options]",
      "",
      "Options:",
      "  --config <path>   Path to site selector config JSON",
      "  --missing <path>  Path to missing_required_courses.json",
      "  --csv <path>      Path to courses.csv",
      "  --output <path>   Path to write scraped JSON rows",
      "  --limit <n>       Only scrape first n missing codes",
      "  --headful         Run browser with UI (default headless)",
      "  --dry-run         Do not write to courses.csv",
      "  --debug-dom       Print frame list and a small selector inventory",
      "  --help            Show this help",
      "",
      "Required setup:",
      "  1. Copy scripts/syracuse-class-search.config.example.json -> scripts/syracuse-class-search.config.json",
      "  2. Fill selectors/URLs from Syracuse class search page",
      "  3. Set CHROME_PATH if not using default macOS Chrome path",
      "  4. If the search form opens after a click, use preNavigationClicks in config",
    ].join("\n"),
  );
}

function mustReadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeCode(value) {
  return (value || "").replace(/\s+/g, "").toUpperCase();
}

function splitCode(code) {
  const clean = (code || "").trim().replace(/\s+/g, " ");
  const match = clean.match(/^([A-Za-z]{2,4})\s*([0-9]{3}[A-Za-z]?)$/);
  if (!match) {
    return { subject: "", catalog: "", raw: clean };
  }
  return {
    subject: match[1].toUpperCase(),
    catalog: match[2].toUpperCase(),
    raw: clean,
  };
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
  if (!fs.existsSync(filePath)) {
    throw new Error(`courses.csv not found: ${filePath}`);
  }

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

async function setField(context, fieldConfig, value) {
  if (!fieldConfig || !fieldConfig.query) return;
  const type = fieldConfig.type || "input";
  const selector = fieldConfig.query;

  await context.waitForSelector(selector, { timeout: fieldConfig.timeoutMs || 15000 });
  if (type === "select") {
    const selected = await context.select(selector, value);
    if (selected.length === 0) {
      // Fallback for PeopleSoft dropdowns where config uses visible label instead of option value.
      const selectedByLabel = await context.$eval(
        selector,
        (el, targetLabel) => {
          const selectEl = el;
          const normalizedTarget = (targetLabel || "").toString().trim().toLowerCase();
          const compactTarget = normalizedTarget.replace(/[^a-z0-9]/g, "");
          const match = Array.from(selectEl.options).find(
            (opt) =>
              (opt.text || "").trim().toLowerCase() === normalizedTarget ||
              (opt.text || "").trim().toLowerCase().includes(normalizedTarget) ||
              (opt.value || "").trim().toLowerCase() === normalizedTarget ||
              (opt.value || "").trim().toLowerCase().includes(normalizedTarget) ||
              (opt.text || "").toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(compactTarget),
          );
          if (!match) return false;
          selectEl.value = match.value;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        },
        value,
      );
      if (!selectedByLabel) {
        throw new Error(`Could not set select ${selector} with value/label "${value}"`);
      }
    }
    return;
  }

  await context.click(selector, { clickCount: 3 });
  await context.type(selector, value, { delay: fieldConfig.typeDelayMs || 10 });
}

async function clickIfPresent(context, selector) {
  if (!selector) return false;
  try {
    const el = await context.$(selector);
    if (!el) return false;
    await el.click();
    return true;
  } catch (error) {
    const msg = String(error && error.message ? error.message : error);
    if (msg.toLowerCase().includes("detached")) return false;
    throw error;
  }
}

async function clickByVisibleText(context, text) {
  const clicked = await context.evaluate((targetText) => {
    const target = (targetText || "").toLowerCase();
    const candidates = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a"));
    const match = candidates.find((el) => {
      const valueText = (el.value || "").toLowerCase();
      const innerText = (el.textContent || "").trim().toLowerCase();
      return valueText.includes(target) || innerText.includes(target);
    });
    if (!match) return false;
    match.click();
    return true;
  }, text);
  return !!clicked;
}

async function runPreNavigationClicks(page, config) {
  const steps = Array.isArray(config.preNavigationClicks) ? config.preNavigationClicks : [];
  if (steps.length === 0) return;

  for (const [idx, step] of steps.entries()) {
    if (!step || !step.query) continue;
    const timeoutMs = step.timeoutMs || 20000;
    const waitAfterMs = step.waitAfterMs || 1000;
    const optional = !!step.optional;

    try {
      await page.waitForSelector(step.query, { timeout: timeoutMs });
      await page.click(step.query);
      if (waitAfterMs > 0) await sleep(waitAfterMs);

      console.log(`Ran pre-navigation click ${idx + 1}: ${step.query}`);
    } catch (error) {
      if (!optional) {
        throw error;
      }
      console.log(`Optional pre-navigation click skipped (${idx + 1}): ${step.query}`);
    }
  }
}

async function ensureSearchFormVisible(context, selectors) {
  const subjectSelector = selectors?.subject?.query;
  if (!subjectSelector) {
    throw new Error("selectors.subject.query is required");
  }

  const shortTimeoutMs = selectors?.subject?.timeoutMs || 3000;
  const isVisible = await context.$(subjectSelector);
  if (isVisible) return;

  const clickedModifySearch = await clickByVisibleText(context, "Modify Search");
  if (clickedModifySearch) {
    await context.waitForSelector(subjectSelector, { timeout: 20000 });
    return;
  }

  await context.waitForSelector(subjectSelector, { timeout: shortTimeoutMs });
}

async function clickWithRetry(context, selector, attempts = 3) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      await context.click(selector);
      return;
    } catch (error) {
      lastError = error;
      const msg = String(error && error.message ? error.message : error).toLowerCase();
      if (!msg.includes("detached") && !msg.includes("execution context was destroyed")) {
        throw error;
      }
      await sleep(400);
    }
  }
  throw lastError || new Error(`Failed to click selector: ${selector}`);
}

async function scrapeRows(context, selectors, term) {
  const rowSelector = selectors.resultsRow;
  if (!rowSelector) {
    throw new Error("selectors.resultsRow is required in config");
  }

  const rows = await context.$$eval(
    rowSelector,
    (nodes, col, termValue) => {
      const text = (root, selector) => {
        if (!selector) return "";
        const target = root.querySelector(selector);
        return target ? target.textContent.trim() : "";
      };

      return nodes.map((row) => ({
        subject: text(row, col.subject),
        catalog: text(row, col.catalog),
        section: text(row, col.section),
        daysTimes: text(row, col.daysTimes),
        room: text(row, col.room),
        instructor: text(row, col.instructor),
        status: text(row, col.status),
        classNbr: text(row, col.classNbr),
        meetingDates: text(row, col.meetingDates),
        term: termValue || "",
        rowText: row.textContent.trim(),
      }));
    },
    selectors.columns || {},
    term || "",
  );

  return rows.map((row) => {
    const parsedCode = row.rowText.match(/([A-Z]{2,4})\s*([0-9]{3}[A-Z]?)/i);
    const normalizedSubject = row.subject || (parsedCode ? parsedCode[1].toUpperCase() : "");
    const normalizedCatalog = row.catalog || (parsedCode ? parsedCode[2].toUpperCase() : "");
    return { ...row, subject: normalizedSubject, catalog: normalizedCatalog };
  });
}

function resolveContext(page, config) {
  if (!config.frame) return page;

  const frames = page.frames();
  if (config.frame.name) {
    const byName = frames.find((f) => f.name() === config.frame.name);
    if (byName) return byName;
  }
  if (config.frame.urlIncludes) {
    const byUrl = frames.find((f) => f.url().includes(config.frame.urlIncludes));
    if (byUrl) return byUrl;
  }
  return page;
}

async function printDebugDom(page, context) {
  const frames = page.frames().map((f, idx) => ({ index: idx, name: f.name(), url: f.url() }));
  console.log("Frames discovered:", JSON.stringify(frames, null, 2));

  const summary = await context.evaluate(() => {
    const collect = (selector) =>
      Array.from(document.querySelectorAll(selector))
        .slice(0, 20)
        .map((el) => ({
          tag: el.tagName,
          id: el.id || "",
          name: el.getAttribute("name") || "",
          className: (el.getAttribute("class") || "").split(/\s+/).slice(0, 3).join(" "),
        }));
    return {
      selects: collect("select"),
      inputs: collect("input"),
      buttons: collect("button, input[type='button'], input[type='submit']"),
    };
  });
  console.log("DOM selector summary:", JSON.stringify(summary, null, 2));

  for (const [idx, frame] of page.frames().entries()) {
    try {
      const frameSummary = await frame.evaluate(() => ({
        selectCount: document.querySelectorAll("select").length,
        inputCount: document.querySelectorAll("input").length,
        hasClassSearchToken: document.body ? /Class Search|Search for Classes/i.test(document.body.innerText) : false,
      }));
      console.log(
        `Frame[${idx}] summary: ${JSON.stringify({
          name: frame.name(),
          url: frame.url(),
          ...frameSummary,
        })}`,
      );
    } catch (error) {
      console.log(`Frame[${idx}] summary unavailable: ${error.message}`);
    }
  }
}

async function resolveBestContext(page, config) {
  const configured = resolveContext(page, config);
  const subjectSelector = config?.selectors?.subject?.query;
  if (!subjectSelector) return configured;

  try {
    if (await configured.$(subjectSelector)) return configured;
  } catch (_) {}

  for (const frame of page.frames()) {
    try {
      if (await frame.$(subjectSelector)) {
        return frame;
      }
    } catch (_) {}
  }

  return configured;
}

function toCourseCsvRow(record) {
  const cls = record.subject && record.catalog ? `${record.subject} ${record.catalog}` : record.rawCode || "";
  return {
    Class: cls,
    Section: record.section || "TBA",
    "Days & Times": record.daysTimes || "",
    Room: record.room || "",
    Instructor: record.instructor || "TBA",
    "Meeting Dates": record.meetingDates || "",
    Status: record.status || "",
  };
}

function dedupeRecords(records) {
  const seen = new Set();
  return records.filter((r) => {
    const key = [
      (r.term || "").toUpperCase(),
      normalizeCode(`${r.subject || ""} ${r.catalog || ""}`),
      (r.section || "").toUpperCase(),
      (r.classNbr || "").toUpperCase(),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const config = mustReadJson(args.config);
  const missing = mustReadJson(args.missing);
  const codes = (missing.missingCodes || []).filter(Boolean);
  const targetCodes = Number.isFinite(args.limit) && args.limit > 0 ? codes.slice(0, args.limit) : codes;

  if (targetCodes.length === 0) {
    console.log("No missing codes found in input file.");
    return;
  }

  const chromePath =
    process.env.CHROME_PATH ||
    config.chromeExecutablePath ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

  const browser = await puppeteer.launch({
    headless: !args.headful,
    executablePath: chromePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(config.defaultTimeoutMs || 30000);

  const termValues = Array.isArray(config.termValues)
    ? config.termValues.filter(Boolean)
    : config.termValue
      ? [config.termValue]
      : [""];
  const scraped = [];

  try {
    await page.goto(config.baseUrl, { waitUntil: "networkidle2" });
    await runPreNavigationClicks(page, config);
    let context = await resolveBestContext(page, config);

    if (args.debugDom) {
      await printDebugDom(page, context);
    }
    await ensureSearchFormVisible(context, config.selectors);

    for (const term of termValues) {
      context = await resolveBestContext(page, config);
      await ensureSearchFormVisible(context, config.selectors);
      if (term) {
        try {
          await setField(context, config.selectors.term, term);
          if (config.selectors.term?.submitAfterSet && config.selectors.searchButton) {
            await clickIfPresent(context, config.selectors.searchButton);
          }
          console.log(`Using term: ${term}`);
        } catch (error) {
          if (config.selectors.term?.optional) {
            console.warn(`Optional term selector not found: ${config.selectors.term?.query}`);
          } else {
            throw error;
          }
        }
      }

      for (const code of targetCodes) {
        context = await resolveBestContext(page, config);
        await ensureSearchFormVisible(context, config.selectors);

        const { subject, catalog, raw } = splitCode(code);
        if (!subject || !catalog) {
          console.warn(`Skipping invalid code format: ${code}`);
          continue;
        }

        if (config.selectors.clearButton) {
          await clickIfPresent(context, config.selectors.clearButton);
        }

        try {
          await setField(context, config.selectors.subject, subject);
        } catch (error) {
          if (config.selectors.subjectCode) {
            console.warn(`Subject dropdown did not accept "${subject}". Falling back to subjectCode input.`);
            await setField(context, config.selectors.subjectCode, subject);
          } else {
            throw error;
          }
        }
        await setField(context, config.selectors.catalog, catalog);

        if (!config.selectors.searchButton) {
          throw new Error("selectors.searchButton is required in config");
        }
        await clickWithRetry(context, config.selectors.searchButton, 3);

        if (config.waitAfterSearchMs) await sleep(config.waitAfterSearchMs);

        if (config.selectors.resultsRow) {
          await context.waitForSelector("body", { timeout: config.resultTimeoutMs || 15000 });
        }

        const foundRows = (await scrapeRows(context, config.selectors, term)).map((row) => ({
          ...row,
          subject: row.subject || subject,
          catalog: row.catalog || catalog,
        }));
        const matchingRows = foundRows.filter(
          (r) => normalizeCode(`${r.subject} ${r.catalog}`) === normalizeCode(`${subject} ${catalog}`),
        );

        if (matchingRows.length === 0) {
          console.log(`No rows found for ${subject} ${catalog}${term ? ` (${term})` : ""}`);
        } else {
          console.log(`Found ${matchingRows.length} section(s) for ${subject} ${catalog}${term ? ` (${term})` : ""}`);
        }

        matchingRows.forEach((row) => scraped.push({ ...row, rawCode: raw }));
      }
    }
  } finally {
    await browser.close();
  }

  const deduped = dedupeRecords(scraped);
  fs.writeFileSync(args.output, `${JSON.stringify(deduped, null, 2)}\n`, "utf8");
  console.log(`Wrote scraped records: ${deduped.length} -> ${path.relative(ROOT, args.output)}`);

  if (args.dryRun) {
    console.log("Dry run enabled; courses.csv not modified.");
    return;
  }

  const { headers, rows } = readCsv(args.csv);
  if (headers.length === 0) {
    throw new Error(`courses.csv has no header row: ${args.csv}`);
  }

  const existingKeys = new Set(
    rows.map((r) =>
      [
        normalizeCode(r.Class || ""),
        (r.Section || "").toUpperCase(),
        (r["Meeting Dates"] || "").toUpperCase(),
      ].join("|"),
    ),
  );

  let appended = 0;
  deduped.forEach((record) => {
    const csvRow = toCourseCsvRow(record);
    const key = [
      normalizeCode(csvRow.Class || ""),
      (csvRow.Section || "").toUpperCase(),
      (csvRow["Meeting Dates"] || "").toUpperCase(),
    ].join("|");

    if (existingKeys.has(key)) return;
    rows.push(csvRow);
    existingKeys.add(key);
    appended++;
  });

  writeCsv(args.csv, headers, rows);
  console.log(`Appended ${appended} new rows to ${path.relative(ROOT, args.csv)}`);
}

main().catch((error) => {
  console.error("Scrape failed:", error);
  process.exit(1);
});

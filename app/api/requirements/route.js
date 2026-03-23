import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DEFAULT_CS_MAJOR_KEY = "Computer Science, BS";

function loadCsGraduationConfig() {
  const csConfigPath = path.join(process.cwd(), "public", "data", "cs_graduation_requirements.json");
  if (!fs.existsSync(csConfigPath)) {
    return null;
  }

  const raw = fs.readFileSync(csConfigPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return null;

  const majorKey = parsed.majorKey || DEFAULT_CS_MAJOR_KEY;
  const recommendedPlan = parsed.recommendedPlan;
  if (!recommendedPlan || typeof recommendedPlan !== "object") return null;

  return { majorKey, recommendedPlan };
}

/** Map scraper category key to Freshman/Sophomore/Junior/Senior */
function categoryToYear(categoryKey) {
  const k = (categoryKey || '').toLowerCase();
  if (k.startsWith('first year')) return 'Freshman';
  if (k.startsWith('second year')) return 'Sophomore';
  if (k.startsWith('third year')) return 'Junior';
  if (k.startsWith('fourth year')) return 'Senior';
  return null;
}

/**
 * Transform scraper output (array of { program, categories: { "First Year, Fall Semester": [{ code, name }], ... } })
 * into scheduler format: { "Major Name, BS": { Freshman: ["CODE1", ...], Sophomore: [...], ... }, ... }
 */
function transformScraperToSchedulerFormat(reqData) {
  const result = {};
  const years = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

  reqData.forEach((program) => {
    if (!program.program || !program.categories) return;

    const majorKey = program.program.includes(',') ? program.program : `${program.program}, BS`;
    result[majorKey] = { Freshman: [], Sophomore: [], Junior: [], Senior: [] };

    const seenByYear = { Freshman: new Set(), Sophomore: new Set(), Junior: new Set(), Senior: new Set() };

    Object.entries(program.categories).forEach(([categoryKey, courses]) => {
      const year = categoryToYear(categoryKey);
      const list = Array.isArray(courses) ? courses : [];
      const codes = list.map((c) => (typeof c === 'string' ? c : c?.code).trim()).filter(Boolean);

      if (year && result[majorKey][year]) {
        codes.forEach((code) => {
          if (!seenByYear[year].has(code)) {
            seenByYear[year].add(code);
            result[majorKey][year].push(code);
          }
        });
      } else if (codes.length > 0) {
        // Categories that don't map to a year (electives, etc.): add to all years so they're still suggested
        years.forEach((y) => {
          codes.forEach((code) => {
            if (!seenByYear[y].has(code)) {
              seenByYear[y].add(code);
              result[majorKey][y].push(code);
            }
          });
        });
      }
    });

    // If no courses in any year, drop this major so we don't show empty options
    const hasAny = years.some((y) => result[majorKey][y].length > 0);
    if (!hasAny) delete result[majorKey];
  });

  return result;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'backend', 'data', 'ecs_requirements_cleaned.json');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Requirements data file not found. Run the scraper: cd backend && python3 src/scrapers/ecs_requirements_scraper.py' },
        { status: 404 }
      );
    }

    const fileData = fs.readFileSync(filePath, 'utf8');
    const reqData = JSON.parse(fileData);

    if (!Array.isArray(reqData)) {
      return NextResponse.json(
        { error: 'Invalid requirements data format' },
        { status: 500 }
      );
    }

    const schedulerFormat = transformScraperToSchedulerFormat(reqData);
    const csConfig = loadCsGraduationConfig();
    if (csConfig) {
      // Keep scraper majors, but override CS plan from shared JSON config.
      schedulerFormat[csConfig.majorKey] = csConfig.recommendedPlan;
    }
    console.log(`Loaded scraper requirements for ${Object.keys(schedulerFormat).length} majors`);

    return NextResponse.json(schedulerFormat);
  } catch (error) {
    console.error('Error loading requirements data:', error);
    return NextResponse.json(
      { error: 'Failed to load major requirements data: ' + error.message },
      { status: 500 }
    );
  }
}

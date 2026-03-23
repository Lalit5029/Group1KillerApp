import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const COMPUTER_SCIENCE_MAJOR_KEY = "Computer Science, BS";
const COMPUTER_SCIENCE_RECOMMENDED_PLAN = {
  Freshman: ["ECS 101", "CIS 151", "MAT 295", "WRT 105", "FYS 101", "CIS 252", "MAT 296", "PHI 251", "PHY 211", "PHY 221"],
  Sophomore: ["CIS 375", "CIS 351", "MAT 397", "PHY 212", "PHY 222", "CIS 321", "CIS 341", "CIS 352", "CSE 384", "WRT 205"],
  Junior: ["CIS 453", "CIS 477", "CSE 486", "CIS 473", "CIS 454"],
  Senior: ["ECS 392"],
};

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
    // Keep scraper majors, but enforce the advisor-approved CS plan for this project focus.
    schedulerFormat[COMPUTER_SCIENCE_MAJOR_KEY] = COMPUTER_SCIENCE_RECOMMENDED_PLAN;
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

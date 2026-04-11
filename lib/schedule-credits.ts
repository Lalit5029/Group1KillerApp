import type { Course, SelectedCourse } from "@/lib/types";

/**
 * Credits for CS BS workload / graduation-path courses when the catalog row has no credits.
 * (Avoids treating every 4xx course as 4 cr — e.g. CIS 400 topical sections are 3 cr.)
 */
const PLAN_COURSE_CREDITS: Record<string, number> = {
  "ECS 101": 3,
  "CIS 151": 3,
  "MAT 295": 4,
  "MAT 296": 4,
  "FYS 101": 1,
  "WRT 105": 3,
  "WRT 205": 3,
  "ECN 101": 3,
  "ECN 102": 3,
  "ECN 304": 3,
  "ECN 311": 3,
  "ECN 495": 3,
  "CIS 252": 4,
  "PHY 211": 4,
  "PHI 251": 3,
  "SOC 281": 3,
  "CIS 375": 3,
  "CIS 351": 3,
  "MAT 331": 3,
  "MAT 397": 4,
  "IST 344": 3,
  "CHE 106": 3,
  "CIS 321": 3,
  "CIS 341": 3,
  "CIS 352": 3,
  "CSE 384": 3,
  "CIS 400": 3,
  "CIS 453": 3,
  "CIS 477": 3,
  "CSE 486": 3,
  "HST 122": 3,
  "CIS 473": 3,
  "CIS 454": 3,
  "CIS 442": 3,
  "ANT 111": 3,
  "ECS 392": 3,
  "PHI 378": 3,
  "PHI 451": 3,
  "PSY 205": 3,
  "ANT 121": 3,
  "PHI 107": 3,
};

/** Credit estimate aligned with course-scheduler logic (explicit credits or 3/4 by course number). */
export function estimateSectionCredits(
  courseCode: string,
  section?: Partial<Course> & { credits?: string }
): number {
  const norm = courseCode.trim().toUpperCase().replace(/\s+/g, " ");
  const sectionLabel = String(section?.Section || "").toUpperCase();

  // Labs and CS BS plan codes win over catalog/section.credits (often missing or wrong).
  if (norm === "PHY 221" || norm === "CHE 107") {
    return 1;
  }
  if (norm === "PHY 211" && /-REC\b|-LAB\b/.test(sectionLabel)) {
    return 0;
  }
  const planCredits = PLAN_COURSE_CREDITS[norm];
  if (planCredits !== undefined) {
    return planCredits;
  }

  const explicitCredits = Number.parseFloat(String(section?.credits || ""));
  if (!Number.isNaN(explicitCredits) && explicitCredits > 0) {
    return explicitCredits;
  }

  const codeMatch = courseCode.match(/\b(\d{3})\b/);
  const courseNumber = codeMatch ? Number.parseInt(codeMatch[1], 10) : NaN;
  if (Number.isNaN(courseNumber)) {
    return 3;
  }

  return courseNumber >= 400 ? 4 : 3;
}

export function sumSelectedCredits(selected: SelectedCourse[], catalog: Course[]): number {
  let total = 0;
  for (const s of selected) {
    const catalogMatch = catalog.find((c) => c.Class === s.Class && c.Section === s.Section);
    total += estimateSectionCredits(s.Class || "", catalogMatch || s);
  }
  return Math.round(total * 10) / 10;
}

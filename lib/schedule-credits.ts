import type { Course, SelectedCourse } from "@/lib/types";

/** Credit estimate aligned with course-scheduler logic (explicit credits or 3/4 by course number). */
export function estimateSectionCredits(
  courseCode: string,
  section?: Partial<Course> & { credits?: string }
): number {
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

import type { Course, CourseSearchCriteria } from "@/lib/types";

/** Build a single search string from all criteria fields (same behavior as the course scheduler). */
export function buildSearchQueryFromCriteria(criteria: CourseSearchCriteria): string {
  return [
    criteria.query,
    criteria.subject,
    criteria.courseNumber,
    criteria.instructor,
    criteria.section,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Return courses matching the combined criteria (code, instructor, section, days, room).
 */
export function filterCoursesByCriteria(
  courses: Course[],
  criteria: CourseSearchCriteria
): Course[] {
  const query = buildSearchQueryFromCriteria(criteria);
  if (!query.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase();

  const results = courses.filter((c) => {
    if (c.Class?.toLowerCase().includes(queryLower)) return true;
    if (c.Instructor?.toLowerCase().includes(queryLower)) return true;
    if (c.Section?.toLowerCase().includes(queryLower)) return true;
    if (c.DaysTimes?.toLowerCase().includes(queryLower)) return true;
    if (c.Room?.toLowerCase().includes(queryLower)) return true;
    return false;
  });

  results.sort((a, b) => {
    const aClass = a.Class?.toLowerCase() ?? "";
    const bClass = b.Class?.toLowerCase() ?? "";
    const aStarts = aClass.startsWith(queryLower) ? 0 : 1;
    const bStarts = bClass.startsWith(queryLower) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    const aExact = aClass === queryLower ? 0 : 1;
    const bExact = bClass === queryLower ? 0 : 1;
    return aExact - bExact;
  });

  return results;
}

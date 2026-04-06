import { COURSE_DEPENDENCY_CATALOG } from "./course-dependency-catalog";
import type {
  AcademicCourseRecord,
  CandidateCourse,
  CatalogSectionRecord,
  PyReasonFactCollection,
  PyReasonPayload,
  RequirementBlockRecord,
  RequirementClause,
} from "./types";

const YEAR_ORDER = ["Freshman", "Sophomore", "Junior", "Senior"];

const PASSING_GRADES = new Set([
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
]);

/**
 * Normalize a course code so the same course can be matched across transcript,
 * requirements text, and section data.
 */
export function normalizeCourseCode(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Extract course codes from requirement strings. This lets us support entries
 * like "MAT 397 or MAT 331" without pretending the source data is already
 * normalized.
 */
export function extractCourseCodesFromText(value: string | null | undefined): string[] {
  const matches = String(value || "")
    .toUpperCase()
    .match(/[A-Z]{2,4}\s*\d{3}/g);

  if (!matches) return [];
  return Array.from(new Set(matches.map((entry) => normalizeCourseCode(entry))));
}

function bestGradeByCourse(courses: AcademicCourseRecord[]) {
  const ranking = new Map<string, number>([
    ["A+", 13],
    ["A", 12],
    ["A-", 11],
    ["B+", 10],
    ["B", 9],
    ["B-", 8],
    ["C+", 7],
    ["C", 6],
    ["C-", 5],
    ["D+", 4],
    ["D", 3],
    ["D-", 2],
    ["F", 1],
    ["IP", 0],
    ["WD", 0],
  ]);

  const best = new Map<string, string>();
  for (const course of courses) {
    const normalizedCode = normalizeCourseCode(course.code);
    const nextGrade = normalizeCourseCode(course.grade);
    const currentBest = best.get(normalizedCode);
    if (!currentBest) {
      best.set(normalizedCode, nextGrade);
      continue;
    }

    if ((ranking.get(nextGrade) || 0) > (ranking.get(currentBest) || 0)) {
      best.set(normalizedCode, nextGrade);
    }
  }

  return best;
}

function isPassingGrade(grade: string | null | undefined, minimumGrade = "C-") {
  const normalized = normalizeCourseCode(grade);
  const ordered = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
  const actualIndex = ordered.indexOf(normalized);
  const requiredIndex = ordered.indexOf(normalizeCourseCode(minimumGrade));

  if (actualIndex === -1 || requiredIndex === -1) {
    return PASSING_GRADES.has(normalized);
  }

  return actualIndex >= requiredIndex;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function getPlanYearsFromMajorRequirements(
  requirementsForMajor: Record<string, string[]> | undefined,
  selectedYear: string
) {
  const startIndex = Math.max(0, YEAR_ORDER.indexOf(selectedYear));
  const planYears = requirementsForMajor
    ? YEAR_ORDER.filter((year) => requirementsForMajor[year])
    : [];

  return {
    allYears: planYears,
    currentAndFutureYears: planYears.filter((year) => YEAR_ORDER.indexOf(year) >= startIndex),
  };
}

function buildCatalogIndex(catalogCourses: CatalogSectionRecord[]) {
  const index = new Map<string, CatalogSectionRecord[]>();

  for (const section of catalogCourses) {
    const code = normalizeCourseCode(section.Class);
    if (!code) continue;

    const bucket = index.get(code) || [];
    bucket.push(section);
    index.set(code, bucket);
  }

  return index;
}

function isRequirementBlockComplete(status: string | null | undefined) {
  return String(status || "").trim().toLowerCase() === "complete";
}

function deriveNeededRequirementGroups(
  courseCode: string,
  degreeRequirements: RequirementBlockRecord[]
) {
  const groups = new Set<string>();

  for (const block of degreeRequirements) {
    if (isRequirementBlockComplete(block.status)) continue;
    const blockCourseCodes = block.courses.flatMap((course) =>
      extractCourseCodesFromText(course.code || course.title)
    );
    if (blockCourseCodes.includes(courseCode)) {
      groups.add(block.title);
    }
  }

  return Array.from(groups);
}

function evaluateRequirementGroups(
  groups: RequirementClause[],
  passedCourses: Set<string>,
  inProgressCourses: Set<string>,
  minimumGrade?: string
) {
  if (groups.length === 0) {
    return {
      allSatisfied: true,
      missing: [] as string[],
    };
  }

  const missing = new Set<string>();
  let allSatisfied = true;

  for (const group of groups) {
    const normalizedCourses = group.courses.map((course) => normalizeCourseCode(course));

    if (group.type === "oneOf") {
      const satisfied = normalizedCourses.some(
        (course) => passedCourses.has(course) || inProgressCourses.has(course)
      );
      if (!satisfied) {
        allSatisfied = false;
        normalizedCourses.forEach((course) => missing.add(course));
      }
      continue;
    }

    for (const course of normalizedCourses) {
      if (!passedCourses.has(course) && !inProgressCourses.has(course)) {
        allSatisfied = false;
        missing.add(course);
      }
    }
  }

  return {
    allSatisfied,
    missing: Array.from(missing),
    minimumGrade: minimumGrade || "C-",
  };
}

/**
 * Build the PyReason payload from real student/transcript/requirement/catalog data.
 * This function intentionally precomputes prerequisite satisfaction because the
 * project does not currently have a complete authoritative prerequisite feed.
 * PyReason then reasons over these facts to produce explainable status labels.
 */
export function buildPyReasonPayload({
  studentId,
  studentName,
  selectedMajor,
  selectedYear,
  term,
  requirementsForMajor,
  academicCourses,
  degreeRequirements,
  catalogCourses,
}: {
  studentId: string;
  studentName: string;
  selectedMajor: string;
  selectedYear: string;
  term: string;
  requirementsForMajor?: Record<string, string[]>;
  academicCourses: AcademicCourseRecord[];
  degreeRequirements: RequirementBlockRecord[];
  catalogCourses: CatalogSectionRecord[];
}): PyReasonPayload {
  const catalogIndex = buildCatalogIndex(catalogCourses);
  const gradeIndex = bestGradeByCourse(academicCourses);
  const allTranscriptCodes = unique(academicCourses.map((course) => normalizeCourseCode(course.code)));

  const passedCourses = new Set(
    academicCourses
      .filter((course) => isPassingGrade(course.grade))
      .map((course) => normalizeCourseCode(course.code))
  );
  const failedCourses = new Set(
    academicCourses
      .filter((course) => normalizeCourseCode(course.grade) === "F")
      .map((course) => normalizeCourseCode(course.code))
  );
  const inProgressCourses = new Set(
    academicCourses
      .filter((course) => normalizeCourseCode(course.grade) === "IP")
      .map((course) => normalizeCourseCode(course.code))
  );

  const { allYears, currentAndFutureYears } = getPlanYearsFromMajorRequirements(
    requirementsForMajor,
    selectedYear
  );
  const selectedYearIndex = Math.max(0, YEAR_ORDER.indexOf(selectedYear));

  const planYearsByCourse = new Map<string, string[]>();
  for (const year of allYears) {
    const entries = requirementsForMajor?.[year] || [];
    for (const entry of entries) {
      for (const code of extractCourseCodesFromText(entry)) {
        const bucket = planYearsByCourse.get(code) || [];
        bucket.push(year);
        planYearsByCourse.set(code, unique(bucket));
      }
    }
  }

  const currentAndFuturePlanCodes = currentAndFutureYears.flatMap((year) =>
    (requirementsForMajor?.[year] || []).flatMap((entry) => extractCourseCodesFromText(entry))
  );
  const incompleteBlockCodes = degreeRequirements.flatMap((block) =>
    isRequirementBlockComplete(block.status)
      ? []
      : block.courses.flatMap((course) => extractCourseCodesFromText(course.code || course.title))
  );
  const hasTrackedRemainingDegreeRequirements = degreeRequirements.some(
    (block) => !isRequirementBlockComplete(block.status) && block.courses.length > 0
  );

  const candidateCodes = unique([...currentAndFuturePlanCodes, ...incompleteBlockCodes]).filter(
    (courseCode) =>
      Boolean(courseCode) &&
      !passedCourses.has(courseCode) &&
      !inProgressCourses.has(courseCode)
  );
  const allKnownDependencyCourses = unique(
    Object.entries(COURSE_DEPENDENCY_CATALOG).flatMap(([courseCode, definition]) => [
      courseCode,
      ...(definition.prerequisites || []).flatMap((group) => group.courses),
      ...(definition.corequisites || []).flatMap((group) => group.courses),
    ])
  );

  const facts: PyReasonFactCollection = {
    passed: Array.from(passedCourses).map((course) => ({ student: studentId, course })),
    failed: Array.from(failedCourses).map((course) => ({ student: studentId, course })),
    inProgress: Array.from(inProgressCourses).map((course) => ({ student: studentId, course })),
    notPassed: [],
    targetCourse: [],
    offeredIn: [],
    notOfferedIn: [],
    countsForRequirement: [],
    neededForStudent: [],
    requires: [],
    corequires: [],
    allPrereqsSatisfied: [],
    allCoreqsSatisfied: [],
    unlocks: [],
    candidateBottleneck: [],
    currentTerm: [term],
  };

  const reverseUnlockMap = new Map<string, string[]>();
  for (const [courseCode, definition] of Object.entries(COURSE_DEPENDENCY_CATALOG)) {
    const dependencyCourses = [
      ...(definition.prerequisites || []).flatMap((group) => group.courses),
      ...(definition.corequisites || []).flatMap((group) => group.courses),
    ];

    for (const dependencyCourse of dependencyCourses) {
      const normalizedDependency = normalizeCourseCode(dependencyCourse);
      const bucket = reverseUnlockMap.get(normalizedDependency) || [];
      bucket.push(normalizeCourseCode(courseCode));
      reverseUnlockMap.set(normalizedDependency, unique(bucket));
    }
  }

  const candidateCourses: CandidateCourse[] = candidateCodes.map((courseCode) => {
    const dependencyDefinition = COURSE_DEPENDENCY_CATALOG[courseCode];
    const prerequisiteGroups = dependencyDefinition?.prerequisites || [];
    const corequisiteGroups = dependencyDefinition?.corequisites || [];
    const minimumGrade = dependencyDefinition?.minimumGrade || "C-";

    const prereqEval = evaluateRequirementGroups(
      prerequisiteGroups,
      passedCourses,
      inProgressCourses,
      minimumGrade
    );
    const coreqEval = evaluateRequirementGroups(corequisiteGroups, passedCourses, inProgressCourses);

    const offeredSections = catalogIndex.get(courseCode) || [];
    const planYearsForCourse = planYearsByCourse.get(courseCode) || [];
    const remainingDegreeRequirementGroups = deriveNeededRequirementGroups(courseCode, degreeRequirements);
    const neededRequirementGroups =
      remainingDegreeRequirementGroups.length > 0
        ? remainingDegreeRequirementGroups
        : hasTrackedRemainingDegreeRequirements
        ? []
        : planYearsForCourse.map((year) => `${year} Plan`);
    const unlocksCourseCodes = (reverseUnlockMap.get(courseCode) || []).filter((unlockedCourse) =>
      candidateCodes.includes(unlockedCourse) || allKnownDependencyCourses.includes(unlockedCourse)
    );
    const bottleneck = unlocksCourseCodes.length >= 2;
    const planYearIndexes = planYearsForCourse
      .map((year) => YEAR_ORDER.indexOf(year))
      .filter((index) => index >= 0);
    const nearestPlanYearIndex =
      planYearIndexes.length > 0 ? Math.min(...planYearIndexes) : Number.POSITIVE_INFINITY;
    const yearPreference: CandidateCourse["yearPreference"] =
      nearestPlanYearIndex === Number.POSITIVE_INFINITY
        ? "unplanned"
        : nearestPlanYearIndex < selectedYearIndex
        ? "past"
        : nearestPlanYearIndex === selectedYearIndex
        ? "current"
        : "future";

    facts.targetCourse.push({ student: studentId, course: courseCode });

    if (offeredSections.length > 0) {
      facts.offeredIn.push({ course: courseCode, term });
    } else {
      facts.notOfferedIn.push({ course: courseCode, term });
    }

    neededRequirementGroups.forEach((requirement) => {
      facts.countsForRequirement.push({ course: courseCode, requirement });
      facts.neededForStudent.push({ student: studentId, requirement });
    });

    prerequisiteGroups.forEach((group) =>
      group.courses.forEach((prerequisite) => {
        const normalizedPrerequisite = normalizeCourseCode(prerequisite);
        facts.requires.push({ course: courseCode, prerequisite: normalizedPrerequisite });
        if (!passedCourses.has(normalizedPrerequisite)) {
          facts.notPassed.push({ student: studentId, course: normalizedPrerequisite });
        }
      })
    );

    corequisiteGroups.forEach((group) =>
      group.courses.forEach((corequisite) => {
        const normalizedCorequisite = normalizeCourseCode(corequisite);
        facts.corequires.push({ course: courseCode, corequisite: normalizedCorequisite });
        if (!passedCourses.has(normalizedCorequisite) && !inProgressCourses.has(normalizedCorequisite)) {
          facts.notPassed.push({ student: studentId, course: normalizedCorequisite });
        }
      })
    );

    if (prereqEval.allSatisfied) {
      facts.allPrereqsSatisfied.push({ student: studentId, course: courseCode });
    }

    if (coreqEval.allSatisfied) {
      facts.allCoreqsSatisfied.push({ student: studentId, course: courseCode });
    }

    unlocksCourseCodes.forEach((unlockedCourse) => {
      facts.unlocks.push({ course: courseCode, unlockedCourse });
    });

    if (bottleneck) {
      facts.candidateBottleneck.push({ student: studentId, course: courseCode });
    }

    const transcriptMatch = academicCourses.find(
      (course) => normalizeCourseCode(course.code) === courseCode
    );
    const title =
      transcriptMatch?.name ||
      transcriptMatch?.title ||
      degreeRequirements
        .flatMap((block) => block.courses)
        .find((course) => normalizeCourseCode(course.code) === courseCode)
        ?.title ||
      courseCode;

    return {
      courseCode,
      title,
      planYears: planYearsForCourse,
      neededRequirementGroups,
      remainingDegreeRequirementGroups,
      yearPreference,
      offeredThisTerm: offeredSections.length > 0,
      availableSectionCount: offeredSections.length,
      prerequisiteGroups,
      corequisiteGroups,
      missingPrereqs: prereqEval.missing,
      missingCoreqs: coreqEval.missing,
      allPrereqsSatisfied: prereqEval.allSatisfied,
      allCoreqsSatisfied: coreqEval.allSatisfied,
      unlocksCourseCodes,
      unlockCount: unlocksCourseCodes.length,
      bottleneck,
    };
  });

  return {
    studentId,
    studentName,
    selectedMajor,
    selectedYear,
    term,
    completedCourses: Array.from(passedCourses),
    failedCourses: Array.from(failedCourses),
    inProgressCourses: Array.from(inProgressCourses),
    candidateCourses,
    facts,
  };
}

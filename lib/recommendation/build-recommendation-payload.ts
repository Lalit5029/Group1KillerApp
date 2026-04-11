import { COURSE_DEPENDENCY_CATALOG } from "./course-dependency-catalog";
import { PLAN_SEMESTER_ORDER } from "@/lib/plan-semester";
import type {
  AcademicCourseRecord,
  CandidateCourse,
  CatalogSectionRecord,
  RecommendationFactCollection,
  RecommendationPayload,
  RequirementBlockRecord,
  RequirementClause,
} from "./types";
import { buildProgramCandidatePools } from "@/lib/program-rules/build-candidate-pools";
import { evaluateDegreeProgress } from "@/lib/program-rules/evaluate-degree-progress";
import type { ProgramRules } from "@/lib/program-rules/types";

const LEGACY_YEAR_ORDER = ["Freshman", "Sophomore", "Junior", "Senior"];

function resolvePlanOrder(requirementsForMajor?: Record<string, string[]>): string[] {
  const keys = Object.keys(requirementsForMajor || {});
  const hasSemesterKeys = keys.some((k) =>
    (PLAN_SEMESTER_ORDER as readonly string[]).includes(k)
  );
  if (hasSemesterKeys) {
    return PLAN_SEMESTER_ORDER.filter((k) => keys.includes(k));
  }
  return LEGACY_YEAR_ORDER.filter((k) => keys.includes(k));
}

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

const CS_UPPER_DIVISION_PREFIXES = new Set(["CIS", "CSE"]);
const MIN_STRICT_ROADMAP_POOL = 2;
const MIN_COMBINED_CANDIDATE_POOL = 4;

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

function isFlexibleRoadmapEntry(entry: string | null | undefined) {
  const normalized = String(entry || "").trim().toLowerCase();
  return (
    normalized.includes("free elective") ||
    normalized.includes("ssh distribution") ||
    normalized.includes("social sciences & humanities") ||
    normalized.includes("e.g.")
  );
}

function parseCourseCodeParts(courseCode: string) {
  const normalized = normalizeCourseCode(courseCode);
  const match = normalized.match(/^([A-Z]{2,4})\s+(\d{3})/);
  if (!match) {
    return null;
  }

  return {
    subject: match[1],
    number: Number(match[2]),
  };
}

function getPlanYearsFromMajorRequirements(
  requirementsForMajor: Record<string, string[]> | undefined,
  selectedYear: string
) {
  const order = resolvePlanOrder(requirementsForMajor);
  const planYears = requirementsForMajor ? order.filter((year) => requirementsForMajor[year]) : [];
  const startIndex = Math.max(0, order.indexOf(selectedYear));

  return {
    planOrder: order,
    allYears: planYears,
    currentAndFutureYears: planYears.filter((year) => order.indexOf(year) >= startIndex),
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

/** DegreeWorks / import titles for the CS social sciences & humanities bucket. */
function isSshRequirementBlockTitle(title: string | null | undefined) {
  const t = String(title || "").toLowerCase();
  if (/\bssh\b/.test(t)) return true;
  return /social\s+science/.test(t) && /humanit/.test(t);
}

function isEcnCourseCode(courseCode: string) {
  return /^ECN\s+\d/.test(normalizeCourseCode(courseCode));
}

function deriveNeededRequirementGroups(
  courseCode: string,
  degreeRequirements: RequirementBlockRecord[]
) {
  const groups = new Set<string>();
  const ecn = isEcnCourseCode(courseCode);

  for (const block of degreeRequirements) {
    if (isRequirementBlockComplete(block.status)) continue;
    const blockCourseCodes = block.courses.flatMap((course) =>
      extractCourseCodesFromText(course.code || course.title)
    );
    if (blockCourseCodes.includes(courseCode)) {
      groups.add(block.title);
    }
    if (ecn && isSshRequirementBlockTitle(block.title)) {
      groups.add(block.title);
    }
  }

  return Array.from(groups);
}

function deriveBucketFallbackGroups(
  courseCode: string,
  degreeRequirements: RequirementBlockRecord[],
  selectedMajor: string
) {
  const groups = new Set<string>();
  const parts = parseCourseCodeParts(courseCode);
  if (!parts) {
    return [];
  }

  for (const block of degreeRequirements) {
    if (isRequirementBlockComplete(block.status)) continue;

    const normalizedTitle = String(block.title || "").trim().toLowerCase();
    const hasExplicitCodes = block.courses.some(
      (course) => extractCourseCodesFromText(course.code || course.title).length > 0
    );

    if (hasExplicitCodes) {
      continue;
    }

    if (/upper division cis/i.test(normalizedTitle)) {
      if (CS_UPPER_DIVISION_PREFIXES.has(parts.subject) && parts.number >= 400) {
        groups.add(block.title);
      }
      continue;
    }

    if (/upper division courses/i.test(normalizedTitle) && /computer science/i.test(selectedMajor)) {
      if (CS_UPPER_DIVISION_PREFIXES.has(parts.subject) && parts.number >= 400) {
        groups.add(block.title);
      }
      continue;
    }
  }

  return Array.from(groups);
}

function inferFallbackRequirementPriorityCategory(
  courseCode: string,
  remainingDegreeRequirementGroups: string[]
): CandidateCourse["requirementPriorityCategory"] {
  const normalizedGroups = remainingDegreeRequirementGroups.map((group) =>
    String(group || "").trim().toLowerCase()
  );
  const parts = parseCourseCodeParts(courseCode);

  if (
    normalizedGroups.some(
      (group) =>
        group.includes("core") ||
        group.includes("major") ||
        group.includes("writing") ||
        group.includes("mathematics") ||
        group.includes("natural science") ||
        group.includes("presentation")
    )
  ) {
    return "required_courses";
  }

  if (
    normalizedGroups.some((group) => group.includes("upper division")) ||
    (parts && ["CIS", "CSE"].includes(parts.subject) && parts.number >= 400)
  ) {
    return "upper_division_cs";
  }

  if (
    normalizedGroups.some(
      (group) => group.includes("ssh") || group.includes("humanities") || group.includes("social")
    )
  ) {
    return "ssh_distribution";
  }

  if (normalizedGroups.some((group) => group.includes("free elective"))) {
    return "free_electives";
  }

  return "unclassified";
}

function derivePriorityCategoryFromSourcePools(
  sourcePoolIds: string[]
): CandidateCourse["requirementPriorityCategory"] {
  if (sourcePoolIds.includes("required_courses")) return "required_courses";
  if (sourcePoolIds.includes("upper_division_cs")) return "upper_division_cs";
  if (sourcePoolIds.includes("ssh_distribution")) return "ssh_distribution";
  if (sourcePoolIds.includes("free_electives")) return "free_electives";
  return "unclassified";
}

function deriveFallbackCandidateCodesFromDegreeBuckets(
  degreeRequirements: RequirementBlockRecord[],
  catalogCourses: CatalogSectionRecord[],
  selectedMajor: string
) {
  const fallbackCodes = new Set<string>();

  for (const block of degreeRequirements) {
    if (isRequirementBlockComplete(block.status)) continue;

    const normalizedTitle = String(block.title || "").trim().toLowerCase();
    const hasExplicitCodes = block.courses.some(
      (course) => extractCourseCodesFromText(course.code || course.title).length > 0
    );

    if (hasExplicitCodes) {
      continue;
    }

    if (/upper division cis/i.test(normalizedTitle)) {
      for (const section of catalogCourses) {
        const code = normalizeCourseCode(section.Class);
        const parts = parseCourseCodeParts(code);
        if (!parts) continue;
        if (CS_UPPER_DIVISION_PREFIXES.has(parts.subject) && parts.number >= 400) {
          fallbackCodes.add(code);
        }
      }
      continue;
    }

    if (/upper division courses/i.test(normalizedTitle) && /computer science/i.test(selectedMajor)) {
      for (const section of catalogCourses) {
        const code = normalizeCourseCode(section.Class);
        const parts = parseCourseCodeParts(code);
        if (!parts) continue;
        if (CS_UPPER_DIVISION_PREFIXES.has(parts.subject) && parts.number >= 400) {
          fallbackCodes.add(code);
        }
      }
    }
  }

  return Array.from(fallbackCodes);
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
 * Build the recommendation payload from real student/transcript/requirement/catalog data.
 * This function intentionally precomputes prerequisite satisfaction because the
 * project does not currently have a complete authoritative prerequisite feed.
 * The deterministic reasoner then labels and ranks these candidate courses.
 */
export function buildRecommendationPayload({
  studentId,
  studentName,
  selectedMajor,
  selectedYear,
  term,
  requirementsForMajor,
  programRules,
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
  programRules?: ProgramRules | null;
  academicCourses: AcademicCourseRecord[];
  degreeRequirements: RequirementBlockRecord[];
  catalogCourses: CatalogSectionRecord[];
}): RecommendationPayload {
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

  const { planOrder, allYears, currentAndFutureYears } = getPlanYearsFromMajorRequirements(
    requirementsForMajor,
    selectedYear
  );
  const selectedYearIndex = Math.max(0, planOrder.indexOf(selectedYear));
  const seniorYearIndex = planOrder.includes("Senior")
    ? planOrder.indexOf("Senior")
    : Math.max(0, planOrder.length - 1);

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

  const strictPlanCodes = currentAndFutureYears.flatMap((year) =>
    (requirementsForMajor?.[year] || [])
      .filter((entry) => !isFlexibleRoadmapEntry(entry))
      .flatMap((entry) => extractCourseCodesFromText(entry))
  );
  const flexiblePlanCodes = currentAndFutureYears.flatMap((year) =>
    (requirementsForMajor?.[year] || [])
      .filter((entry) => isFlexibleRoadmapEntry(entry))
      .flatMap((entry) => extractCourseCodesFromText(entry))
  );
  const incompleteBlockCodes = degreeRequirements.flatMap((block) =>
    isRequirementBlockComplete(block.status)
      ? []
      : block.courses.flatMap((course) => extractCourseCodesFromText(course.code || course.title))
  );
  const hasTrackedRemainingDegreeRequirements = degreeRequirements.some(
    (block) => !isRequirementBlockComplete(block.status) && block.courses.length > 0
  );

  const fallbackBucketCodes = deriveFallbackCandidateCodesFromDegreeBuckets(
    degreeRequirements,
    catalogCourses,
    selectedMajor
  );

  const degreeDrivenCandidateCodes = unique([...incompleteBlockCodes, ...fallbackBucketCodes]);
  const primaryCandidateCodes =
    degreeDrivenCandidateCodes.length > 0
      ? selectedYearIndex >= seniorYearIndex
        ? unique([...degreeDrivenCandidateCodes, ...strictPlanCodes])
        : degreeDrivenCandidateCodes
      : unique(
          strictPlanCodes.length > 0
            ? [...strictPlanCodes, ...fallbackBucketCodes]
            : [...flexiblePlanCodes, ...fallbackBucketCodes]
        );

  const shouldSupplementWithFlexibleCandidates =
    (degreeDrivenCandidateCodes.length > 0 &&
      selectedYearIndex >= seniorYearIndex &&
      primaryCandidateCodes.length < MIN_COMBINED_CANDIDATE_POOL) ||
    (degreeDrivenCandidateCodes.length === 0 &&
      strictPlanCodes.length > 0 &&
      strictPlanCodes.length < MIN_STRICT_ROADMAP_POOL);

  const candidateSeedCodes = shouldSupplementWithFlexibleCandidates
    ? unique([...primaryCandidateCodes, ...flexiblePlanCodes])
    : primaryCandidateCodes;

  const sshBlockIncomplete = degreeRequirements.some(
    (block) => !isRequirementBlockComplete(block.status) && isSshRequirementBlockTitle(block.title)
  );
  const catalogEcnCodes = sshBlockIncomplete
    ? Array.from(catalogIndex.keys()).filter((code) => isEcnCourseCode(code))
    : [];

  const candidateCodes = unique([...candidateSeedCodes, ...catalogEcnCodes]).filter(
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

  let structuredCandidatePool: CandidateCourse[] | null = null;
  if (programRules) {
    const progressSummary = evaluateDegreeProgress({
      programRules,
      academicCourses,
    });
    const candidatePools = buildProgramCandidatePools({
      programRules,
      academicCourses,
      catalogCourses,
    });
    const incompleteRequirementIds = new Set(progressSummary.incompleteRequirementGroupIds);
    const requirementTitleById = new Map(
      progressSummary.requirementProgress.map((group) => [group.requirementGroupId, group.title])
    );

    const programRoadmap = programRules.roadmap || {};
    const roadmapYears = Object.keys(programRoadmap);
    const roadmapYearsByCourse = new Map<string, string[]>();
    for (const year of roadmapYears) {
      for (const courseCode of programRoadmap[year] || []) {
        const normalizedCode = normalizeCourseCode(courseCode);
        const bucket = roadmapYearsByCourse.get(normalizedCode) || [];
        bucket.push(year);
        roadmapYearsByCourse.set(normalizedCode, unique(bucket));
      }
    }

    const activeProgramCandidates = candidatePools.allCandidates.filter((candidate) =>
      candidate.requirementGroupIds.some((groupId) => incompleteRequirementIds.has(groupId))
    );

    structuredCandidatePool = activeProgramCandidates.map((candidate) => {
      const courseCode = normalizeCourseCode(candidate.courseCode);
      const dependencyDefinition = COURSE_DEPENDENCY_CATALOG[courseCode];
      const prerequisiteGroups = dependencyDefinition?.prerequisites || [];
      const corequisiteGroups = dependencyDefinition?.corequisites || [];
      const minimumGrade = dependencyDefinition?.minimumGrade || programRules.gradePolicies.defaultMinimumGrade || "C-";

      const prereqEval = evaluateRequirementGroups(
        prerequisiteGroups,
        passedCourses,
        inProgressCourses,
        minimumGrade
      );
      const coreqEval = evaluateRequirementGroups(corequisiteGroups, passedCourses, inProgressCourses);

      const planYearsForCourse = roadmapYearsByCourse.get(courseCode) || [];
      const remainingDegreeRequirementGroups = unique(
        candidate.requirementGroupIds
          .filter((groupId) => incompleteRequirementIds.has(groupId))
          .map((groupId) => requirementTitleById.get(groupId) || groupId)
      );
      const neededRequirementGroups = remainingDegreeRequirementGroups;
      const unlocksCourseCodes = (reverseUnlockMap.get(courseCode) || []).filter((unlockedCourse) =>
        activeProgramCandidates.some((item) => normalizeCourseCode(item.courseCode) === unlockedCourse) ||
        allKnownDependencyCourses.includes(unlockedCourse)
      );
      const bottleneck = unlocksCourseCodes.length >= 2;
      const planYearIndexes = planYearsForCourse
        .map((year) => planOrder.indexOf(year))
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

      return {
        courseCode,
        title: candidate.title,
        sourcePoolIds: candidate.sourcePoolIds,
        requirementPriorityCategory: derivePriorityCategoryFromSourcePools(candidate.sourcePoolIds),
        planYears: planYearsForCourse,
        neededRequirementGroups,
        remainingDegreeRequirementGroups,
        yearPreference,
        offeredThisTerm: candidate.offeredThisTerm,
        availableSectionCount: candidate.availableSectionCount,
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
  }

  const facts: RecommendationFactCollection = {
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

  const candidateCourses: CandidateCourse[] = structuredCandidatePool || candidateCodes.map((courseCode) => {
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
    const remainingDegreeRequirementGroups = unique([
      ...deriveNeededRequirementGroups(courseCode, degreeRequirements),
      ...deriveBucketFallbackGroups(courseCode, degreeRequirements, selectedMajor),
    ]);
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
      .map((year) => planOrder.indexOf(year))
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
      sourcePoolIds: [],
      requirementPriorityCategory: inferFallbackRequirementPriorityCategory(
        courseCode,
        remainingDegreeRequirementGroups
      ),
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

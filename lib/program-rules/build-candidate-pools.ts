import type { AcademicCourseRecord, CatalogSectionRecord } from "@/lib/recommendation/types";
import type {
  AllOfRequirementRule,
  CandidatePoolRule,
  ChooseNRequirementRule,
  ProgramCandidateCourse,
  ProgramCandidatePools,
  ProgramRequirementRule,
  ProgramRules,
} from "./types";

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

function normalizeCourseCode(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
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

function buildTranscriptSets(
  academicCourses: AcademicCourseRecord[],
  defaultMinimumGrade: string
) {
  const passedCourses = new Set(
    academicCourses
      .filter((course) => isPassingGrade(course.grade, defaultMinimumGrade))
      .map((course) => normalizeCourseCode(course.code))
  );

  const inProgressCourses = new Set(
    academicCourses
      .filter((course) => normalizeCourseCode(course.grade) === "IP")
      .map((course) => normalizeCourseCode(course.code))
  );

  return { passedCourses, inProgressCourses };
}

function buildPoolCandidateSet(
  poolRule: CandidatePoolRule,
  catalogIndex: Map<string, CatalogSectionRecord[]>
) {
  const candidateCodes = new Set<string>();

  if (Array.isArray(poolRule.allowedCourses)) {
    for (const courseCode of poolRule.allowedCourses) {
      const normalized = normalizeCourseCode(courseCode);
      if (catalogIndex.has(normalized)) {
        candidateCodes.add(normalized);
      }
    }
  }

  if (Array.isArray(poolRule.subjects) || typeof poolRule.minCourseNumber === "number") {
    for (const courseCode of catalogIndex.keys()) {
      const parts = parseCourseCodeParts(courseCode);
      if (!parts) continue;

      if (Array.isArray(poolRule.subjects) && !poolRule.subjects.includes(parts.subject)) {
        continue;
      }

      if (
        typeof poolRule.minCourseNumber === "number" &&
        parts.number < poolRule.minCourseNumber
      ) {
        continue;
      }

      if (
        typeof poolRule.maxCourseNumber === "number" &&
        parts.number > poolRule.maxCourseNumber
      ) {
        continue;
      }

      candidateCodes.add(courseCode);
    }
  }

  return Array.from(candidateCodes);
}

function addCandidate(
  target: Map<string, ProgramCandidateCourse>,
  courseCode: string,
  catalogIndex: Map<string, CatalogSectionRecord[]>,
  requirementGroupId: string,
  sourcePoolId: string
) {
  const normalizedCode = normalizeCourseCode(courseCode);
  const offeredSections = catalogIndex.get(normalizedCode) || [];
  const existing = target.get(normalizedCode);

  if (existing) {
    existing.requirementGroupIds = unique([...existing.requirementGroupIds, requirementGroupId]);
    existing.sourcePoolIds = unique([...existing.sourcePoolIds, sourcePoolId]);
    return;
  }

  target.set(normalizedCode, {
    courseCode: normalizedCode,
    title: normalizedCode,
    offeredThisTerm: offeredSections.length > 0,
    availableSectionCount: offeredSections.length,
    requirementGroupIds: [requirementGroupId],
    sourcePoolIds: [sourcePoolId],
  });
}

function collectAllOfCandidates(
  rule: AllOfRequirementRule,
  passedCourses: Set<string>,
  inProgressCourses: Set<string>,
  catalogIndex: Map<string, CatalogSectionRecord[]>,
  target: Map<string, ProgramCandidateCourse>
) {
  for (const courseCode of rule.courses) {
    const normalizedCode = normalizeCourseCode(courseCode);
    if (passedCourses.has(normalizedCode) || inProgressCourses.has(normalizedCode)) {
      continue;
    }

    addCandidate(target, normalizedCode, catalogIndex, rule.id, "required_courses");
  }
}

function collectChooseNCandidates(
  rule: ChooseNRequirementRule,
  passedCourses: Set<string>,
  inProgressCourses: Set<string>,
  catalogIndex: Map<string, CatalogSectionRecord[]>,
  target: Map<string, ProgramCandidateCourse>
) {
  const completedCount = rule.options.filter((courseCode) => {
    const normalizedCode = normalizeCourseCode(courseCode);
    return passedCourses.has(normalizedCode) || inProgressCourses.has(normalizedCode);
  }).length;

  if (completedCount >= rule.count) {
    return;
  }

  for (const courseCode of rule.options) {
    const normalizedCode = normalizeCourseCode(courseCode);
    if (passedCourses.has(normalizedCode) || inProgressCourses.has(normalizedCode)) {
      continue;
    }

    addCandidate(target, normalizedCode, catalogIndex, rule.id, "required_courses");
  }
}

function poolIdToBucketKey(poolId: string): keyof Omit<ProgramCandidatePools, "allCandidates"> | null {
  if (poolId === "upper_division_cs") return "upperDivisionCandidates";
  if (poolId === "ssh_distribution") return "sshCandidates";
  if (poolId === "free_electives") return "freeElectiveCandidates";
  return null;
}

/**
 * Phase 2: build explicit deterministic candidate pools from structured rules.
 *
 * This creates named pools before PyReason runs so the recommendation layer no
 * longer has to infer its pool from roadmap prose alone.
 */
export function buildProgramCandidatePools({
  programRules,
  academicCourses,
  catalogCourses,
}: {
  programRules: ProgramRules;
  academicCourses: AcademicCourseRecord[];
  catalogCourses: CatalogSectionRecord[];
}): ProgramCandidatePools {
  const catalogIndex = buildCatalogIndex(catalogCourses);
  const { passedCourses, inProgressCourses } = buildTranscriptSets(
    academicCourses,
    programRules.gradePolicies.defaultMinimumGrade
  );

  const requiredCourseCandidates = new Map<string, ProgramCandidateCourse>();
  const upperDivisionCandidates = new Map<string, ProgramCandidateCourse>();
  const sshCandidates = new Map<string, ProgramCandidateCourse>();
  const freeElectiveCandidates = new Map<string, ProgramCandidateCourse>();

  for (const rule of programRules.requirementGroups) {
    if (rule.kind === "all_of") {
      collectAllOfCandidates(
        rule,
        passedCourses,
        inProgressCourses,
        catalogIndex,
        requiredCourseCandidates
      );
      continue;
    }

    if (rule.kind === "choose_n") {
      collectChooseNCandidates(
        rule,
        passedCourses,
        inProgressCourses,
        catalogIndex,
        requiredCourseCandidates
      );
      continue;
    }

    const poolRule = programRules.candidatePools[rule.candidatePoolId];
    if (!poolRule) {
      continue;
    }

    const bucketKey = poolIdToBucketKey(rule.candidatePoolId);
    if (!bucketKey) {
      continue;
    }

    const bucketTarget =
      bucketKey === "upperDivisionCandidates"
        ? upperDivisionCandidates
        : bucketKey === "sshCandidates"
        ? sshCandidates
        : freeElectiveCandidates;

    const poolCandidates = buildPoolCandidateSet(poolRule, catalogIndex);
    for (const courseCode of poolCandidates) {
      if (passedCourses.has(courseCode) || inProgressCourses.has(courseCode)) {
        continue;
      }

      addCandidate(bucketTarget, courseCode, catalogIndex, rule.id, rule.candidatePoolId);
    }
  }

  const allCandidates = unique([
    ...requiredCourseCandidates.keys(),
    ...upperDivisionCandidates.keys(),
    ...sshCandidates.keys(),
    ...freeElectiveCandidates.keys(),
  ]).map((courseCode) => {
    return (
      requiredCourseCandidates.get(courseCode) ||
      upperDivisionCandidates.get(courseCode) ||
      sshCandidates.get(courseCode) ||
      freeElectiveCandidates.get(courseCode)
    ) as ProgramCandidateCourse;
  });

  return {
    requiredCourseCandidates: Array.from(requiredCourseCandidates.values()),
    upperDivisionCandidates: Array.from(upperDivisionCandidates.values()),
    sshCandidates: Array.from(sshCandidates.values()),
    freeElectiveCandidates: Array.from(freeElectiveCandidates.values()),
    allCandidates,
  };
}

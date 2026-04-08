import type { AcademicCourseRecord } from "@/lib/recommendation/types";
import type {
  AllOfRequirementRule,
  CandidatePoolRule,
  ChooseNRequirementRule,
  CreditBucketRequirementRule,
  DegreeProgressSummary,
  DegreeRequirementProgress,
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

function parseCredits(value: string | null | undefined) {
  const numeric = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildTranscriptIndexes(
  academicCourses: AcademicCourseRecord[],
  defaultMinimumGrade: string
) {
  const passedCourses = new Set<string>();
  const inProgressCourses = new Set<string>();
  const creditsByCourse = new Map<string, number>();

  for (const course of academicCourses) {
    const normalizedCode = normalizeCourseCode(course.code);
    const credits = parseCredits(course.credits);

    if (isPassingGrade(course.grade, defaultMinimumGrade)) {
      passedCourses.add(normalizedCode);
      creditsByCourse.set(
        normalizedCode,
        Math.max(creditsByCourse.get(normalizedCode) || 0, credits)
      );
      continue;
    }

    if (normalizeCourseCode(course.grade) === "IP") {
      inProgressCourses.add(normalizedCode);
      creditsByCourse.set(
        normalizedCode,
        Math.max(creditsByCourse.get(normalizedCode) || 0, credits)
      );
    }
  }

  return { passedCourses, inProgressCourses, creditsByCourse };
}

function evaluateAllOfRule(
  rule: AllOfRequirementRule,
  passedCourses: Set<string>,
  inProgressCourses: Set<string>
): DegreeRequirementProgress {
  const completedCourseCodes: string[] = [];
  const inProgressCourseCodes: string[] = [];
  const remainingCourseCodes: string[] = [];

  for (const courseCode of rule.courses) {
    const normalizedCode = normalizeCourseCode(courseCode);
    if (passedCourses.has(normalizedCode)) {
      completedCourseCodes.push(normalizedCode);
      continue;
    }
    if (inProgressCourses.has(normalizedCode)) {
      inProgressCourseCodes.push(normalizedCode);
      continue;
    }
    remainingCourseCodes.push(normalizedCode);
  }

  return {
    requirementGroupId: rule.id,
    title: rule.title,
    kind: rule.kind,
    status:
      remainingCourseCodes.length === 0
        ? inProgressCourseCodes.length > 0
          ? "in_progress"
          : "complete"
        : completedCourseCodes.length > 0 || inProgressCourseCodes.length > 0
        ? "in_progress"
        : "not_started",
    completedCourseCodes,
    inProgressCourseCodes,
    remainingCourseCodes,
    completedCount: completedCourseCodes.length,
    requiredCount: rule.courses.length,
  };
}

function evaluateChooseNRule(
  rule: ChooseNRequirementRule,
  passedCourses: Set<string>,
  inProgressCourses: Set<string>
): DegreeRequirementProgress {
  const completedCourseCodes = rule.options
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter((courseCode) => passedCourses.has(courseCode));
  const inProgressCourseCodes = rule.options
    .map((courseCode) => normalizeCourseCode(courseCode))
    .filter((courseCode) => inProgressCourses.has(courseCode) && !completedCourseCodes.includes(courseCode));

  const completedCount = completedCourseCodes.length;
  const inProgressCount = inProgressCourseCodes.length;

  return {
    requirementGroupId: rule.id,
    title: rule.title,
    kind: rule.kind,
    status:
      completedCount >= rule.count
        ? "complete"
        : completedCount + inProgressCount >= rule.count
        ? "in_progress"
        : completedCount + inProgressCount > 0
        ? "in_progress"
        : "not_started",
    completedCourseCodes,
    inProgressCourseCodes,
    remainingCourseCodes: rule.options
      .map((courseCode) => normalizeCourseCode(courseCode))
      .filter(
        (courseCode) =>
          !completedCourseCodes.includes(courseCode) &&
          !inProgressCourseCodes.includes(courseCode)
      ),
    completedCount,
    requiredCount: rule.count,
  };
}

function candidatePoolCourseCodes(
  candidatePoolId: string,
  programRules: ProgramRules,
  transcriptCourseCodes: string[]
) {
  const pool = programRules.candidatePools[candidatePoolId];
  if (!pool) {
    return [];
  }

  const candidateCodes = new Set<string>();

  if (Array.isArray(pool.allowedCourses)) {
    for (const courseCode of pool.allowedCourses) {
      candidateCodes.add(normalizeCourseCode(courseCode));
    }
  }

  if (Array.isArray(pool.subjects) || typeof pool.minCourseNumber === "number") {
    for (const courseCode of transcriptCourseCodes) {
      if (matchesCandidatePoolRule(courseCode, pool)) {
        candidateCodes.add(normalizeCourseCode(courseCode));
      }
    }
  }

  return Array.from(candidateCodes);
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

function matchesCandidatePoolRule(courseCode: string, pool: CandidatePoolRule) {
  const normalized = normalizeCourseCode(courseCode);
  const parts = parseCourseCodeParts(normalized);

  if (!parts) {
    return false;
  }

  if (Array.isArray(pool.subjects) && !pool.subjects.includes(parts.subject)) {
    return false;
  }

  if (
    typeof pool.minCourseNumber === "number" &&
    parts.number < pool.minCourseNumber
  ) {
    return false;
  }

  if (
    typeof pool.maxCourseNumber === "number" &&
    parts.number > pool.maxCourseNumber
  ) {
    return false;
  }

  return true;
}

function evaluateCreditBucketRule(
  rule: CreditBucketRequirementRule,
  passedCourses: Set<string>,
  inProgressCourses: Set<string>,
  creditsByCourse: Map<string, number>,
  programRules: ProgramRules
): DegreeRequirementProgress {
  const transcriptCourseCodes = Array.from(
    new Set([...passedCourses.values(), ...inProgressCourses.values()])
  );
  const poolCourseCodes = candidatePoolCourseCodes(
    rule.candidatePoolId,
    programRules,
    transcriptCourseCodes
  );

  const completedCourseCodes = poolCourseCodes.filter((courseCode) => passedCourses.has(courseCode));
  const inProgressCourseCodes = poolCourseCodes.filter(
    (courseCode) => inProgressCourses.has(courseCode) && !completedCourseCodes.includes(courseCode)
  );
  const remainingCourseCodes = poolCourseCodes.filter(
    (courseCode) =>
      !completedCourseCodes.includes(courseCode) &&
      !inProgressCourseCodes.includes(courseCode)
  );

  const completedCredits = completedCourseCodes.reduce(
    (sum, courseCode) => sum + (creditsByCourse.get(courseCode) || 0),
    0
  );
  const inProgressCredits = inProgressCourseCodes.reduce(
    (sum, courseCode) => sum + (creditsByCourse.get(courseCode) || 0),
    0
  );

  return {
    requirementGroupId: rule.id,
    title: rule.title,
    kind: rule.kind,
    status:
      completedCredits >= rule.minimumCredits
        ? "complete"
        : completedCredits + inProgressCredits >= rule.minimumCredits
        ? "in_progress"
        : completedCredits + inProgressCredits > 0
        ? "in_progress"
        : "not_started",
    completedCourseCodes,
    inProgressCourseCodes,
    remainingCourseCodes,
    completedCredits,
    requiredCredits: rule.minimumCredits,
    candidatePoolId: rule.candidatePoolId,
  };
}

/**
 * Phase 3: deterministically evaluate degree progress from structured rules.
 *
 * This becomes the source of truth for which requirement groups are complete,
 * in progress, or still missing before recommendation ranking happens.
 */
export function evaluateDegreeProgress({
  programRules,
  academicCourses,
}: {
  programRules: ProgramRules;
  academicCourses: AcademicCourseRecord[];
}): DegreeProgressSummary {
  const { passedCourses, inProgressCourses, creditsByCourse } = buildTranscriptIndexes(
    academicCourses,
    programRules.gradePolicies.defaultMinimumGrade
  );

  const requirementProgress: DegreeRequirementProgress[] = programRules.requirementGroups.map(
    (rule: ProgramRequirementRule) => {
      if (rule.kind === "all_of") {
        return evaluateAllOfRule(rule, passedCourses, inProgressCourses);
      }

      if (rule.kind === "choose_n") {
        return evaluateChooseNRule(rule, passedCourses, inProgressCourses);
      }

      return evaluateCreditBucketRule(
        rule,
        passedCourses,
        inProgressCourses,
        creditsByCourse,
        programRules
      );
    }
  );

  return {
    completedRequirementGroupIds: requirementProgress
      .filter((group) => group.status === "complete")
      .map((group) => group.requirementGroupId),
    inProgressRequirementGroupIds: requirementProgress
      .filter((group) => group.status === "in_progress")
      .map((group) => group.requirementGroupId),
    incompleteRequirementGroupIds: requirementProgress
      .filter((group) => group.status !== "complete")
      .map((group) => group.requirementGroupId),
    requirementProgress,
  };
}

import type { CandidateCourse, InferenceResult, RankedRecommendation } from "./types";

function buildReasons(candidate: CandidateCourse, inference: InferenceResult) {
  const reasons: string[] = [];

  if (inference.flags.eligible_now) {
    reasons.push("All known prerequisites are satisfied")
  }
  if (inference.flags.offered_this_term) {
    reasons.push("Offered in the current catalog term")
  }
  if (inference.flags.satisfies_needed_requirement) {
    reasons.push(
      candidate.remainingDegreeRequirementGroups.length > 0
        ? `Moves the student closer to graduation by fulfilling: ${candidate.remainingDegreeRequirementGroups.join(", ")}`
        : "Fulfills a remaining requirement"
    )
  }
  if (candidate.yearPreference === "current") {
    reasons.push("Fits the student's current curriculum timing")
  }
  if (candidate.yearPreference === "future" && inference.flags.eligible_now) {
    reasons.push("Ahead-of-plan option because the student is already eligible now")
  }
  if (inference.flags.unlocks_future_courses && candidate.unlockCount > 0) {
    reasons.push(`Unlocks ${candidate.unlockCount} future course${candidate.unlockCount === 1 ? "" : "s"}`)
  }
  if (inference.flags.bottleneck_course) {
    reasons.push("High sequencing importance because it is a bottleneck course")
  }
  if (inference.flags.missing_prereq && candidate.missingPrereqs.length > 0) {
    reasons.push(`Missing prerequisite${candidate.missingPrereqs.length === 1 ? "" : "s"}: ${candidate.missingPrereqs.join(", ")}`)
  }
  if (inference.flags.missing_coreq && candidate.missingCoreqs.length > 0) {
    reasons.push(`Missing co-requisite${candidate.missingCoreqs.length === 1 ? "" : "s"}: ${candidate.missingCoreqs.join(", ")}`)
  }
  if (inference.flags.not_offered_now) {
    reasons.push("Not offered in the current catalog term")
  }

  return reasons;
}

function computePriorityScore(candidate: CandidateCourse, inference: InferenceResult) {
  let score = 0;

  if (inference.flags.recommended) score += 50;
  if (inference.flags.high_priority) score += 20;
  if (inference.flags.satisfies_needed_requirement) score += 12;
  score += Math.min(18, candidate.remainingDegreeRequirementGroups.length * 6);
  if (inference.flags.offered_this_term) score += 10;
  if (inference.flags.unlocks_future_courses) score += Math.min(12, candidate.unlockCount * 4);
  if (inference.flags.bottleneck_course) score += 8;
  if (candidate.yearPreference === "current") score += 4;
  if (candidate.yearPreference === "future" && inference.flags.eligible_now) score += 2;
  if (candidate.yearPreference === "past" && inference.flags.eligible_now) score += 5;

  if (inference.flags.missing_prereq) score -= 40;
  if (inference.flags.missing_coreq) score -= 20;
  if (inference.flags.not_offered_now) score -= 35;
  if (inference.flags.blocked) score -= 25;

  return score;
}

/**
 * Convert raw inference flags into a deterministic, user-facing ranking.
 */
export function rankRecommendations(
  candidates: CandidateCourse[],
  inferences: InferenceResult[]
): RankedRecommendation[] {
  const inferenceMap = new Map(inferences.map((item) => [item.courseCode, item]));

  const ranked = candidates.map((candidate) => {
    const inference = inferenceMap.get(candidate.courseCode) || {
      courseCode: candidate.courseCode,
      rawLabels: [],
        flags: {
          eligible_now: false,
          blocked: true,
          missing_prereq: candidate.missingPrereqs.length > 0,
          missing_coreq: candidate.missingCoreqs.length > 0,
          offered_this_term: candidate.offeredThisTerm,
          not_offered_now: !candidate.offeredThisTerm,
          satisfies_needed_requirement: candidate.neededRequirementGroups.length > 0,
          high_priority: false,
          bottleneck_course: candidate.bottleneck,
          unlocks_future_courses: candidate.unlockCount > 0,
        recommended: false,
      },
    };

    const priorityScore = computePriorityScore(candidate, inference);
    const blocked =
      inference.flags.blocked ||
      inference.flags.not_offered_now ||
      inference.flags.missing_prereq ||
      inference.flags.missing_coreq;

    const status: RankedRecommendation["status"] = inference.flags.recommended
      ? "recommended"
      : blocked
      ? "blocked"
      : "eligible"

    return {
      courseId: candidate.courseCode,
      courseCode: candidate.courseCode,
      title: candidate.title,
      status,
      priorityScore,
      reasons: buildReasons(candidate, inference),
      missingPrereqs: candidate.missingPrereqs,
      missingCoreqs: candidate.missingCoreqs,
      blocked,
      offeredThisTerm: candidate.offeredThisTerm,
      availableSectionCount: candidate.availableSectionCount,
      debug: {
        flags: inference.flags,
        neededRequirementGroups: candidate.neededRequirementGroups,
        unlockCount: candidate.unlockCount,
        rawLabels: inference.rawLabels,
      },
    };
  });

  ranked.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.courseCode.localeCompare(b.courseCode);
  });

  return ranked;
}

import type { CandidateCourse, InferenceResult, RankedRecommendation } from "./types";

function parseCourseNumber(courseCode: string) {
  const match = courseCode.match(/\b(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function priorityCategoryLabel(category: CandidateCourse["requirementPriorityCategory"]) {
  switch (category) {
    case "required_courses":
      return "Required/core graduation requirement";
    case "upper_division_cs":
      return "Upper-division CS requirement";
    case "ssh_distribution":
      return "SSH distribution requirement";
    case "free_electives":
      return "Free elective requirement";
    default:
      return null;
  }
}

function buildReasons(candidate: CandidateCourse, inference: InferenceResult) {
  const reasons: string[] = [];
  const categoryLabel = priorityCategoryLabel(candidate.requirementPriorityCategory);

  if (categoryLabel) {
    reasons.push(categoryLabel);
  }

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

function buildExplanation(candidate: CandidateCourse, inference: InferenceResult) {
  const requirementCategoryLabel = priorityCategoryLabel(candidate.requirementPriorityCategory);
  const rankingHighlights: string[] = [];
  const blockingFactors: string[] = [];

  if (inference.flags.recommended) {
    rankingHighlights.push("Explicitly recommended by the reasoning layer");
  }
  if (inference.flags.eligible_now) {
    rankingHighlights.push("Eligible to take now");
  }
  if (inference.flags.offered_this_term) {
    rankingHighlights.push("Has sections in the current catalog term");
  }
  if (inference.flags.satisfies_needed_requirement) {
    rankingHighlights.push("Counts toward a remaining graduation requirement");
  }
  if (inference.flags.high_priority) {
    rankingHighlights.push("Marked high-priority by the reasoning layer");
  }
  if (inference.flags.bottleneck_course) {
    rankingHighlights.push("Sequencing bottleneck");
  }
  if (inference.flags.unlocks_future_courses && candidate.unlockCount > 0) {
    rankingHighlights.push(
      `Unlocks ${candidate.unlockCount} future course${candidate.unlockCount === 1 ? "" : "s"}`
    );
  }
  if (candidate.yearPreference === "current") {
    rankingHighlights.push("Fits the student's current curriculum timing");
  } else if (candidate.yearPreference === "future" && inference.flags.eligible_now) {
    rankingHighlights.push("Ahead-of-plan but already takeable");
  } else if (candidate.yearPreference === "past" && inference.flags.eligible_now) {
    rankingHighlights.push("Past-due requirement that can be completed now");
  }

  if (inference.flags.missing_prereq && candidate.missingPrereqs.length > 0) {
    blockingFactors.push(
      `Missing prerequisite${candidate.missingPrereqs.length === 1 ? "" : "s"}: ${candidate.missingPrereqs.join(", ")}`
    );
  }
  if (inference.flags.missing_coreq && candidate.missingCoreqs.length > 0) {
    blockingFactors.push(
      `Missing co-requisite${candidate.missingCoreqs.length === 1 ? "" : "s"}: ${candidate.missingCoreqs.join(", ")}`
    );
  }
  if (inference.flags.not_offered_now) {
    blockingFactors.push("Not offered in the current catalog term");
  }
  if (!inference.flags.offered_this_term && candidate.availableSectionCount === 0) {
    blockingFactors.push("No matching sections were found in the loaded catalog");
  }

  return {
    requirementCategoryLabel,
    servesRequirementGroups:
      candidate.remainingDegreeRequirementGroups.length > 0
        ? candidate.remainingDegreeRequirementGroups
        : candidate.neededRequirementGroups,
    sourcePoolIds: candidate.sourcePoolIds,
    rankingHighlights,
    blockingFactors,
  };
}

function computePriorityScore(candidate: CandidateCourse, inference: InferenceResult) {
  let score = 0;

  switch (candidate.requirementPriorityCategory) {
    case "required_courses":
      score += 30;
      break;
    case "upper_division_cs":
      score += 18;
      break;
    case "ssh_distribution":
      score += 8;
      break;
    case "free_electives":
      score += 2;
      break;
    default:
      break;
  }

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
  if (candidate.yearPreference === "unplanned") score -= 8;

  const courseNumber = parseCourseNumber(candidate.courseCode);
  if (candidate.requirementPriorityCategory === "upper_division_cs" && courseNumber !== null) {
    if (courseNumber >= 400 && courseNumber < 500) score += 4;
    else if (courseNumber >= 500 && courseNumber < 600) score += 2;
  }

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
      explanation: buildExplanation(candidate, inference),
      missingPrereqs: candidate.missingPrereqs,
      missingCoreqs: candidate.missingCoreqs,
      blocked,
      offeredThisTerm: candidate.offeredThisTerm,
      availableSectionCount: candidate.availableSectionCount,
      debug: {
        flags: inference.flags,
        requirementPriorityCategory: candidate.requirementPriorityCategory,
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

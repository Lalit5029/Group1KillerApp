import type { InferenceResult, PyReasonPayload } from "./types";

/**
 * Deterministic fallback reasoner.
 *
 * We prefer PyReason, but we keep a local mirror of the core inference semantics
 * so the recommendation endpoint can still respond gracefully if the Python
 * dependency is missing in a development environment.
 */
export function runFallbackReasoner(payload: PyReasonPayload): InferenceResult[] {
  return payload.candidateCourses.map((course) => {
    const missingPrereq = course.missingPrereqs.length > 0;
    const missingCoreq = course.missingCoreqs.length > 0;
    const notOffered = !course.offeredThisTerm;
    const satisfiesNeededRequirement = course.neededRequirementGroups.length > 0;
    const unlocksFuture = course.unlockCount > 0;
    const eligibleNow =
      course.allPrereqsSatisfied && course.allCoreqsSatisfied && course.offeredThisTerm;
    const highPriority =
      eligibleNow &&
      (satisfiesNeededRequirement || course.bottleneck || course.unlockCount >= 2);
    const recommended =
      eligibleNow && (satisfiesNeededRequirement || highPriority || unlocksFuture);

    return {
      courseCode: course.courseCode,
      rawLabels: [
        ...(eligibleNow ? ["eligible_now"] : []),
        ...(missingPrereq ? ["missing_prereq"] : []),
        ...(missingCoreq ? ["missing_coreq"] : []),
        ...(course.offeredThisTerm ? ["offered_this_term"] : ["not_offered_now"]),
        ...(satisfiesNeededRequirement ? ["satisfies_needed_requirement"] : []),
        ...(course.bottleneck ? ["bottleneck_course"] : []),
        ...(unlocksFuture ? ["unlocks_future_courses"] : []),
        ...(highPriority ? ["high_priority"] : []),
        ...(recommended ? ["recommended"] : []),
        ...(!eligibleNow || notOffered || missingPrereq || missingCoreq ? ["blocked"] : []),
      ],
      flags: {
        eligible_now: eligibleNow,
        blocked: !eligibleNow || notOffered || missingPrereq || missingCoreq,
        missing_prereq: missingPrereq,
        missing_coreq: missingCoreq,
        offered_this_term: course.offeredThisTerm,
        not_offered_now: notOffered,
        satisfies_needed_requirement: satisfiesNeededRequirement,
        high_priority: highPriority,
        bottleneck_course: course.bottleneck,
        unlocks_future_courses: unlocksFuture,
        recommended,
      },
    };
  });
}

import { rankRecommendations } from "./rank-recommendations";
import type { CandidateCourse, InferenceResult } from "./types";

const baseCandidate = (overrides: Partial<CandidateCourse> = {}): CandidateCourse => ({
  courseCode: "CIS 453",
  title: "CIS 453",
  sourcePoolIds: ["required_courses"],
  requirementPriorityCategory: "required_courses",
  planYears: ["Junior"],
  neededRequirementGroups: ["Junior Plan"],
  remainingDegreeRequirementGroups: ["Core Requirement"],
  yearPreference: "current",
  offeredThisTerm: true,
  availableSectionCount: 1,
  prerequisiteGroups: [],
  corequisiteGroups: [],
  missingPrereqs: [],
  missingCoreqs: [],
  allPrereqsSatisfied: true,
  allCoreqsSatisfied: true,
  unlocksCourseCodes: [],
  unlockCount: 0,
  bottleneck: false,
  ...overrides,
});

const baseInference = (courseCode: string, overrides: Partial<InferenceResult["flags"]> = {}): InferenceResult => ({
  courseCode,
  rawLabels: [],
  flags: {
    eligible_now: true,
    blocked: false,
    missing_prereq: false,
    missing_coreq: false,
    offered_this_term: true,
    not_offered_now: false,
    satisfies_needed_requirement: true,
    high_priority: false,
    bottleneck_course: false,
    unlocks_future_courses: false,
    recommended: true,
    ...overrides,
  },
});

describe("rankRecommendations", () => {
  it("keeps an eligible recommended course above a blocked course", () => {
    const ranked = rankRecommendations(
      [
        baseCandidate({ courseCode: "CIS 453" }),
        baseCandidate({
          courseCode: "CIS 454",
          missingPrereqs: ["CIS 341"],
          allPrereqsSatisfied: false,
        }),
      ],
      [
        baseInference("CIS 453"),
        baseInference("CIS 454", {
          eligible_now: false,
          blocked: true,
          missing_prereq: true,
          recommended: false,
        }),
      ]
    );

    expect(ranked[0].courseCode).toBe("CIS 453");
    expect(ranked[1].blocked).toBe(true);
  });

  it("surfaces missing prerequisite reasons for blocked courses", () => {
    const ranked = rankRecommendations(
      [
        baseCandidate({
          courseCode: "CIS 400",
          missingPrereqs: ["MAT 331"],
          allPrereqsSatisfied: false,
        }),
      ],
      [
        baseInference("CIS 400", {
          eligible_now: false,
          blocked: true,
          missing_prereq: true,
          recommended: false,
        }),
      ]
    );

    expect(ranked[0].reasons.join(" ")).toContain("Missing prerequisite");
  });

  it("marks not-offered courses as blocked and lowers their score", () => {
    const ranked = rankRecommendations(
      [baseCandidate({ courseCode: "CIS 477", offeredThisTerm: false, availableSectionCount: 0 })],
      [
        baseInference("CIS 477", {
          eligible_now: false,
          blocked: true,
          offered_this_term: false,
          not_offered_now: true,
          recommended: false,
        }),
      ]
    );

    expect(ranked[0].blocked).toBe(true);
    expect(ranked[0].reasons).toContain("Not offered in the current catalog term");
  });

  it("boosts courses that satisfy needed requirements", () => {
    const ranked = rankRecommendations(
      [
        baseCandidate({ courseCode: "CIS 321", neededRequirementGroups: ["Math Requirement"] }),
        baseCandidate({ courseCode: "PSY 205", neededRequirementGroups: [] }),
      ],
      [baseInference("CIS 321"), baseInference("PSY 205", { satisfies_needed_requirement: false })]
    );

    expect(ranked[0].courseCode).toBe("CIS 321");
  });

  it("prioritizes required/core courses over upper-division and elective buckets", () => {
    const ranked = rankRecommendations(
      [
        baseCandidate({
          courseCode: "CIS 252",
          requirementPriorityCategory: "required_courses",
          sourcePoolIds: ["required_courses"],
        }),
        baseCandidate({
          courseCode: "CIS 400",
          requirementPriorityCategory: "upper_division_cs",
          sourcePoolIds: ["upper_division_cs"],
        }),
        baseCandidate({
          courseCode: "HST 122",
          requirementPriorityCategory: "ssh_distribution",
          sourcePoolIds: ["ssh_distribution"],
        }),
        baseCandidate({
          courseCode: "IST 323",
          requirementPriorityCategory: "free_electives",
          sourcePoolIds: ["free_electives"],
        }),
      ],
      [
        baseInference("CIS 252"),
        baseInference("CIS 400"),
        baseInference("HST 122"),
        baseInference("IST 323"),
      ]
    );

    expect(ranked.map((course) => course.courseCode)).toEqual([
      "CIS 252",
      "CIS 400",
      "HST 122",
      "IST 323",
    ]);
  });

  it("boosts courses that unlock future courses", () => {
    const ranked = rankRecommendations(
      [
        baseCandidate({
          courseCode: "CIS 351",
          unlocksCourseCodes: ["CIS 453", "CIS 467"],
          unlockCount: 2,
        }),
        baseCandidate({ courseCode: "PSY 205", unlockCount: 0 }),
      ],
      [
        baseInference("CIS 351", { unlocks_future_courses: true, high_priority: true }),
        baseInference("PSY 205", { satisfies_needed_requirement: false }),
      ]
    );

    expect(ranked[0].courseCode).toBe("CIS 351");
    expect(ranked[0].reasons.join(" ")).toContain("Unlocks 2 future courses");
  });

  it("returns structured explanation details for review UI", () => {
    const ranked = rankRecommendations(
      [
        baseCandidate({
          courseCode: "CIS 400",
          requirementPriorityCategory: "upper_division_cs",
          sourcePoolIds: ["upper_division_cs"],
          remainingDegreeRequirementGroups: ["Upper Division CS Electives"],
          unlockCount: 1,
          unlocksCourseCodes: ["CSE 687"],
          bottleneck: true,
        }),
      ],
      [
        baseInference("CIS 400", {
          high_priority: true,
          bottleneck_course: true,
          unlocks_future_courses: true,
        }),
      ]
    );

    expect(ranked[0].explanation.requirementCategoryLabel).toBe("Upper-division CS requirement");
    expect(ranked[0].explanation.servesRequirementGroups).toEqual(["Upper Division CS Electives"]);
    expect(ranked[0].explanation.sourcePoolIds).toEqual(["upper_division_cs"]);
    expect(ranked[0].explanation.rankingHighlights).toContain("Marked high-priority by the reasoning layer");
    expect(ranked[0].explanation.rankingHighlights).toContain("Sequencing bottleneck");
  });
});

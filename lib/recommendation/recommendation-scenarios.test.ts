import { buildRecommendationPayload } from "./build-recommendation-payload";
import { runFallbackReasoner } from "./fallback-reasoner";
import { rankRecommendations } from "./rank-recommendations";
import { loadComputerScienceProgramRules } from "@/lib/program-rules/load-program-rules";
import type {
  AcademicCourseRecord,
  CatalogSectionRecord,
  RankedRecommendation,
} from "./types";

const rules = loadComputerScienceProgramRules();

const CREDITS_BY_COURSE: Record<string, string> = {
  "ECS 101": "3",
  "CIS 151": "3",
  "WRT 105": "3",
  "WRT 205": "3",
  "FYS 101": "1",
  "SOC 281": "3",
  "IST 344": "3",
  "MAT 295": "4",
  "MAT 296": "4",
  "MAT 331": "4",
  "MAT 397": "4",
  "CIS 321": "4",
  "PHY 211": "3",
  "CHE 106": "3",
  "CIS 252": "4",
  "CIS 375": "3",
  "CIS 341": "3",
  "CSE 384": "3",
  "CIS 351": "3",
  "CIS 352": "3",
  "CIS 453": "3",
  "CIS 454": "3",
  "CIS 473": "3",
  "CIS 477": "3",
  "CSE 486": "3",
  "PHI 251": "3",
  "HST 122": "3",
  "PSY 205": "3",
  "ANT 357": "3",
  "ANT 121": "3",
  "ECS 392": "3",
  "CIS 400": "3",
  "CIS 442": "3",
  "IST 323": "3",
  "IST 343": "3",
  "IST 359": "3",
  "CSE 687": "3",
};

function academicCourse(
  code: string,
  grade = "A",
  term = "Fall 2025"
): AcademicCourseRecord {
  return {
    code,
    name: code,
    term,
    grade,
    credits: CREDITS_BY_COURSE[code] || "3",
  };
}

function catalogSection(code: string): CatalogSectionRecord {
  return {
    Class: code,
    Section: "M001",
  };
}

function runRecommendationScenario({
  selectedYear,
  completedCourses,
  inProgressCourses = [],
  catalogCourseCodes,
}: {
  selectedYear: string;
  completedCourses: string[];
  inProgressCourses?: string[];
  catalogCourseCodes: string[];
}) {
  const academicCourses = [
    ...completedCourses.map((courseCode) => academicCourse(courseCode)),
    ...inProgressCourses.map((courseCode) => academicCourse(courseCode, "IP", "Spring 2026")),
  ];

  const payload = buildRecommendationPayload({
    studentId: "student-scenario",
    studentName: "Scenario Student",
    selectedMajor: "Computer Science, BS",
    selectedYear,
    term: "Current Catalog",
    requirementsForMajor: rules.roadmap,
    programRules: rules,
    academicCourses,
    degreeRequirements: [],
    catalogCourses: catalogCourseCodes.map(catalogSection),
  });

  const inferred = runFallbackReasoner(payload);
  const ranked = rankRecommendations(payload.candidateCourses, inferred);

  return {
    payload,
    ranked,
    recommended: ranked.filter((course) => !course.blocked),
    blocked: ranked.filter((course) => course.blocked),
  };
}

function findCourse(courses: RankedRecommendation[], courseCode: string) {
  return courses.find((course) => course.courseCode === courseCode);
}

const CORE_COMPLETE_WITH_MAT331 = [
  "ECS 101",
  "CIS 151",
  "WRT 105",
  "WRT 205",
  "FYS 101",
  "SOC 281",
  "IST 344",
  "MAT 295",
  "MAT 296",
  "MAT 331",
  "CIS 321",
  "PHY 211",
  "CHE 106",
  "CIS 252",
  "CIS 375",
  "CIS 341",
  "CSE 384",
  "CIS 351",
  "CIS 352",
  "CIS 453",
  "CIS 454",
  "CIS 473",
  "CIS 477",
  "CSE 486",
  "PHI 251",
  "HST 122",
  "PSY 205",
  "ANT 357",
  "ANT 121",
  "ECS 392",
  "IST 323",
  "IST 343",
  "IST 359",
];

const CORE_COMPLETE_WITH_MAT397 = CORE_COMPLETE_WITH_MAT331.filter(
  (courseCode) => courseCode !== "MAT 331"
).concat("MAT 397");

describe("recommendation scenarios", () => {
  it("recommends upper-division CS courses when that is the only remaining bucket", () => {
    const result = runRecommendationScenario({
      selectedYear: "Senior",
      completedCourses: CORE_COMPLETE_WITH_MAT331,
      catalogCourseCodes: ["CIS 400", "CIS 442", "CSE 687"],
    });

    expect(result.payload.candidateCourses.length).toBeGreaterThan(0);
    expect(result.recommended.map((course) => course.courseCode)).toEqual([
      "CIS 400",
      "CIS 442",
      "CSE 687",
    ]);
    expect(
      result.recommended.every(
        (course) => course.debug.requirementPriorityCategory === "upper_division_cs"
      )
    ).toBe(true);
  });

  it("recommends SSH and free-elective options when only those buckets remain", () => {
    const result = runRecommendationScenario({
      selectedYear: "Senior",
      completedCourses: CORE_COMPLETE_WITH_MAT331.filter(
        (courseCode) => !["HST 122", "PSY 205", "IST 323", "IST 343"].includes(courseCode)
      ).concat("CIS 400"),
      catalogCourseCodes: ["HST 122", "PSY 205", "IST 323", "IST 343", "IST 359"],
    });

    expect(result.payload.candidateCourses.map((course) => course.courseCode)).toEqual([
      "HST 122",
      "PSY 205",
      "IST 323",
      "IST 343",
    ]);
    expect(
      result.recommended.every((course) =>
        ["ssh_distribution", "free_electives"].includes(course.debug.requirementPriorityCategory)
      )
    ).toBe(true);
  });

  it("keeps a blocked upper-division course below other eligible upper-division options", () => {
    const result = runRecommendationScenario({
      selectedYear: "Senior",
      completedCourses: CORE_COMPLETE_WITH_MAT397.filter(
        (courseCode) => !["CSE 384", "CSE 486"].includes(courseCode)
      ),
      catalogCourseCodes: ["CSE 486", "CIS 442", "CSE 687"],
    });

    expect(findCourse(result.blocked, "CSE 486")?.missingPrereqs).toEqual(["CSE 384"]);
    expect(result.recommended.map((course) => course.courseCode)).toEqual(["CIS 442", "CSE 687"]);
  });

  it("supports ahead-of-year students by surfacing future-plan courses once they are eligible", () => {
    const result = runRecommendationScenario({
      selectedYear: "Freshman",
      completedCourses: ["ECS 101", "CIS 151", "CIS 252", "MAT 295", "WRT 105", "FYS 101", "PHI 251", "CIS 351"],
      catalogCourseCodes: ["PHY 211", "MAT 296", "CIS 375", "CIS 351", "CIS 341", "CIS 352", "CSE 384"],
    });

    const aheadOfPlanCourse = findCourse(result.recommended, "CSE 384");

    expect(aheadOfPlanCourse).toBeDefined();
    expect(aheadOfPlanCourse?.reasons).toContain(
      "Ahead-of-plan option because the student is already eligible now"
    );
  });

  it("returns no candidates when the student is effectively done with the codified program rules", () => {
    const result = runRecommendationScenario({
      selectedYear: "Senior",
      completedCourses: CORE_COMPLETE_WITH_MAT331.concat("CIS 400"),
      catalogCourseCodes: ["CIS 442", "CSE 687", "HST 122", "IST 323"],
    });

    expect(result.payload.candidateCourses).toEqual([]);
    expect(result.ranked).toEqual([]);
  });
});

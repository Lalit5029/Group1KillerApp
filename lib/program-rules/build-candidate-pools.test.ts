import { loadComputerScienceProgramRules } from "./load-program-rules";
import { buildProgramCandidatePools } from "./build-candidate-pools";

describe("buildProgramCandidatePools", () => {
  it("builds required and bucket candidate pools from structured CS rules", () => {
    const rules = loadComputerScienceProgramRules();

    const pools = buildProgramCandidatePools({
      programRules: rules,
      academicCourses: [
        {
          code: "CIS 151",
          name: "Fundamentals of Computing and Programming",
          term: "Fall 2023",
          grade: "A",
          credits: "3",
        },
        {
          code: "MAT 295",
          name: "Calculus I",
          term: "Fall 2023",
          grade: "B",
          credits: "4",
        },
        {
          code: "CIS 442",
          name: "Intro to Virtual Reality",
          term: "Spring 2026",
          grade: "IP",
          credits: "3",
        },
      ],
      catalogCourses: [
        { Class: "ECS 101", Section: "M001" },
        { Class: "CIS 151", Section: "M001" },
        { Class: "MAT 295", Section: "M001" },
        { Class: "MAT 296", Section: "M001" },
        { Class: "MAT 397", Section: "M001" },
        { Class: "MAT 331", Section: "M001" },
        { Class: "CIS 400", Section: "M001" },
        { Class: "CSE 486", Section: "M001" },
        { Class: "CIS 675", Section: "M001" },
        { Class: "CIS 700", Section: "M001" },
        { Class: "CIS 442", Section: "M001" },
        { Class: "HST 122", Section: "M001" },
        { Class: "IST 323", Section: "M001" },
      ],
    });

    expect(pools.requiredCourseCandidates.some((course) => course.courseCode === "ECS 101")).toBe(true);
    expect(pools.requiredCourseCandidates.some((course) => course.courseCode === "CIS 151")).toBe(false);
    expect(pools.requiredCourseCandidates.some((course) => course.courseCode === "MAT 296")).toBe(true);
    expect(pools.requiredCourseCandidates.some((course) => course.courseCode === "MAT 397")).toBe(true);
    expect(pools.requiredCourseCandidates.some((course) => course.courseCode === "MAT 331")).toBe(true);

    expect(pools.upperDivisionCandidates.map((course) => course.courseCode)).toEqual([
      "CIS 400",
      "CSE 486",
      "CIS 675",
    ]);
    expect(pools.upperDivisionCandidates.some((course) => course.courseCode === "CIS 442")).toBe(false);
    expect(pools.upperDivisionCandidates.some((course) => course.courseCode === "CIS 700")).toBe(false);

    expect(pools.sshCandidates.map((course) => course.courseCode)).toEqual(["HST 122"]);
    expect(pools.freeElectiveCandidates.map((course) => course.courseCode)).toEqual(["IST 323"]);
  });
});

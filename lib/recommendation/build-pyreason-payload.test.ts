import { buildPyReasonPayload } from "./build-pyreason-payload";

describe("buildPyReasonPayload", () => {
  it("does not recommend courses that are already passed or in progress", () => {
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "Junior",
      term: "Current Catalog",
      requirementsForMajor: {
        Junior: ["CIS 453", "CIS 477", "ECS 392"],
      },
      academicCourses: [
        {
          code: "CIS 453",
          name: "Intro AI",
          term: "Fall 2025",
          grade: "A",
          credits: "3",
        },
        {
          code: "ECS 392",
          name: "Engineering Seminar",
          term: "Spring 2026",
          grade: "IP",
          credits: "3",
        },
      ],
      degreeRequirements: [
        {
          title: "Junior Plan",
          status: "Incomplete",
          courses: [
            { code: "CIS 453", title: "Intro AI" },
            { code: "CIS 477", title: "Distributed Systems" },
            { code: "ECS 392", title: "Engineering Seminar" },
          ],
        },
      ],
      catalogCourses: [
        { Class: "CIS 453", Section: "M001" },
        { Class: "CIS 477", Section: "M001" },
        { Class: "ECS 392", Section: "M001" },
      ],
    });

    expect(payload.candidateCourses.map((course) => course.courseCode)).toEqual(["CIS 477"]);
  });

  it("uses unfinished degree requirements ahead of year-plan hints when degree blocks exist", () => {
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "Freshman",
      term: "Current Catalog",
      requirementsForMajor: {
        Freshman: ["CIS 252"],
        Sophomore: ["CIS 321"],
      },
      academicCourses: [],
      degreeRequirements: [
        {
          title: "Major Core",
          status: "Incomplete",
          courses: [{ code: "CIS 321", title: "Systems Programming" }],
        },
      ],
      catalogCourses: [
        { Class: "CIS 252", Section: "M001" },
        { Class: "CIS 321", Section: "M001" },
      ],
    });

    const freshmanPlanCourse = payload.candidateCourses.find((course) => course.courseCode === "CIS 252");
    const degreeBlockCourse = payload.candidateCourses.find((course) => course.courseCode === "CIS 321");

    expect(freshmanPlanCourse?.neededRequirementGroups).toEqual([]);
    expect(degreeBlockCourse?.neededRequirementGroups).toEqual(["Major Core"]);
  });
});

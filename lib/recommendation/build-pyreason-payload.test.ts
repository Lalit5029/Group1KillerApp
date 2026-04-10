import { buildPyReasonPayload } from "./build-pyreason-payload";
import { loadComputerScienceProgramRules } from "@/lib/program-rules/load-program-rules";

describe("buildPyReasonPayload", () => {
  it("does not recommend courses that are already passed or in progress", () => {
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "y3f",
      term: "Current Catalog",
      requirementsForMajor: {
        y3f: ["CIS 453", "CIS 477", "ECS 392"],
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
      selectedYear: "y1f",
      term: "Current Catalog",
      requirementsForMajor: {
        y1f: ["CIS 252"],
        y1s: ["CIS 321"],
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

    const degreeBlockCourse = payload.candidateCourses.find((course) => course.courseCode === "CIS 321");

    expect(degreeBlockCourse?.neededRequirementGroups).toEqual(["Major Core"]);
    expect(payload.candidateCourses.map((course) => course.courseCode)).toEqual(["CIS 321"]);
  });

  it("derives concrete candidates from unfinished upper-division credit buckets", () => {
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "Junior",
      term: "Current Catalog",
      requirementsForMajor: {
        Junior: ["CIS 453", "CIS 477"],
        Senior: ["Upper-division electives (18 cr)"],
      },
      academicCourses: [
        {
          code: "CIS 453",
          name: "Software Spec",
          term: "Fall 2025",
          grade: "A",
          credits: "3",
        },
        {
          code: "CIS 477",
          name: "Algorithms",
          term: "Spring 2026",
          grade: "IP",
          credits: "3",
        },
      ],
      degreeRequirements: [
        {
          title: "Upper Division Courses (8 cr) Min Grade C-",
          status: "Incomplete",
          courses: [],
        },
      ],
      catalogCourses: [
        { Class: "CIS 442", Section: "M001" },
        { Class: "CIS 467", Section: "M001" },
        { Class: "CSE 486", Section: "M001" },
        { Class: "IST 359", Section: "M001" },
        { Class: "CIS 352", Section: "M001" },
        { Class: "MAT 295", Section: "M001" },
      ],
    });

    expect(payload.candidateCourses.map((course) => course.courseCode)).toEqual([
      "CIS 442",
      "CIS 467",
      "CSE 486",
    ]);

    expect(
      payload.candidateCourses.every((course) =>
        course.neededRequirementGroups.includes("Upper Division Courses (8 cr) Min Grade C-")
      )
    ).toBe(true);
  });

  it("treats free-elective and SSH roadmap examples as fallback-only candidates", () => {
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "Junior",
      term: "Current Catalog",
      requirementsForMajor: {
        Junior: [
          "CIS 453",
          "CIS 477",
          "SSH distribution (e.g. HST 122, PSY 205, ANT courses) to 21 cr",
        ],
        Senior: [
          "Free electives (8 cr): e.g. IST 323, IST 343, IST 359",
        ],
      },
      academicCourses: [],
      degreeRequirements: [],
      catalogCourses: [
        { Class: "CIS 453", Section: "M001" },
        { Class: "CIS 477", Section: "M001" },
        { Class: "HST 122", Section: "M001" },
        { Class: "PSY 205", Section: "M001" },
        { Class: "IST 323", Section: "M001" },
      ],
    });

    expect(payload.candidateCourses.map((course) => course.courseCode)).toEqual([
      "CIS 453",
      "CIS 477",
    ]);
  });

  it("supplements a too-small primary pool with flexible roadmap examples", () => {
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "Senior",
      term: "Current Catalog",
      requirementsForMajor: {
        Senior: [
          "CIS 400",
          "SSH distribution (e.g. HST 122, PSY 205, ANT courses) to 21 cr",
          "Free electives (8 cr): e.g. IST 323, IST 343, IST 359",
        ],
      },
      academicCourses: [],
      degreeRequirements: [],
      catalogCourses: [
        { Class: "CIS 400", Section: "M001" },
        { Class: "HST 122", Section: "M001" },
        { Class: "PSY 205", Section: "M001" },
        { Class: "IST 323", Section: "M001" },
      ],
    });

    expect(payload.candidateCourses.map((course) => course.courseCode)).toEqual([
      "CIS 400",
      "HST 122",
      "PSY 205",
      "IST 323",
      "IST 343",
      "IST 359",
    ]);
  });

  it("supplements a tiny degree-driven pool with strict and flexible roadmap candidates", () => {
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "Senior",
      term: "Current Catalog",
      requirementsForMajor: {
        Senior: [
          "ECS 392",
          "Upper-division electives (18 cr): CIS 400 topics + CIS 442",
          "Free electives (8 cr): e.g. IST 323, IST 343, IST 359",
        ],
      },
      academicCourses: [
        {
          code: "ECS 392",
          name: "Ethical Aspects of ECS",
          term: "Spring 2026",
          grade: "IP",
          credits: "3",
        },
        {
          code: "CIS 442",
          name: "Intro to Virtual Reality",
          term: "Spring 2026",
          grade: "IP",
          credits: "3",
        },
      ],
      degreeRequirements: [
        {
          title: "Senior Plan",
          status: "Incomplete",
          courses: [{ code: "CIS 400", title: "CIS 400 Topics" }],
        },
      ],
      catalogCourses: [
        { Class: "CIS 400", Section: "M001" },
        { Class: "IST 323", Section: "M001" },
        { Class: "IST 343", Section: "M001" },
        { Class: "IST 359", Section: "M001" },
      ],
    });

    expect(payload.candidateCourses.map((course) => course.courseCode)).toEqual([
      "CIS 400",
      "IST 323",
      "IST 343",
      "IST 359",
    ]);
  });

  it("uses structured program rules as the source of truth when provided", () => {
    const programRules = loadComputerScienceProgramRules();
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "Senior",
      term: "Current Catalog",
      requirementsForMajor: {
        Senior: ["CIS 400", "HST 122"],
      },
      programRules,
      academicCourses: [
        {
          code: "ECS 101",
          name: "Introduction to ECS",
          term: "Fall 2023",
          grade: "A",
          credits: "3",
        },
        {
          code: "CIS 151",
          name: "Fundamentals",
          term: "Fall 2023",
          grade: "A",
          credits: "3",
        },
        {
          code: "MAT 295",
          name: "Calculus I",
          term: "Fall 2023",
          grade: "A",
          credits: "4",
        },
        {
          code: "MAT 296",
          name: "Calculus II",
          term: "Spring 2024",
          grade: "A",
          credits: "4",
        },
      ],
      degreeRequirements: [],
      catalogCourses: [
        { Class: "MAT 397", Section: "M001" },
        { Class: "MAT 331", Section: "M001" },
        { Class: "CIS 252", Section: "M001" },
        { Class: "HST 122", Section: "M001" },
        { Class: "IST 323", Section: "M001" },
      ],
    });

    expect(payload.candidateCourses.some((course) => course.courseCode === "MAT 397")).toBe(true);
    expect(payload.candidateCourses.some((course) => course.courseCode === "MAT 331")).toBe(true);
    expect(payload.candidateCourses.some((course) => course.courseCode === "CIS 252")).toBe(true);
    expect(payload.candidateCourses.some((course) => course.courseCode === "HST 122")).toBe(true);
    expect(payload.candidateCourses.some((course) => course.courseCode === "IST 323")).toBe(true);
  });

  it("counts ECN courses toward incomplete Social Science & Humanities degree blocks", () => {
    const payload = buildPyReasonPayload({
      studentId: "student-1",
      studentName: "Student One",
      selectedMajor: "Computer Science, BS",
      selectedYear: "y4s",
      term: "Fall 2026",
      requirementsForMajor: {
        y4s: ["CIS 454"],
      },
      academicCourses: [],
      degreeRequirements: [
        {
          title: "Social Science and Humanities (21 cr)",
          status: "Incomplete",
          courses: [
            { code: "PHI 251", title: "Logic" },
            { code: "ECS 392", title: "Ethics" },
          ],
        },
      ],
      catalogCourses: [
        { Class: "CIS 454", Section: "M001" },
        { Class: "ECN 101", Section: "M001" },
        { Class: "ECN 301", Section: "M002" },
      ],
    });

    const ecn101 = payload.candidateCourses.find((c) => c.courseCode === "ECN 101");
    expect(ecn101).toBeDefined();
    expect(ecn101?.neededRequirementGroups).toContain("Social Science and Humanities (21 cr)");
    expect(ecn101?.remainingDegreeRequirementGroups).toContain("Social Science and Humanities (21 cr)");
  });
});

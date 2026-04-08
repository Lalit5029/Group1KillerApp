import { loadComputerScienceProgramRules } from "./load-program-rules";
import { evaluateDegreeProgress } from "./evaluate-degree-progress";

describe("evaluateDegreeProgress", () => {
  it("marks all_of groups complete or in progress from transcript data", () => {
    const rules = loadComputerScienceProgramRules();

    const progress = evaluateDegreeProgress({
      programRules: rules,
      academicCourses: [
        {
          code: "WRT 105",
          name: "Writing 105",
          term: "Fall 2023",
          grade: "A",
          credits: "3",
        },
        {
          code: "WRT 205",
          name: "Writing 205",
          term: "Fall 2025",
          grade: "IP",
          credits: "3",
        },
        {
          code: "CIS 151",
          name: "Fundamentals",
          term: "Fall 2023",
          grade: "A",
          credits: "3",
        },
      ],
    });

    const writing = progress.requirementProgress.find((group) => group.requirementGroupId === "writing");
    const introComputing = progress.requirementProgress.find(
      (group) => group.requirementGroupId === "intro_computing"
    );

    expect(writing?.status).toBe("in_progress");
    expect(writing?.completedCourseCodes).toEqual(["WRT 105"]);
    expect(writing?.inProgressCourseCodes).toEqual(["WRT 205"]);

    expect(introComputing?.status).toBe("in_progress");
    expect(introComputing?.completedCourseCodes).toEqual(["CIS 151"]);
    expect(introComputing?.remainingCourseCodes).toEqual(["ECS 101"]);
  });

  it("evaluates choose_n and credit_bucket groups deterministically", () => {
    const rules = loadComputerScienceProgramRules();

    const progress = evaluateDegreeProgress({
      programRules: rules,
      academicCourses: [
        {
          code: "MAT 397",
          name: "Calculus III",
          term: "Fall 2024",
          grade: "A",
          credits: "4",
        },
        {
          code: "HST 122",
          name: "Global History",
          term: "Fall 2025",
          grade: "A-",
          credits: "3",
        },
        {
          code: "PSY 205",
          name: "Foundations of Human Behavior",
          term: "Spring 2026",
          grade: "IP",
          credits: "3",
        },
      ],
    });

    const advancedMath = progress.requirementProgress.find(
      (group) => group.requirementGroupId === "math_advanced_choice"
    );
    const ssh = progress.requirementProgress.find(
      (group) => group.requirementGroupId === "ssh_distribution"
    );

    expect(advancedMath?.status).toBe("complete");
    expect(advancedMath?.completedCount).toBe(1);

    expect(ssh?.status).toBe("in_progress");
    expect(ssh?.completedCredits).toBe(3);
    expect(ssh?.requiredCredits).toBe(21);
    expect(ssh?.completedCourseCodes).toEqual(["HST 122"]);
    expect(ssh?.inProgressCourseCodes).toEqual(["PSY 205"]);
  });

  it("counts transcript courses that match subject/number pool rules for upper-division buckets", () => {
    const rules = loadComputerScienceProgramRules();

    const progress = evaluateDegreeProgress({
      programRules: rules,
      academicCourses: [
        {
          code: "CIS 453",
          name: "Software Specification and Design",
          term: "Fall 2025",
          grade: "A",
          credits: "3",
        },
        {
          code: "CIS 454",
          name: "Software Implementation",
          term: "Spring 2026",
          grade: "A",
          credits: "3",
        },
        {
          code: "CIS 473",
          name: "Automata and Computability",
          term: "Fall 2025",
          grade: "A",
          credits: "3",
        },
        {
          code: "CIS 477",
          name: "Algorithms",
          term: "Spring 2026",
          grade: "A",
          credits: "3",
        },
        {
          code: "CSE 486",
          name: "Design of Operating Systems",
          term: "Fall 2025",
          grade: "A",
          credits: "3",
        },
        {
          code: "CIS 400",
          name: "Selected Topics",
          term: "Spring 2026",
          grade: "A",
          credits: "3",
        },
        {
          code: "CIS 700",
          name: "Graduate Selected Topics",
          term: "Spring 2026",
          grade: "A",
          credits: "3",
        },
      ],
    });

    const upperDivision = progress.requirementProgress.find(
      (group) => group.requirementGroupId === "upper_division_cs_electives"
    );

    expect(upperDivision?.status).toBe("complete");
    expect(upperDivision?.completedCredits).toBe(18);
    expect(upperDivision?.completedCourseCodes).toEqual([
      "CIS 453",
      "CIS 454",
      "CIS 473",
      "CIS 477",
      "CSE 486",
      "CIS 400",
    ]);
  });
});

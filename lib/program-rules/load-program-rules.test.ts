import { loadComputerScienceProgramRules } from "./load-program-rules";

describe("loadComputerScienceProgramRules", () => {
  it("loads the structured CS program rules", () => {
    const rules = loadComputerScienceProgramRules();

    expect(rules.programId).toBe("computer_science_bs");
    expect(rules.majorKey).toBe("Computer Science, BS");
    expect(rules.minimumCredits).toBe(120);
    expect(rules.requirementGroups.some((group) => group.id === "cs_core")).toBe(true);
    expect(rules.requirementGroups.some((group) => group.id === "upper_division_cs_electives")).toBe(true);
    expect(rules.candidatePools.upper_division_cs.subjects).toEqual(["CIS", "CSE"]);
    expect(rules.candidatePools.upper_division_cs.minCourseNumber).toBe(400);
    expect(rules.candidatePools.upper_division_cs.maxCourseNumber).toBe(699);
  });
});

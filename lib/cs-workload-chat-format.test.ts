import { formatCsWorkloadSuggestionsForChat } from "./cs-workload-chat-format";

describe("formatCsWorkloadSuggestionsForChat", () => {
  it("labels second CIS 400 as a different topical section (y4f low)", () => {
    const text = formatCsWorkloadSuggestionsForChat("y4f", { workload: "low" });
    expect(text).toContain("**CIS 400**");
    expect(text).toMatch(/different topical section/);
    const cis400Lines = text.split("\n").filter((l) => l.includes("CIS 400"));
    expect(cis400Lines.length).toBeGreaterThanOrEqual(2);
  });

  it("includes PHY 211 lab note for y1s", () => {
    const text = formatCsWorkloadSuggestionsForChat("y1s");
    expect(text).toContain("PHY 221");
  });

  it("filters to one workload when workload option is set", () => {
    const text = formatCsWorkloadSuggestionsForChat("y1f", { workload: "medium" });
    expect(text).toContain("**Medium workload:**");
    expect(text).not.toContain("**Low workload:**");
    expect(text).not.toContain("**High workload:**");
  });
});

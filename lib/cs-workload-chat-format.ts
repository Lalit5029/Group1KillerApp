import { CS_WORKLOAD_SUGGESTIONS } from "@/lib/cs-workload-suggestions";
import type { WorkloadLevel } from "@/lib/schedule-generation";
import { estimateSectionCredits } from "@/lib/schedule-credits";

export const CS_PLANNER_TERM_LABELS: Record<string, string> = {
  y1f: "Year 1 Fall",
  y1s: "Year 1 Spring",
  y2f: "Year 2 Fall",
  y2s: "Year 2 Spring",
  y3f: "Year 3 Fall",
  y3s: "Year 3 Spring",
  y4f: "Year 4 Fall",
  y4s: "Year 4 Spring",
};

function formatCourseBullet(code: string, cis400Instance: { n: number }): string {
  const c = code.trim();
  const cr = estimateSectionCredits(c);
  const unit = cr === 1 ? "credit" : "credits";
  if (c === "CIS 400") {
    cis400Instance.n += 1;
    if (cis400Instance.n > 1) {
      return `- **${c}** (${cr} ${unit}, different topical section)`;
    }
  }
  return `- **${c}** (${cr} ${unit})`;
}

/**
 * Markdown-friendly text for the assistant when users ask what to take in a CS BS planner term.
 */
export function formatCsWorkloadSuggestionsForChat(
  plannerTerm: string,
  options?: { workload?: WorkloadLevel | null }
): string {
  const row = CS_WORKLOAD_SUGGESTIONS[plannerTerm];
  if (!row) return "";

  const termLabel = CS_PLANNER_TERM_LABELS[plannerTerm] ?? plannerTerm.toUpperCase();
  const workloads: WorkloadLevel[] = options?.workload
    ? [options.workload]
    : (["low", "medium", "high"] as const);

  const blocks: string[] = [
    `For **Computer Science, BS**, **${termLabel} semester**, here are the suggested courses:`,
  ];

  for (const w of workloads) {
    const codes = row[w];
    if (!codes?.length) continue;
    const cis400 = { n: 0 };
    const lines = codes.map((code) => formatCourseBullet(code, cis400));
    const title = w.charAt(0).toUpperCase() + w.slice(1);
    blocks.push(`\n**${title} workload:**\n${lines.join("\n")}`);
  }

  const notes: string[] = [];
  if (
    plannerTerm === "y1s" &&
    workloads.some((w) => row[w]?.some((c) => c.trim() === "PHY 211"))
  ) {
    notes.push(
      "PHY 211 pairs with a recitation and **PHY 221** lab when you use **Add suggested courses** in the planner."
    );
  }
  if (
    plannerTerm === "y2f" &&
    workloads.some((w) => row[w]?.some((c) => c.trim() === "CHE 106"))
  ) {
    notes.push("CHE 106 pairs with **CHE 107** lab in the planner’s suggested schedule.");
  }
  if (notes.length) {
    blocks.push(`\n_${notes.join(" ")}_`);
  }

  return blocks.join("");
}

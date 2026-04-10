import type { WorkloadLevel } from "@/lib/schedule-generation";

/**
 * Explicit "Add suggested courses" lists per planner semester and workload (CS BS).
 * CIS 400 may appear twice = two different sections of CIS 400.
 */
export const CS_WORKLOAD_SUGGESTIONS: Record<
  string,
  Record<WorkloadLevel, readonly string[]>
> = {
  y1f: {
    low: ["ECS 101", "CIS 151", "MAT 295", "FYS 101"],
    medium: ["ECS 101", "CIS 151", "MAT 295", "FYS 101", "WRT 105"],
    high: ["ECS 101", "CIS 151", "MAT 295", "FYS 101", "WRT 105", "ECN 101"],
  },
  y1s: {
    low: ["CIS 252", "MAT 296", "PHY 211"],
    medium: ["CIS 252", "MAT 296", "PHY 211", "PHI 251"],
    high: ["CIS 252", "MAT 296", "PHY 211", "PHI 251", "SOC 281"],
  },
  y2f: {
    low: ["CIS 375", "CIS 351", "MAT 331", "IST 344"],
    medium: ["CIS 375", "CIS 351", "MAT 331", "IST 344", "CHE 106"],
    high: ["CIS 375", "CIS 351", "MAT 397", "IST 344", "CHE 106"],
  },
  y2s: {
    low: ["CIS 321", "CIS 341", "CIS 352", "CSE 384"],
    medium: ["CIS 321", "CIS 341", "CIS 352", "CSE 384", "WRT 205"],
    high: ["CIS 321", "CIS 341", "CIS 352", "CSE 384", "WRT 205", "CIS 400"],
  },
  y3f: {
    low: ["CIS 453", "CIS 477", "CSE 486", "CIS 400"],
    medium: ["CIS 453", "CIS 477", "CSE 486", "CIS 400", "HST 122"],
    high: ["CIS 453", "CIS 477", "CSE 486", "CIS 400", "HST 122", "ECN 102"],
  },
  y3s: {
    low: ["CIS 473", "CIS 454", "CIS 442", "CIS 400"],
    medium: ["CIS 473", "CIS 454", "CIS 442", "CIS 400", "ANT 111"],
    high: ["CIS 473", "CIS 454", "CIS 442", "CIS 400", "ANT 111", "ECN 311"],
  },
  y4f: {
    low: ["ECS 392", "CIS 400", "CIS 400", "PHI 378"],
    medium: ["ECS 392", "CIS 400", "PSY 205", "PHI 378", "PHI 451"],
    high: ["ECS 392", "CIS 400", "CIS 400", "PHI 378", "PHI 451", "ANT 121"],
  },
  y4s: {
    low: ["PHI 107", "CIS 400", "CIS 400", "ECN 495"],
    medium: ["PHI 107", "CIS 400", "PSY 205", "ECN 495", "ECN 304"],
    high: ["PHI 107", "CIS 400", "CIS 400", "ECN 495", "ECN 304", "CIS 442"],
  },
};

/** Lecture → co-requisite lab (1 cr); inserted immediately after the lecture in the suggestion list. */
export const CS_LECTURE_LAB_PAIR: Record<string, string> = {
  "PHY 211": "PHY 221",
  "CHE 106": "CHE 107",
};

export type CsWorkloadSuggestionEntry = {
  code: string;
  /** Second (or later) CIS 400 in the same term — must use a different section than earlier CIS 400. */
  allowDuplicateClass?: boolean;
};

export function buildCsWorkloadSuggestionList(
  semesterId: string,
  workload: WorkloadLevel
): CsWorkloadSuggestionEntry[] {
  const row = CS_WORKLOAD_SUGGESTIONS[semesterId]?.[workload];
  if (!row?.length) return [];

  const out: CsWorkloadSuggestionEntry[] = [];
  let cis400Count = 0;

  for (const code of row) {
    const trimmed = code.trim();
    const lab = CS_LECTURE_LAB_PAIR[trimmed];
    if (lab) {
      out.push({ code: trimmed });
      out.push({ code: lab });
      continue;
    }
    if (trimmed === "CIS 400") {
      cis400Count += 1;
      out.push({ code: "CIS 400", allowDuplicateClass: cis400Count > 1 });
      continue;
    }
    out.push({ code: trimmed });
  }

  return out;
}

export function usesCsWorkloadMatrix(majorKey: string, semesterId: string): boolean {
  return majorKey === "Computer Science, BS" && Boolean(CS_WORKLOAD_SUGGESTIONS[semesterId]);
}

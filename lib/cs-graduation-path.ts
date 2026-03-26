import type { CourseData } from "@/lib/types";

export interface CsSemesterColumn {
  id: string;
  shortLabel: string;
  fullLabel: string;
  /** Display lines (may include "MAT 397 / MAT 331 (one)"). */
  rows: { key: string; display: string; matchCodes: string[] }[];
}

/**
 * 8-term roadmap. matchCodes are used to mark completion against transcript (normalized).
 */
export const CS_GRADUATION_SEMESTERS: CsSemesterColumn[] = [
  {
    id: "y1f",
    shortLabel: "Y1 F",
    fullLabel: "Year 1 · Fall",
    rows: [
      { key: "ecs101", display: "ECS 101", matchCodes: ["ECS 101"] },
      { key: "cis151", display: "CIS 151", matchCodes: ["CIS 151"] },
      { key: "mat295", display: "MAT 295", matchCodes: ["MAT 295"] },
      { key: "wrt105", display: "WRT 105", matchCodes: ["WRT 105"] },
      { key: "fys101", display: "FYS 101", matchCodes: ["FYS 101"] },
    ],
  },
  {
    id: "y1s",
    shortLabel: "Y1 S",
    fullLabel: "Year 1 · Spring",
    rows: [
      { key: "cis252", display: "CIS 252", matchCodes: ["CIS 252"] },
      { key: "mat296", display: "MAT 296", matchCodes: ["MAT 296"] },
      { key: "phi251", display: "PHI 251", matchCodes: ["PHI 251"] },
      { key: "phy211", display: "PHY 211", matchCodes: ["PHY 211"] },
      { key: "phy221", display: "PHY 221", matchCodes: ["PHY 221"] },
    ],
  },
  {
    id: "y2f",
    shortLabel: "Y2 F",
    fullLabel: "Year 2 · Fall",
    rows: [
      { key: "cis375", display: "CIS 375", matchCodes: ["CIS 375"] },
      { key: "cis351", display: "CIS 351", matchCodes: ["CIS 351"] },
      {
        key: "mat397331",
        display: "MAT 397 / MAT 331 (one)",
        matchCodes: ["MAT 397", "MAT 331"],
      },
      { key: "phy212", display: "PHY 212 (sci. seq.)", matchCodes: ["PHY 212", "CHE 106", "BIO 121"] },
    ],
  },
  {
    id: "y2s",
    shortLabel: "Y2 S",
    fullLabel: "Year 2 · Spring",
    rows: [
      { key: "cis321", display: "CIS 321", matchCodes: ["CIS 321"] },
      { key: "cis341", display: "CIS 341", matchCodes: ["CIS 341"] },
      { key: "cis352", display: "CIS 352", matchCodes: ["CIS 352"] },
      { key: "cse384", display: "CSE 384", matchCodes: ["CSE 384"] },
      { key: "wrt205", display: "WRT 205", matchCodes: ["WRT 205"] },
      { key: "phy222", display: "PHY 222 / CHE 107 / BIO 122", matchCodes: ["PHY 222", "CHE 107", "BIO 122"] },
    ],
  },
  {
    id: "y3f",
    shortLabel: "Y3 F",
    fullLabel: "Year 3 · Fall",
    rows: [
      { key: "cis453", display: "CIS 453", matchCodes: ["CIS 453"] },
      { key: "cis477", display: "CIS 477", matchCodes: ["CIS 477"] },
      { key: "cse486", display: "CSE 486", matchCodes: ["CSE 486"] },
    ],
  },
  {
    id: "y3s",
    shortLabel: "Y3 S",
    fullLabel: "Year 3 · Spring",
    rows: [
      { key: "cis473", display: "CIS 473", matchCodes: ["CIS 473"] },
      { key: "cis454", display: "CIS 454", matchCodes: ["CIS 454"] },
    ],
  },
  {
    id: "y4f",
    shortLabel: "Y4 F",
    fullLabel: "Year 4 · Fall",
    rows: [{ key: "ecs392", display: "ECS 392", matchCodes: ["ECS 392"] }],
  },
  {
    id: "y4s",
    shortLabel: "Y4 S",
    fullLabel: "Year 4 · Spring",
    rows: [
      {
        key: "ud",
        display: "UD CIS/CSE + electives (per checklist)",
        matchCodes: [],
      },
    ],
  },
];

export function normalizeCode(code?: string): string {
  return (code || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function isPassingGrade(grade?: string): boolean {
  const g = (grade || "").toUpperCase();
  if (!g || g === "IP" || g === "WD") return false;
  return g !== "F";
}

/** Completed with passing grade for at least one match code. */
export function completionMapFromAcademic(courses: CourseData[]): Map<string, CourseData> {
  const map = new Map<string, CourseData>();
  for (const c of courses) {
    const code = normalizeCode(c.code);
    if (!code) continue;
    if (!isPassingGrade(c.grade)) continue;
    if (!map.has(code)) map.set(code, c);
  }
  return map;
}

export function rowSatisfied(
  row: { matchCodes: string[] },
  completed: Map<string, CourseData>
): boolean {
  if (row.matchCodes.length === 0) return false;
  return row.matchCodes.some((code) => completed.has(normalizeCode(code)));
}

export type RowVisualStatus = "done" | "remaining" | "advisory";

export function rowStatus(
  row: CsSemesterColumn["rows"][number],
  completed: Map<string, CourseData>
): RowVisualStatus {
  if (row.key === "ud") return "advisory";
  return rowSatisfied(row, completed) ? "done" : "remaining";
}

/** Prerequisite chains for legend (advisory). */
export const CS_PREREQUISITE_CHAINS: { title: string; chain: string[] }[] = [
  {
    title: "Mathematics",
    chain: ["MAT 295", "MAT 296", "MAT 397 or MAT 331", "CIS 321"],
  },
  {
    title: "Programming & core",
    chain: ["CIS 151", "CIS 252", "CIS 351", "CIS 375"],
  },
  {
    title: "Systems / theory / analytics",
    chain: ["CIS 252", "CIS 341", "CIS 352", "CSE 384"],
  },
  {
    title: "Upper-division CIS",
    chain: ["CIS 351", "CIS 453", "CIS 454", "CIS 473"],
  },
  {
    title: "Algorithms / systems / project",
    chain: ["CIS 375", "CIS 477", "CSE 486"],
  },
];

export function summarizeProgress(completed: Map<string, CourseData>): {
  doneCount: number;
  trackedCount: number;
  remainingLabels: string[];
} {
  let done = 0;
  let tracked = 0;
  const remaining: string[] = [];

  for (const sem of CS_GRADUATION_SEMESTERS) {
    for (const row of sem.rows) {
      if (row.key === "ud") continue;
      tracked += 1;
      if (rowSatisfied(row, completed)) {
        done += 1;
      } else {
        remaining.push(row.display);
      }
    }
  }

  return {
    doneCount: done,
    trackedCount: tracked,
    remainingLabels: remaining,
  };
}

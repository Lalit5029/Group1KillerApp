import type { Course, SelectedCourse } from "@/lib/types";
import { hasConflict } from "@/lib/schedule-utils";

export type CatalogTermBucket = "fall" | "spring" | "unknown";

/**
 * Exact `id` from `courses.json` to try first for auto-suggest (stable picks for demo / known-good rows).
 */
export const PREFERRED_CATALOG_ROW_IDS: Record<string, readonly string[]> = {
  "ECS 392": ["course-643", "course-644"],
  "PHI 451": ["course-2439"],
  "CIS 351": ["course-41"],
  "CIS 375": ["course-1676"],
  "CIS 442": ["course-497", "course-1703"],
  "CIS 454": ["course-1683"],
  "PSY 205": ["course-2507"],
};

/** Skip fully-online / async-style rows when in-person sections exist. */
export function isLikelyOnlineDeliverySection(section: Course): boolean {
  const r = String(section.Room || "").toUpperCase();
  const d = String(section.DaysTimes || "").toUpperCase();
  const blob = `${r} ${d}`;
  return (
    /\bONLINE\b/.test(blob) ||
    /\bASYNCHRONOUS\b/.test(blob) ||
    /\bDISTANCE\b/.test(blob) ||
    /\bWEB\s+EXCL/.test(blob) ||
    /\bINTERNET\b/.test(blob)
  );
}

/**
 * Infer term bucket from PeopleSoft-style meeting dates (MM/DD/YYYY - …).
 * Spring ≈ Jan–Apr; Fall ≈ Aug–Dec; May–Jul treated as unknown (summer / ambiguous).
 */
export function inferCatalogTermBucket(meetingDates: string | undefined): CatalogTermBucket {
  const raw = String(meetingDates || "").trim();
  if (!raw || /^TBA$/i.test(raw)) return "unknown";
  const firstPart = raw.split("-")[0]?.trim() ?? "";
  const month = parseInt(firstPart.split("/")[0] ?? "", 10);
  if (Number.isNaN(month) || month < 1 || month > 12) return "unknown";
  if (month >= 8) return "fall";
  if (month <= 4) return "spring";
  return "unknown";
}

/**
 * Prefer Fall catalog rows whenever this course has any Fall-dated section; otherwise prefer Spring
 * if only Spring exists. Unknown-only pools are treated as neutral (no term tie-break).
 */
export function resolveCatalogTermPreference(sections: Course[]): CatalogTermBucket | null {
  const buckets = new Set(sections.map((s) => inferCatalogTermBucket(s.MeetingDates)));
  if (buckets.has("fall")) return "fall";
  if (buckets.has("spring")) return "spring";
  return null;
}

/** Lower = higher priority; list order is the tie-break among preferred ids. */
function preferredCatalogIdRank(code: string, section: Course): number {
  const list = PREFERRED_CATALOG_ROW_IDS[code];
  if (!list?.length) return 0;
  const idx = list.indexOf(String(section.id || ""));
  if (idx >= 0) return idx;
  return 1000;
}

function tailSectionRank(code: string, section: Course): number {
  if (code === "ECS 392" && /\bflexlong\b/i.test(String(section.Section || ""))) return 2;
  if (code === "CIS 400") {
    const dt = String(section.DaysTimes || "").trim();
    if (!dt || /^TBA$/i.test(dt)) return 1;
  }
  return 0;
}

/**
 * Order catalog rows: Fall first when Fall exists for this code; otherwise Spring-only is fine.
 * Then minimize time clashes, then light per-course prefs (ECS 392 / CIS 400).
 */
export function sortSectionsForAutoSchedule(args: {
  sections: Course[];
  normalizedCode: string;
  selected: SelectedCourse[];
}): Course[] {
  const { sections, normalizedCode, selected } = args;
  const code = normalizedCode.trim().toUpperCase().replace(/\s+/g, " ");
  const preferredBucket = resolveCatalogTermPreference(sections);

  const rank = (c: Course): [number, number, number, number, number, number] => {
    const bucket = inferCatalogTermBucket(c.MeetingDates);
    const termRank =
      !preferredBucket ? 0
      : bucket === preferredBucket ? 0
      : bucket === "unknown" ? 1
      : 2;

    const conflictRank = hasConflict(c, selected) ? 1 : 0;

    const tbaTime =
      !c.DaysTimes?.trim() || /^TBA$/i.test(c.DaysTimes.trim()) ? 1 : 0;

    const onlineRank = isLikelyOnlineDeliverySection(c) ? 1 : 0;

    return [
      conflictRank,
      termRank,
      tbaTime,
      onlineRank,
      preferredCatalogIdRank(code, c),
      tailSectionRank(code, c),
    ];
  };

  return [...sections].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] !== rb[i]) return ra[i] - rb[i];
    }
    const sec = String(a.Section || "").localeCompare(String(b.Section || ""), undefined, { numeric: true });
    if (sec !== 0) return sec;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

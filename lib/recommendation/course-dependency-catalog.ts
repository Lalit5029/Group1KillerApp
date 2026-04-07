import type { CourseDependencyDefinition } from "./types";

/**
 * This file contains the small amount of explicit prerequisite data that
 * currently exists or can be traced to data already present in the repo.
 *
 * The live Syracuse course catalog in this project does not contain structured
 * prerequisite metadata, so the recommender must treat missing dependency data
 * conservatively. These entries let us reason over the core CS sequence that is
 * already referenced in sample advising data while keeping the structure ready
 * for a future authoritative prerequisite feed.
 */
export const COURSE_DEPENDENCY_CATALOG: Record<string, CourseDependencyDefinition> = {
  "CIS 252": {
    prerequisites: [{ type: "oneOf", courses: ["CIS 151", "CPS 196"] }],
    source: "curated",
  },
  "CIS 341": {
    prerequisites: [{ type: "allOf", courses: ["CIS 351"] }],
    source: "curated",
  },
  "CIS 351": {
    prerequisites: [{ type: "oneOf", courses: ["CIS 252", "CSE 283"] }],
    source: "curated",
  },
  "CIS 352": {
    prerequisites: [{ type: "allOf", courses: ["CIS 252", "CIS 375", "CIS 351"] }],
    source: "curated",
  },
  "CIS 375": {
    prerequisites: [{ type: "allOf", courses: ["PHI 251"] }],
    source: "curated",
  },
  "CIS 453": {
    prerequisites: [{ type: "oneOf", courses: ["CIS 351", "CSE 382"] }],
    source: "curated",
  },
  "CIS 454": {
    prerequisites: [{ type: "allOf", courses: ["CIS 453"] }],
    source: "curated",
  },
  "CIS 473": {
    prerequisites: [{ type: "oneOf", courses: ["CIS 375", "MAT 375"] }],
    source: "curated",
  },
  "CIS 477": {
    prerequisites: [{ type: "allOf", courses: ["CIS 375", "CIS 351"] }],
    source: "curated",
  },
  "CSE 384": {
    prerequisites: [{ type: "oneOf", courses: ["CSE 283", "CIS 351"] }],
    source: "curated",
  },
  "CSE 486": {
    prerequisites: [
      { type: "oneOf", courses: ["CIS 341", "CSE 381"] },
      { type: "allOf", courses: ["CSE 384", "CIS 351"] },
    ],
    source: "curated",
  },
  "MAT 397": {
    prerequisites: [{ type: "allOf", courses: ["MAT 296"] }],
    source: "curated",
  },
  "MAT 331": {
    prerequisites: [{ type: "allOf", courses: ["MAT 296"] }],
    source: "curated",
  },
};

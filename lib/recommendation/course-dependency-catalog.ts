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
  "CIS 453": {
    prerequisites: [{ type: "allOf", courses: ["CIS 351"] }],
    source: "sample_data",
  },
  "CIS 467": {
    prerequisites: [{ type: "allOf", courses: ["CIS 351"] }],
    source: "sample_data",
  },
  "CIS 400": {
    prerequisites: [{ type: "allOf", courses: ["CIS 321", "MAT 331"] }],
    source: "sample_data",
  },
  "CIS 486": {
    prerequisites: [{ type: "allOf", courses: ["CIS 341"] }],
    source: "sample_data",
  },
  "CSE 486": {
    prerequisites: [{ type: "allOf", courses: ["CIS 341"] }],
    source: "curated",
  },
  "CIS 454": {
    prerequisites: [{ type: "allOf", courses: ["CIS 341"] }],
    source: "curated",
  },
  "CIS 473": {
    prerequisites: [{ type: "allOf", courses: ["CIS 341"] }],
    source: "curated",
  },
  "CIS 477": {
    prerequisites: [{ type: "allOf", courses: ["CIS 453"] }],
    source: "curated",
  },
  "CSE 384": {
    prerequisites: [{ type: "allOf", courses: ["CIS 252"] }],
    source: "curated",
  },
  "CIS 351": {
    prerequisites: [{ type: "allOf", courses: ["CIS 252"] }],
    source: "curated",
  },
  "CIS 352": {
    prerequisites: [{ type: "allOf", courses: ["CIS 252"] }],
    source: "curated",
  },
  "CIS 375": {
    prerequisites: [{ type: "allOf", courses: ["CIS 252"] }],
    source: "curated",
  },
  "CIS 341": {
    prerequisites: [{ type: "allOf", courses: ["CIS 252"] }],
    source: "curated",
  },
  "CIS 252": {
    prerequisites: [{ type: "allOf", courses: ["CIS 151"] }],
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

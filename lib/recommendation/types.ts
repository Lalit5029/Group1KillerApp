/**
 * Shared types for the recommendation pipeline.
 *
 * The recommendation flow is intentionally split into:
 * 1. Data shaping / fact extraction
 * 2. Reasoning (PyReason when available)
 * 3. Ranking + explanation generation
 *
 * This keeps schedule generation separate and allows us to improve the
 * recommendation layer without rewriting timetable construction.
 */

export type RequirementGroupKind = "allOf" | "oneOf";

export interface RequirementClause {
  type: RequirementGroupKind;
  courses: string[];
}

export interface CourseDependencyDefinition {
  prerequisites?: RequirementClause[];
  corequisites?: RequirementClause[];
  minimumGrade?: string;
  source: "sample_data" | "curated";
}

export interface RequirementBlockCourse {
  code: string;
  title?: string;
  grade?: string;
  credits?: string;
  term?: string;
}

export interface RequirementBlockRecord {
  title: string;
  status: string;
  courses: RequirementBlockCourse[];
}

export interface AcademicCourseRecord {
  code: string;
  name: string;
  title?: string;
  term: string;
  grade: string;
  credits: string;
  requirementGroup?: string | null;
  catalogGroup?: string | null;
}

export interface CatalogSectionRecord {
  id?: string;
  Class?: string;
  Section?: string;
  DaysTimes?: string;
  Room?: string;
  Instructor?: string;
  MeetingDates?: string;
}

export interface CandidateCourse {
  courseCode: string;
  title: string;
  planYears: string[];
  neededRequirementGroups: string[];
  remainingDegreeRequirementGroups: string[];
  yearPreference: "current" | "future" | "past" | "unplanned";
  offeredThisTerm: boolean;
  availableSectionCount: number;
  prerequisiteGroups: RequirementClause[];
  corequisiteGroups: RequirementClause[];
  missingPrereqs: string[];
  missingCoreqs: string[];
  allPrereqsSatisfied: boolean;
  allCoreqsSatisfied: boolean;
  unlocksCourseCodes: string[];
  unlockCount: number;
  bottleneck: boolean;
}

export interface PyReasonFactCollection {
  passed: Array<{ student: string; course: string }>;
  failed: Array<{ student: string; course: string }>;
  inProgress: Array<{ student: string; course: string }>;
  notPassed: Array<{ student: string; course: string }>;
  targetCourse: Array<{ student: string; course: string }>;
  offeredIn: Array<{ course: string; term: string }>;
  notOfferedIn: Array<{ course: string; term: string }>;
  countsForRequirement: Array<{ course: string; requirement: string }>;
  neededForStudent: Array<{ student: string; requirement: string }>;
  requires: Array<{ course: string; prerequisite: string }>;
  corequires: Array<{ course: string; corequisite: string }>;
  allPrereqsSatisfied: Array<{ student: string; course: string }>;
  allCoreqsSatisfied: Array<{ student: string; course: string }>;
  unlocks: Array<{ course: string; unlockedCourse: string }>;
  candidateBottleneck: Array<{ student: string; course: string }>;
  currentTerm: string[];
}

export interface PyReasonPayload {
  studentId: string;
  studentName: string;
  selectedMajor: string;
  selectedYear: string;
  term: string;
  completedCourses: string[];
  failedCourses: string[];
  inProgressCourses: string[];
  candidateCourses: CandidateCourse[];
  facts: PyReasonFactCollection;
}

export interface InferenceFlags {
  eligible_now: boolean;
  blocked: boolean;
  missing_prereq: boolean;
  missing_coreq: boolean;
  offered_this_term: boolean;
  not_offered_now: boolean;
  satisfies_needed_requirement: boolean;
  high_priority: boolean;
  bottleneck_course: boolean;
  unlocks_future_courses: boolean;
  recommended: boolean;
}

export interface InferenceResult {
  courseCode: string;
  flags: InferenceFlags;
  rawLabels: string[];
}

export interface RankedRecommendation {
  courseId: string;
  courseCode: string;
  title: string;
  status: "recommended" | "eligible" | "blocked";
  priorityScore: number;
  reasons: string[];
  missingPrereqs: string[];
  missingCoreqs: string[];
  blocked: boolean;
  offeredThisTerm: boolean;
  availableSectionCount: number;
  debug: {
    flags: InferenceFlags;
    neededRequirementGroups: string[];
    unlockCount: number;
    rawLabels: string[];
  };
}

export interface RecommendationApiResponse {
  recommendedCourses: RankedRecommendation[];
  blockedCourses: RankedRecommendation[];
  debug?: {
    engine: "pyreason" | "fallback";
    candidateCount: number;
    term: string;
  };
}

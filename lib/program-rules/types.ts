export type ProgramRequirementKind = "all_of" | "choose_n" | "credit_bucket";

export interface CandidatePoolRule {
  description: string;
  subjects?: string[];
  minCourseNumber?: number;
  maxCourseNumber?: number;
  allowedCourses?: string[];
}

export interface BaseProgramRequirementRule {
  id: string;
  title: string;
  kind: ProgramRequirementKind;
  minimumGrade?: string;
}

export interface AllOfRequirementRule extends BaseProgramRequirementRule {
  kind: "all_of";
  courses: string[];
}

export interface ChooseNRequirementRule extends BaseProgramRequirementRule {
  kind: "choose_n";
  count: number;
  options: string[];
}

export interface CreditBucketRequirementRule extends BaseProgramRequirementRule {
  kind: "credit_bucket";
  minimumCredits: number;
  candidatePoolId: string;
}

export type ProgramRequirementRule =
  | AllOfRequirementRule
  | ChooseNRequirementRule
  | CreditBucketRequirementRule;

export interface ProgramRules {
  programId: string;
  programName: string;
  majorKey: string;
  minimumCredits: number;
  gradePolicies: {
    defaultMinimumGrade: string;
    coreGpaMinimum?: number;
    ecsMathScienceGpaMinimum?: number;
  };
  candidatePools: Record<string, CandidatePoolRule>;
  requirementGroups: ProgramRequirementRule[];
  roadmap: Record<string, string[]>;
  notes?: string[];
}

export interface ProgramCandidateCourse {
  courseCode: string;
  title: string;
  offeredThisTerm: boolean;
  availableSectionCount: number;
  requirementGroupIds: string[];
  sourcePoolIds: string[];
}

export interface ProgramCandidatePools {
  requiredCourseCandidates: ProgramCandidateCourse[];
  upperDivisionCandidates: ProgramCandidateCourse[];
  sshCandidates: ProgramCandidateCourse[];
  freeElectiveCandidates: ProgramCandidateCourse[];
  allCandidates: ProgramCandidateCourse[];
}

export interface DegreeRequirementProgress {
  requirementGroupId: string;
  title: string;
  kind: ProgramRequirementKind;
  status: "complete" | "in_progress" | "not_started";
  completedCourseCodes: string[];
  inProgressCourseCodes: string[];
  remainingCourseCodes: string[];
  completedCount?: number;
  requiredCount?: number;
  completedCredits?: number;
  requiredCredits?: number;
  candidatePoolId?: string;
}

export interface DegreeProgressSummary {
  completedRequirementGroupIds: string[];
  inProgressRequirementGroupIds: string[];
  incompleteRequirementGroupIds: string[];
  requirementProgress: DegreeRequirementProgress[];
}

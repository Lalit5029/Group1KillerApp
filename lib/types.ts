export interface Course {
  id?: string;
  Class?: string;
  Section?: string;
  DaysTimes?: string;
  Room?: string;
  Instructor?: string;
  MeetingDates?: string;
  Reviews?: string[];
  RMP_Rating?: string;
}

export interface SelectedCourse {
  id: string;
  Class?: string;
  Section?: string;
  Instructor?: string;
  DaysTimes?: string;
  Room?: string;
  /** When set, enables what-if planner to scope edits to a single term. */
  term?: string;
  requirementGroup?: string;
  grade?: string;
  credits?: string;
}

export interface Notification {
  id: string;
  message: string;
  type: "success" | "warning" | "error" | "default";
}

export interface Major {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  name: string;
  email?: string | null;
  externalStudentId?: string | null;
  major?: string | null;
  academicYear?: string | null;
  notes?: string | null;
}

/** Major key → planner term (class year or semester id) → suggested course strings */
export interface Requirements {
  [majorName: string]: {
    [termKey: string]: string[];
  };
}

export interface CourseData {
  code: string;
  title: string;
  name?: string;
  grade: string;
  credits: string;
  term: string;
  catalogGroup: string;
  status?: string;
  requirementGroup?: string;
  isRecommended?: boolean;
  isFuture?: boolean;
}

export interface CourseSearchCriteria {
  query?: string;
  subject?: string;
  courseNumber?: string;
  instructor?: string;
  section?: string;
}

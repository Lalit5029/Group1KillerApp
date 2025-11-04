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

export interface Requirements {
  [key: string]: {
    [majorName: string]: {
      [year: string]: string[];
    };
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

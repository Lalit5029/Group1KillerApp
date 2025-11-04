// Academic data processing functions

export interface CourseData {
  code: string;
  title: string;
  grade: string;
  credits: string;
  term: string;
  catalogGroup: string;
  requirementGroup: string | null;
}

export interface SelectedCourse {
  id: string;
  Class: string;
  Section: string;
  Instructor: string;
  DaysTimes: string;
  Room: string;
}

export interface Requirements {
  [key: string]: {
    [key: string]: string[];
  };
}

export interface AcademicDataVisualizerProps {
  selectedMajor: string;
  selectedYear: string;
  requirements: Requirements;
  selectedCourses: SelectedCourse[];
}

/**
 * Processes the academic data JSON file
 * @param fileContent The JSON content from the file
 * @returns Processed course data or null if invalid
 */
export function processAcademicData(fileContent: string): CourseData[] | null {
  try {
    // Parse the JSON data
    const data = JSON.parse(fileContent);

    // Validate that it's an array
    if (!Array.isArray(data)) {
      console.error("Invalid data format: Expected an array");
      return null;
    }

    // Validate each item in the array
    const validatedData: CourseData[] = data.filter((item) => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof item.code === "string" &&
        typeof item.title === "string" &&
        typeof item.grade === "string" &&
        typeof item.credits === "string" &&
        typeof item.term === "string"
      );
    });

    if (validatedData.length !== data.length) {
      console.warn(
        `Some items (${
          data.length - validatedData.length
        }) in the academic data file were invalid and filtered out`
      );
    }

    return validatedData;
  } catch (error) {
    console.error("Error processing academic data:", error);
    return null;
  }
}

/**
 * Groups course data by term (semester)
 * @param courses Array of course data
 * @returns Object with courses grouped by term
 */
export function groupCoursesByTerm(
  courses: CourseData[]
): Record<string, CourseData[]> {
  const groupedCourses: Record<string, CourseData[]> = {};

  courses.forEach((course) => {
    if (!groupedCourses[course.term]) {
      groupedCourses[course.term] = [];
    }
    groupedCourses[course.term].push(course);
  });

  return groupedCourses;
}

/**
 * Groups course data by requirement group
 * @param courses Array of course data
 * @returns Object with courses grouped by requirement group
 */
export function groupCoursesByRequirement(
  courses: CourseData[]
): Record<string, CourseData[]> {
  const groupedCourses: Record<string, CourseData[]> = {};

  courses.forEach((course) => {
    const group = course.requirementGroup || "Other";
    if (!groupedCourses[group]) {
      groupedCourses[group] = [];
    }
    groupedCourses[group].push(course);
  });

  return groupedCourses;
}

/**
 * Calculates GPA for a set of courses
 * @param courses Array of course data
 * @returns GPA value as a string with 2 decimal places
 */
export function calculateGPA(courses: CourseData[]): string {
  const gradePoints: Record<string, number | null> = {
    "A+": 4.0,
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    "D-": 0.7,
    F: 0.0,
    IP: null, // In Progress doesn't count
    WD: null, // Withdrawn doesn't count
  };

  let totalPoints = 0;
  let totalCredits = 0;

  courses.forEach((course) => {
    const grade = course.grade;
    const credits = Number.parseFloat(course.credits);

    // Only include courses that have valid grades and credits
    if (gradePoints[grade] !== null && !isNaN(credits) && credits > 0) {
      totalPoints += (gradePoints[grade] || 0) * credits;
      totalCredits += credits;
    }
  });

  // Avoid division by zero
  if (totalCredits === 0) {
    return "0.00";
  }

  return (totalPoints / totalCredits).toFixed(2);
}

/**
 * Maps academic terms to specific time slots for calendar display
 * @param term Academic term (e.g., "Fall 2022")
 * @returns A start and end date suitable for calendar display
 */
export function mapTermToCalendarDates(term: string): {
  start: Date;
  end: Date;
} {
  // Extract semester and year from term string
  const [semester, yearStr] = term.split(" ");
  const year = Number.parseInt(yearStr);

  if (isNaN(year)) {
    // Fallback for invalid years
    const currentYear = new Date().getFullYear();
    return {
      start: new Date(currentYear, 0, 1),
      end: new Date(currentYear, 11, 31),
    };
  }

  // Map semester to month ranges
  switch (semester) {
    case "Spring":
      return {
        start: new Date(year, 0, 15), // January 15
        end: new Date(year, 4, 15), // May 15
      };
    case "Summer":
      return {
        start: new Date(year, 4, 16), // May 16
        end: new Date(year, 7, 15), // August 15
      };
    case "Fall":
      return {
        start: new Date(year, 7, 16), // August 16
        end: new Date(year, 11, 15), // December 15
      };
    default:
      return {
        start: new Date(year, 0, 1), // January 1
        end: new Date(year, 11, 31), // December 31
      };
  }
}

/**
 * Gets a color for a grade value
 * @param grade The letter grade
 * @returns CSS color string
 */
export function getGradeColor(grade: string): string {
  if (grade === "IP") return "#3b82f6"; // Blue for in progress
  if (grade === "WD") return "#6b7280"; // Gray for withdrawn

  // Color based on letter grade
  if (grade.startsWith("A")) return "#4cc9f0"; // Light blue
  if (grade.startsWith("B")) return "#4361ee"; // Blue
  if (grade.startsWith("C")) return "#f8961e"; // Orange
  if (grade.startsWith("D")) return "#f94144"; // Red
  if (grade.startsWith("F")) return "#d90429"; // Dark red

  return "#6b7280"; // Default gray
}

/**
 * Calculates the total credits completed from a set of courses
 * @param courses Array of course data
 * @returns Total credits as a number
 */
export function calculateTotalCredits(courses: CourseData[]): number {
  return courses.reduce((total, course) => {
    // Only count courses that aren't withdrawn or in progress
    if (course.grade !== "WD" && course.grade !== "IP") {
      return total + Number.parseFloat(course.credits || "0");
    }
    return total;
  }, 0);
}

/**
 * Generate a summary of academic performance
 * @param courses Array of course data
 * @returns A summary object with key statistics
 */
export function generateAcademicSummary(courses: CourseData[]): {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  withdrawnCourses: number;
  totalCredits: number;
  gpa: string;
  requirementProgress: Record<string, { completed: number; total: number }>;
} {
  // Count courses by status
  const completedCourses = courses.filter(
    (c) => c.grade !== "IP" && c.grade !== "WD"
  ).length;
  const inProgressCourses = courses.filter((c) => c.grade === "IP").length;
  const withdrawnCourses = courses.filter((c) => c.grade === "WD").length;

  // Calculate total credits and GPA
  const totalCredits = calculateTotalCredits(courses);
  const gpa = calculateGPA(courses);

  // Track requirement progress
  const requirementGroups = [
    ...new Set(courses.map((c) => c.requirementGroup || "Other")),
  ];
  const requirementProgress: Record<
    string,
    { completed: number; total: number }
  > = {};

  // Initialize requirements
  requirementGroups.forEach((group) => {
    requirementProgress[group] = { completed: 0, total: 0 };
  });

  // Count completed credits per requirement
  courses.forEach((course) => {
    const group = course.requirementGroup || "Other";
    const credits = Number.parseFloat(course.credits || "0");

    if (!isNaN(credits)) {
      requirementProgress[group].total += credits;

      if (course.grade !== "WD" && course.grade !== "IP") {
        requirementProgress[group].completed += credits;
      }
    }
  });

  return {
    totalCourses: courses.length,
    completedCourses,
    inProgressCourses,
    withdrawnCourses,
    totalCredits,
    gpa,
    requirementProgress,
  };
}

/**
 * Categorizes courses by requirement group and tracks completion status
 * @param courses Array of course data
 * @returns Object with courses grouped by requirement and completion status
 */
export function categorizeRequirements(courses: CourseData[]): {
  categories: Record<
    string,
    {
      completed: CourseData[];
      totalCredits: number;
      requiredCredits: number; // This would ideally come from a requirements definition
      remainingCredits: number;
    }
  >;
} {
  // Group courses by requirement category
  const grouped: Record<string, CourseData[]> = {};

  // First, group all courses by their requirement group
  courses.forEach((course) => {
    const group = course.requirementGroup || "General Education";
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(course);
  });

  // Define estimated required credits for each category
  // In a real system, this would come from a curriculum definition
  const requiredCreditsMap: Record<string, number> = {
    "ECS/Math/Science GPA": 65,
    "CIS Core GPA (33 Credits)": 33,
    "Upper Division CIS (9 cr) Min Grade C-": 9,
    "Upper Division Courses (8 cr) Min Grade C-": 8,
    "First Year Seminar": 1,
    "General Education": 30,
    // Add fallback for any other categories
    Other: 12,
  };

  // Create the result object with completion status
  const categories: Record<
    string,
    {
      completed: CourseData[];
      totalCredits: number;
      requiredCredits: number;
      remainingCredits: number;
    }
  > = {};

  // Process each requirement group
  Object.keys(grouped).forEach((group) => {
    const coursesInGroup = grouped[group];

    // Filter to only completed courses (not WD or IP)
    const completedCourses = coursesInGroup.filter(
      (course) => course.grade !== "WD" && course.grade !== "IP"
    );

    // Calculate total credits earned in this category
    const totalCredits = calculateTotalCredits(completedCourses);

    // Get required credits (with fallback)
    const requiredCredits =
      requiredCreditsMap[group] || requiredCreditsMap["Other"];

    // Calculate remaining credits
    const remainingCredits = Math.max(0, requiredCredits - totalCredits);

    // Add to categories
    categories[group] = {
      completed: completedCourses,
      totalCredits,
      requiredCredits,
      remainingCredits,
    };
  });

  return { categories };
}

/**
 * Determines if a course meets minimum grade requirements
 * @param course The course to check
 * @param minGrade Minimum grade required (default: D)
 * @returns Boolean indicating if course meets requirements
 */
export function coursePassesRequirement(
  course: CourseData,
  minGrade = "D"
): boolean {
  if (course.grade === "WD" || course.grade === "IP") {
    return false;
  }

  // Grade point mapping
  const gradeValues: Record<string, number> = {
    "A+": 4.0,
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    "D-": 0.7,
    F: 0.0,
  };

  // Get numeric values
  const courseGradeValue = gradeValues[course.grade] || 0;
  const minGradeValue = gradeValues[minGrade] || 0;

  return courseGradeValue >= minGradeValue;
}

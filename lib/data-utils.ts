import type { Course, Requirements } from "./types";

/** Parse one CSV line respecting double-quoted fields (commas inside quotes stay) */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

// Function to parse reviews CSV including RMP_Rating
async function parseReviewsCsv(
  filePath: string
): Promise<Map<string, { RMP_Rating: string; Reviews: string[] }>> {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch reviews CSV file: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");
    const reviewsMap = new Map<string, { RMP_Rating: string; Reviews: string[] }>();

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(",");
      const professorName = values[0]?.trim() || "";
      const rating = values[1]?.trim() || "N/A";
      const reviews = [
        values[2]?.trim() || "",
        values[3]?.trim() || "",
        values[4]?.trim() || ""
      ].filter(review => review);
      if (professorName) {
        reviewsMap.set(professorName, { RMP_Rating: rating, Reviews: reviews });
      }
    }

    console.log(`Successfully parsed ${reviewsMap.size} reviews`);
    return reviewsMap;
  } catch (error) {
    console.error("Error parsing reviews CSV file:", error);
    return new Map();
  }
}

// Function to parse courses CSV and merge reviews/ratings
async function parseCoursesCsv(coursesFilePath: string, reviewsFilePath: string): Promise<Course[]> {
  try {
    // First, parse the reviews
    const reviewsMap = await parseReviewsCsv(reviewsFilePath);

    // Then, parse the courses
    const response = await fetch(coursesFilePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch courses CSV file: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");
    
    if (lines.length < 2) {
      throw new Error("Courses CSV file is empty or has no data rows");
    }

    const courses: Course[] = [];

    // Process data rows (use quote-aware CSV parse so commas inside fields don't break columns)
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = parseCSVLine(lines[i]);
      if (values.length < 6) {
        console.warn(`Skipping malformed course line: ${lines[i]}`);
        continue;
      }
      const instructorName = values[4]?.trim() || "";
      const reviewEntry = reviewsMap.get(instructorName);
      const course: Course = {
        id: `csv-course-${i}`,
        Class: values[0]?.trim() || "",
        Section: values[1]?.trim() || "",
        DaysTimes: values[2]?.trim() || "",
        Room: values[3]?.trim() || "",
        Instructor: instructorName,
        MeetingDates: values[5]?.trim() || "",
        Reviews: reviewEntry ? reviewEntry.Reviews : [],
        RMP_Rating: reviewEntry ? reviewEntry.RMP_Rating : "N/A"
      };

      if (course.Class && course.Class.match(/^[A-Z]{2,4}\s+\d{3}[A-Z]?$/)) {
        courses.push(course);
      } else {
        console.warn(`Skipping course with invalid class code or format: ${course.Class} in line: ${lines[i]}`);
      }
    }

    console.log(`Successfully parsed ${courses.length} courses from CSV`);
    return courses;
  } catch (error) {
    console.error("Error parsing courses CSV file:", error);
    return [];
  }
}

// Function to fetch requirements (uses scraper data from API when available, else static JSON)
export async function fetchRequirements(): Promise<Requirements> {
  try {
    console.log("Fetching requirements data...");
    // Prefer scraper-backed API (backend/data/ecs_requirements_cleaned.json) for actual course codes
    const apiResponse = await fetch("/api/requirements");
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      console.log("Requirements from scraper API:", Object.keys(data).length, "majors");
      return data;
    }
    // Fallback to static engineering majors JSON
    const staticResponse = await fetch("/data/engineering_majors_requirements.json");
    if (!staticResponse.ok) {
      throw new Error(`Failed to fetch requirements: ${staticResponse.status}`);
    }
    const data = await staticResponse.json();
    console.log("Requirements from static file:", Object.keys(data).length, "majors");
    return data;
  } catch (error) {
    console.error("Error fetching requirements:", error);
    return {};
  }
}

/**
 * Primary catalog: public/data/courses.json (merged from PeopleSoft XML).
 * Merges RMP/reviews from reviews.csv when instructor name matches.
 */
async function parseCoursesJson(
  jsonPath: string,
  reviewsMap: Map<string, { RMP_Rating: string; Reviews: string[] }>
): Promise<Course[]> {
  const response = await fetch(jsonPath);
  if (!response.ok) {
    return [];
  }
  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }

  const valid: Course[] = [];
  for (let i = 0; i < data.length; i++) {
    const course = data[i] as Partial<Course>;
    if (!course.Class || typeof course.Class !== "string") continue;
    const instructorName = String(course.Instructor || "").trim();
    const reviewEntry = instructorName ? reviewsMap.get(instructorName) : undefined;
    valid.push({
      ...course,
      id: course.id || `course-${i}`,
      Class: course.Class.trim(),
      Section: course.Section?.trim() || "",
      DaysTimes: course.DaysTimes?.trim() || "",
      Room: course.Room?.trim() || "",
      Instructor: instructorName,
      MeetingDates: course.MeetingDates?.trim() || "",
      Reviews: reviewEntry?.Reviews ?? course.Reviews ?? [],
      RMP_Rating: reviewEntry?.RMP_Rating ?? course.RMP_Rating ?? "N/A",
    });
  }
  return valid;
}

// Fetch courses function
export async function fetchCourses(): Promise<Course[]> {
  try {
    const reviewsMap = await parseReviewsCsv("/data/reviews.csv");

    const fromJson = await parseCoursesJson("/data/courses.json", reviewsMap);
    if (fromJson.length > 0) {
      console.log(`Loaded ${fromJson.length} courses from courses.json (primary catalog)`);
      return fromJson;
    }

    console.warn("courses.json missing or empty; falling back to courses.csv");
    const fromCsv = await parseCoursesCsv("/data/courses.csv", "/data/reviews.csv");
    if (fromCsv.length > 0) {
      console.log(`Loaded ${fromCsv.length} courses from CSV`);
      return fromCsv;
    }

    return [];
  } catch (error) {
    console.error("Error fetching course data:", error);
    return [];
  }
}

// Function to fetch mock courses - kept for testing/backup if needed
export function fetchMockCourses(): Course[] {
  console.warn("Using fallback mock data for courses");
  return [
    {
      id: "course-1",
      Class: "ECS 101",
      Section: "M001",
      DaysTimes: "MoWe 9:30AM - 10:50AM",
      Room: "Link Hall 105",
      Instructor: "J. Smith",
      MeetingDates: "01/13/2025 - 04/28/2025",
      Reviews: [
        "Great course, taught by a great professor!",
        "The professor was very knowledgeable.",
      ],
      RMP_Rating: "4.5",
    },
    {
      id: "course-2",
      Class: "CHE 106",
      Section: "M002",
      DaysTimes: "TuTh 11:00AM - 12:20PM",
      Room: "Life Sciences 001",
      Instructor: "A. Davis",
      MeetingDates: "01/13/2025 - 04/28/2025",
      Reviews: [
        "Challenging but rewarding course.",
        "Professor Davis explains concepts clearly.",
      ],
      RMP_Rating: "4.2",
    },
    // Add more mock courses as needed
  ];
}

// Example usage (optional, for testing purposes)
// async function testParsing() {
//   const courses = await fetchCourses();
//   console.log("Fetched courses:", courses);
//   const requirements = await fetchRequirements();
//   console.log("Fetched requirements:", requirements);
// }
// testParsing();

import type { Course, Requirements } from "./types";

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

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(",");
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

// Function to fetch requirements
export async function fetchRequirements(): Promise<Requirements> {
  try {
    console.log("Fetching requirements data...");
    const response = await fetch("/data/engineering_majors_requirements.json");
    if (!response.ok) {
      throw new Error(`Failed to fetch requirements: ${response.status}`);
    }
    const data = await response.json();
    console.log("Requirements data fetched successfully:", Object.keys(data).length, "majors");
    return data;
  } catch (error) {
    console.error("Error fetching requirements:", error);
    return {};
  }
}

// Fetch courses function
export async function fetchCourses(): Promise<Course[]> {
  try {
    console.log("Fetching course data from CSV...");
    
    // Use the CSV parser to fetch courses and merge reviews
    const courses = await parseCoursesCsv("/data/courses.csv", "/data/reviews.csv");
    
    if (courses.length === 0) {
      console.warn("No courses found in CSV file or failed to parse, attempting to use JSON file as fallback");
      
      // Fallback to JSON if CSV parsing fails or returns no courses
      const response = await fetch("/data/courses.json");
      if (!response.ok) {
        throw new Error(`Failed to fetch courses from JSON: ${response.status}`);
      }
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error("Fetched courses data is not an array:", data);
        throw new Error("Invalid course data format: expected an array");
      }
      
      console.log(`Successfully fetched ${data.length} courses from JSON`);
      
      // Validate each course has required fields
      const validCourses = data.filter(course => {
        if (!course.Class) {
          console.warn("Course missing Class field:", course);
          return false;
        }
        // Add default empty reviews/rating if missing in JSON
        if (!course.Reviews) course.Reviews = [];
        if (!course.RMP_Rating) course.RMP_Rating = "N/A";
        return true;
      });
      
      if (validCourses.length < data.length) {
        console.warn(`Filtered out ${data.length - validCourses.length} invalid courses`);
      }
      
      return validCourses;
    }

    console.log(`Successfully fetched ${courses.length} courses`);
    return courses;
    
  } catch (error) {
    console.error("Error fetching course data:", error);
    return []; // Return empty array on error
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

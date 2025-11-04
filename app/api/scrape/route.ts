import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

interface Course {
  code: string;
  title: string;
  credits: number;
  status: string;
  grade: string | null;
}

interface Section {
  title: string;
  credits: number;
  completed: number;
  courses: Course[];
  status: string;
}

interface Requirements {
  degree: {
    title: string;
    status: string;
    requirements: Section[];
  };
  major: {
    title: string;
    status: string;
    requirements: Section[];
  };
  sections: Section[];
  overall: {
    totalCredits: number;
    requiredCredits: number;
    completedCredits: number;
    remainingCredits: number;
    gpa: number;
    progress: number;
    status: string;
  };
}

interface BlockData {
  title: string;
  status: string;
  courses: {
    code: string;
    title: string;
    grade: string;
    credits: string;
    term: string;
  }[];
}

interface BlockResponse {
  blocks: BlockData[];
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "test.html");
    const html = fs.readFileSync(filePath, "utf-8");
    const $ = cheerio.load(html);

    const blocks: BlockData[] = [];

    // Find all course blocks with the specific class combination using fuzzy matching
    $(
      "[class*='hedtech-spacing-responsive'][class*='hedtech-container-spacing'][class*='hedtech-spacing-standard']"
    ).each((_, element) => {
      const $element = $(element);
      // Remove the first two class names
      // $element.removeClass(
      //   "hedtech-spacing-responsive hedtech-container-spacing"
      // );

      console.log(element);

      // Get the block title and clean it
      var title = $element.find("h2").text().trim().replace(/\s+/g, " ");

      // Get the status and clean it
      const status = $element.find('[id$="_statusLabel"]').text().trim();

      const courses: BlockData["courses"] = [];

      // Find all course containers with grid-container class
      $element.find("[class*='grid-container']").each((_, courseElement) => {
        const $course = $(courseElement);

        // Extract course information from the grid and clean the data
        const courseCode = $course
          .find(":contains('Course')")
          .next()
          .text()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/^Course\s+/, "") // Remove leading "Course"
          .replace(/\s+Course$/, ""); // Remove trailing "Course"

        const courseTitle = $course
          .find(":contains('Title')")
          .next()
          .text()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/^Title\s+/, "") // Remove leading "Title"
          .replace(/\s+Title$/, ""); // Remove trailing "Title"

        const grade = $course
          .find(":contains('Grade')")
          .next()
          .text()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/^Grade\s+/, "") // Remove leading "Grade"
          .replace(/\s+Grade$/, ""); // Remove trailing "Grade"

        const credits = $course
          .find(":contains('Credits')")
          .next()
          .text()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/^Credits\s+/, "") // Remove leading "Credits"
          .replace(/\s+Credits$/, ""); // Remove trailing "Credits"

        const term = $course
          .find(":contains('Term')")
          .next()
          .text()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/^Term\s+/, "") // Remove leading "Term"
          .replace(/\s+Term$/, ""); // Remove trailing "Term"

        // Validate course code format (e.g., "CIS 252")
        const isValidCourseCode = /^[A-Z]{2,4}\s+\d{3}$/.test(courseCode);

        // Skip invalid or empty courses
        if (!isValidCourseCode || !courseCode || !courseTitle) {
          return;
        }

        // Check for duplicate courses
        const isDuplicate = courses.some(
          (c) => c.code === courseCode && c.term === term
        );

        if (isDuplicate) {
          return;
        }

        // Skip exception messages and other non-course data
        if (
          courseCode.includes("Exception by:") ||
          courseCode.includes("Apply Here:") ||
          courseCode.includes("Satisfied by:")
        ) {
          return;
        }

        courses.push({
          code: courseCode,
          title: courseTitle,
          grade: grade,
          credits: credits,
          term: term,
        });
      });

      if (title && courses.length > 0) {
        blocks.push({
          title,
          status,
          courses,
        });
      }
    });

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("Error scraping data:", error);
    return NextResponse.json(
      { error: "Failed to scrape data" },
      { status: 500 }
    );
  }
}

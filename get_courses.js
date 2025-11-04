import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

const isTestEnvironment = process.env.NODE_ENV === "test";

// MySlice course history page URL
const COURSE_HISTORY_URL =
  "https://myslice.ps.syr.edu/psc/PTL9PROD/EMPLOYEE/EMPL/c/SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL";

async function getCourses() {
  let browser = null;
  try {
    if (isTestEnvironment) {
      // Test environment: Connect to existing Chrome instance
      console.log("Connecting to Chrome...");
      browser = await puppeteer.connect({
        browserURL: "http://localhost:9222",
        defaultViewport: null,
      });
    } else {
      // Production environment: Launch new browser instance
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
      });
    }

    // Get all pages
    const pages = await browser.pages();
    console.log(`Found ${pages.length} pages`);

    // Use first page or create new page
    const page = pages[0] || (await browser.newPage());

    // Visit course history page
    console.log("Accessing course history page...");
    await page.goto(COURSE_HISTORY_URL, { waitUntil: "networkidle0" });

    // Wait for course table to load
    console.log("Waiting for course table...");
    await page.waitForSelector("table.PSLEVEL1GRID", { timeout: 30000 });

    // Get course information
    console.log("Extracting course information...");
    const courses = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll("table.PSLEVEL1GRID tr")
      );
      return rows
        .slice(1)
        .map((row) => {
          const cells = row.querySelectorAll("td");
          return {
            term: cells[0]?.textContent.trim() || "",
            course: cells[1]?.textContent.trim() || "",
            title: cells[2]?.textContent.trim() || "",
            grade: cells[3]?.textContent.trim() || "",
            credits: cells[4]?.textContent.trim() || "",
            status: cells[5]?.textContent.trim() || "",
          };
        })
        .filter((course) => course.course); // Filter out empty rows
    });

    console.log(`Found ${courses.length} courses`);

    // Save course information to file
    const outputPath = path.join(
      process.cwd(),
      "public",
      "course_history.json"
    );
    fs.writeFileSync(outputPath, JSON.stringify(courses, null, 2));
    console.log(`Course information saved to ${outputPath}`);

    return courses;
  } catch (error) {
    console.error("Error getting courses:", error);
    throw error;
  } finally {
    if (browser && !isTestEnvironment) {
      await browser.close();
    }
  }
}

// Run script
getCourses()
  .then((courses) => {
    console.log("Successfully retrieved courses");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to get courses:", error);
    process.exit(1);
  });

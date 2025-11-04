import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

const isTestEnvironment = process.env.NODE_ENV === "test";

// Define constants
const MYSLICE_HOME_URL =
  "https://myslice.ps.syr.edu/psc/PTL9PROD/EMPLOYEE/EMPL/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL";
const ACADEMIC_RECORD_URL =
  "https://myslice.ps.syr.edu/psc/PTL9PROD/EMPLOYEE/EMPL/c/SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL";
const COOKIE_FILE = path.join(process.cwd(), "myslice_cookies.json");

// Save cookies to file
async function saveCookies(cookies) {
  try {
    await fs.promises.writeFile(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    console.log("✅ Cookies saved successfully");
  } catch (error) {
    console.error("Error saving cookies:", error);
  }
}

// Load cookies from file
async function loadCookies() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf8"));
      return cookies;
    }
    return null;
  } catch (error) {
    console.error("Error loading cookies:", error);
    return null;
  }
}

// Get course history
export async function getCourseHistory(cookies) {
  try {
    let browser;
    if (isTestEnvironment) {
      // Test environment: Connect to existing Chrome instance
      browser = await puppeteer.connect({
        browserURL: "http://localhost:9222",
        defaultViewport: null,
      });
    } else {
      // Production environment: Launch new browser instance
      const chromePath =
        process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : "google-chrome";

      browser = await puppeteer.launch({
        executablePath: chromePath,
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

    const page = await browser.newPage();

    // Set cookies
    if (cookies) {
      await page.setCookie(...cookies);
    }

    // Navigate to MySlice homepage
    await page.goto(MYSLICE_HOME_URL);
    await page.waitForNavigation({ waitUntil: "networkidle0" });

    // Navigate to academic record page
    await page.goto(ACADEMIC_RECORD_URL);
    await page.waitForNavigation({ waitUntil: "networkidle0" });

    // Wait for course list to load
    await page.waitForSelector(".PSLEVEL1GRID");

    // Get course data
    const courses = await page.evaluate(() => {
      const rows = document.querySelectorAll(".PSLEVEL1GRID tr");
      const courses = [];

      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 4) {
          courses.push({
            code: cells[0].textContent.trim(),
            name: cells[1].textContent.trim(),
            grade: cells[2].textContent.trim(),
            credits: cells[3].textContent.trim(),
            term: cells[4].textContent.trim(),
          });
        }
      });

      return courses;
    });

    // Save new cookies
    const newCookies = await page.cookies();
    await saveCookies(newCookies);

    return courses;
  } catch (error) {
    console.error("Error getting course history:", error);
    throw error;
  } finally {
    if (browser && !isTestEnvironment) {
      await browser.close();
    }
  }
}

// Main function
export async function main() {
  try {
    // Try to load saved cookies
    const cookies = await loadCookies();

    // Get course history
    const courses = await getCourseHistory(cookies);

    // Save course data to file
    const outputFile = path.join(process.cwd(), "course_history.json");
    await fs.promises.writeFile(outputFile, JSON.stringify(courses, null, 2));

    console.log("✅ Course history saved successfully");
    console.log("📚 Total courses:", courses.length);

    return courses;
  } catch (error) {
    console.error("Error in main function:", error);
    throw error;
  }
}

// If running this script directly
if (require.main === module) {
  main().catch(console.error);
}

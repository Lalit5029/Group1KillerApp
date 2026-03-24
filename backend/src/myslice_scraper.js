import puppeteer from "puppeteer-core";
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as cheerio from "cheerio";
dotenv.config();

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isTestEnvironment = process.env.NODE_ENV === "test";

// Define scrapingJobs object to track scraping tasks
const scrapingJobs = {};

// Generate a unique job ID
const jobId = Date.now().toString();

// Initialize job in scrapingJobs
scrapingJobs[jobId] = {
  status: "pending",
  message: "",
  log: "",
  completed: null,
  result: null,
};

// MySlice URLs
const MYSLICE_HOME_URL =
  "https://myslice.ps.syr.edu/psc/PTL9PROD/EMPLOYEE/EMPL/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL";
const COURSE_HISTORY_URL =
  "https://cs92prod.ps.syr.edu/psc/CS92PROD/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSS_MY_CRSEHIST.GBL";
const DEGREE_REQUIREMENTS_URL = "https://degreeworks.syr.edu/worksheets/WEB31";
// Manual import: allow time for 2FA + menu navigation; table often lives inside an iframe.
const MANUAL_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

// Chrome executable paths for different operating systems
const CHROME_PATHS = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
};

// Get Chrome debug WebSocket URL
async function getChromeDebugUrl() {
  try {
    const platform = process.platform;
    const chromePath = CHROME_PATHS[platform];

    if (!chromePath) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Start Chrome in debug mode
    const command = `"${chromePath}" --remote-debugging-port=9222 --user-data-dir="${join(
      __dirname,
      "chrome_profile"
    )}"`;
    console.log("Starting Chrome with command:", command);

    // Start Chrome process
    const chromeProcess = execAsync(command);
    console.log("Chrome process started");

    // Wait for Chrome to start
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log("Waited for Chrome to start");

    // Try to get debug URL multiple times
    let retries = 5;
    while (retries > 0) {
      try {
        console.log(`Attempting to get debug URL (${retries} retries left)...`);
        const response = await fetch("http://localhost:9222/json/version");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Successfully got debug URL:", data.webSocketDebuggerUrl);
        return data.webSocketDebuggerUrl;
      } catch (error) {
        console.log(`Failed to get debug URL: ${error.message}`);
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error("Failed to get Chrome debug URL:", error);
    throw error;
  }
}

// Update task log
async function updateJobLog(jobId, message) {
  try {
    const response = await fetch(
      `${
        process.env.API_BASE_URL || "http://localhost:3000"
      }/api/update-job-log`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId, log: message }),
      }
    );

    if (!response.ok) {
      console.error("Failed to update job log:", response.statusText);
    }
  } catch (error) {
    console.error("Error updating job log:", error);
  }
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isAuthorizationErrorPage(page) {
  try {
    const bodyText = await page.evaluate(() => {
      const t = document.title || "";
      const inner = document.body?.innerText || "";
      return `${t}\n${inner}`;
    });

    // PeopleSoft tends to show slightly different phrases depending on the exact security
    // denial and navigation/action mode.
    return (
      /You are not authorized to access this component/i.test(bodyText) ||
      /You have not been granted security authorization/i.test(bodyText) ||
      /You are not authorized for this page/i.test(bodyText) ||
      /\b40\s*,\s*20\b/.test(bodyText)
    );
  } catch {
    return false;
  }
}

/**
 * PeopleSoft Fluid / MySlice usually renders Course History inside an iframe.
 * page.$ / page.content() only see the top document, so we must scan all frames.
 */
async function findCourseHistoryFrame(page) {
  for (const frame of page.frames()) {
    try {
      const count = await frame.evaluate(
        () => document.querySelectorAll("tr[id^='trCRSE_HIST$']").length
      );
      if (count > 0) {
        return frame;
      }
    } catch {
      // Cross-origin or detached frame
    }
  }
  return null;
}

async function hasCourseHistoryTable(page) {
  const frame = await findCourseHistoryFrame(page);
  return !!frame;
}

async function waitForCourseHistoryTableManual(page, jobId) {
  const deadline = Date.now() + MANUAL_LOGIN_TIMEOUT_MS;
  await updateJobLog(
    jobId,
    "Direct Course History deep-link is blocked for your account (PeopleSoft 40,20 / security authorization). In the SAME Chrome window, use the left navigation and open Academics → Course History (or Student Records → Course History). If prompted, choose View/Display (not Correction/Update). Leave the window open until the course table appears."
  );

  while (Date.now() < deadline) {
    const frame = await findCourseHistoryFrame(page);
    if (frame) {
      try {
        await frame.waitForSelector("tr[id^='trCRSE_HIST$']", { timeout: 3000 });
        await updateJobLog(jobId, "Detected course history table after manual navigation.");
        return true;
      } catch {
        // keep polling
      }
    }
    await delay(1500);
  }

  await updateJobLog(
    jobId,
    `Timed out waiting for Course History table. Current URL: ${page.url()}`
  );
  return false;
}

async function waitForManualMySliceLogin(page, jobId) {
  await updateJobLog(
    jobId,
    "A fresh Chrome window has been opened for MySlice. Complete sign-in there, including 2FA, then manually open Academics -> Course History in that SAME window. Leave it open while import continues."
  );

  const startTime = Date.now();

  while (Date.now() - startTime < MANUAL_LOGIN_TIMEOUT_MS) {
    // Do not return on "any post-login URL" — that fires on the 40,20 page and MySlice
    // home before Course History loads, then login() deep-links and hits 40,20 again.
    if (await hasCourseHistoryTable(page)) {
      await updateJobLog(
        jobId,
        "Course History table found after manual navigation. Continuing import."
      );
      return;
    }

    if (await isAuthorizationErrorPage(page)) {
      await updateJobLog(
        jobId,
        "Authorization page detected. Use MySlice left menu to open Academics -> Course History in this same window."
      );
    }

    await delay(2000);
  }

  throw new Error(
    "Manual MySlice login timed out. Sign in, complete 2FA, and open Academics -> Course History in the opened browser window, then retry the import."
  );
}

// Login to MySlice and get course history
export async function login(username, password, jobId, options = {}) {
  const { manualLogin = false } = options;
  let browser = null;
  let page = null;
  try {
    if (isTestEnvironment) {
      // Test environment: Connect to existing Chrome instance
      console.log("🔍 Getting Chrome debug connection...");
      const browserWSEndpoint = await getChromeDebugUrl();
      console.log("✅ Got Chrome debug connection:", browserWSEndpoint);

      browser = await puppeteer.connect({
        browserWSEndpoint,
        defaultViewport: null,
      });
      console.log("✅ Connected to browser");

      page = await browser.newPage();
      console.log("✅ Created new page");

      // Set a longer timeout for page operations
      page.setDefaultTimeout(60000);
      console.log("✅ Set page timeout to 60 seconds");
    } else {
      // Production environment: Launch new browser instance
      const platform = process.platform;
      const chromePath = CHROME_PATHS[platform];

      if (!chromePath) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      browser = await puppeteer.launch({
        headless: manualLogin ? false : true,
        executablePath: chromePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-popup-blocking",
          ...(manualLogin ? ["--incognito"] : []),
        ],
        ignoreDefaultArgs: ["--enable-automation"],
      });

      page = await browser.newPage();
    }

    await updateJobLog(jobId, "Starting login process...");
    console.log("Starting login process...");

    // Navigate to MySlice
    console.log("Navigating to MySlice homepage...");
    await page.goto(MYSLICE_HOME_URL, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log("✅ Navigated to MySlice homepage");
    await updateJobLog(jobId, "Navigated to MySlice homepage");

    if (manualLogin) {
      await page.bringToFront();
      await waitForManualMySliceLogin(page, jobId);
      await updateJobLog(jobId, "Manual MySlice sign-in complete");
    }

    // Wait for potential redirects
    console.log("Waiting for potential redirects...");
    await page
      .waitForNavigation({ waitUntil: "networkidle0", timeout: 5000 })
      .catch(() => {
        console.log("No redirect detected, continuing...");
      });

    // Check if login is required
    const currentUrl = page.url();
    console.log("Current URL:", currentUrl);
    if (currentUrl.includes("login.microsoftonline.com")) {
      await updateJobLog(
        jobId,
        "Reached Microsoft sign-in step. If you need to sign in manually, open https://myslice.ps.syr.edu directly instead of opening a copied Microsoft login link."
      );
    } else {
      await updateJobLog(jobId, `Current URL: ${currentUrl}`);
    }

    if (!manualLogin && (currentUrl.includes("login") || currentUrl.includes("signin"))) {
      console.log("Login required, starting login process...");
      await updateJobLog(jobId, "Login required, starting login process");

      // Wait for login page to load
      console.log("Waiting for login page elements...");
      await page.waitForSelector('input[type="email"], #username', {
        timeout: 30000,
      });
      console.log("✅ Login page elements found");
      await updateJobLog(jobId, "Login page loaded");

      // Enter username
      console.log("Entering username...");
      const usernameInput = await page.$('input[type="email"], #username');
      await usernameInput.type(username);
      console.log("✅ Username entered");
      await updateJobLog(jobId, "Username entered");

      // Click next
      console.log("Clicking next button...");
      const nextButton = await page.$('input[type="submit"], #idSIButton9');
      if (!nextButton) {
        console.error("Next button not found");
        await updateJobLog(jobId, "Error: Next button not found");
        throw new Error("Next button not found");
      }
      await nextButton.click();
      console.log("✅ Next button clicked");
      await updateJobLog(jobId, "Clicked next button");

      // Check for username error
      console.log("Checking for username errors...");
      try {
        const errorElement = await page.waitForSelector(
          "#usernameError, .alert-error, .error-message",
          {
            timeout: 5000,
          }
        );
        if (errorElement) {
          const errorText = await page.evaluate(
            (el) => el.textContent.trim(),
            errorElement
          );
          console.error("Username error detected:", errorText);
          await updateJobLog(jobId, `Username error: ${errorText}`);
          throw new Error(`Username error: ${errorText}`);
        }
        console.log("✅ No username errors detected");
      } catch (error) {
        if (error.name !== "TimeoutError") {
          console.error("Username validation error:", error);
          throw error;
        }
        console.log("No username error elements found, continuing...");
      }

      // Wait for password page
      console.log("Waiting for password page...");
      await page.waitForSelector('input[type="password"]', {
        timeout: 30000,
      });
      console.log("✅ Password page loaded");

      // Enter password
      console.log("Entering password...");
      await page.type('input[type="password"]', password);
      console.log("✅ Password entered");
      await updateJobLog(jobId, "Password entered");

      // Click login
      console.log("Clicking login button...");
      const loginButton = await page.$('input[type="submit"], #idSIButton9');
      if (!loginButton) {
        console.log("Login button not found");
        await updateJobLog(jobId, "Error: Login button not found");
        throw new Error("Login button not found");
      }
      await loginButton.click();
      console.log("✅ Login button clicked");
      await updateJobLog(jobId, "Clicked login button");

      // Check for password error
      console.log("Checking for password errors...");
      try {
        const passwordError = await page.waitForSelector(
          ".passwordError, #passwordError, .alert-error, .error-message, #errorText",
          {
            timeout: 5000,
          }
        );
        if (passwordError) {
          const errorText = await page.evaluate(
            (el) => el.textContent.trim(),
            passwordError
          );
          console.log("Password error detected:", errorText);
          await updateJobLog(jobId, `Password error: ${errorText}`);
          throw new Error("Invalid username or password");
        }
        console.log("✅ No password errors detected");
      } catch (error) {
        if (error.name !== "TimeoutError") {
          console.error("Password validation error:", error);
          throw error;
        }
        console.log("No password error elements found, continuing...");
      }

      // Wait for potential 2FA page or login completion
      console.log("Checking for 2FA or login completion...");

      try {
        // Wait for either 2FA page or successful login
        await Promise.race([
          page.waitForSelector(
            "#idDiv_SAOTCC_Description, #idDiv_SAOTCC_Description_00, #idDiv_SAOTCAS_Description",
            { timeout: 10000 }
          ),
          page.waitForNavigation({
            waitUntil: "networkidle0",
            timeout: 30000,
          }),
        ]);

        // Check if we're on 2FA page
        const is2FAPage = await page.$(
          "#idDiv_SAOTCC_Description, #idDiv_SAOTCC_Description_00, #idDiv_SAOTCAS_Description"
        );
        if (is2FAPage) {
          console.log("⚠️ Two-factor authentication required");
          await updateJobLog(jobId, "Two-factor authentication required");

          // Check for timeout error
          const timeoutError = await page.$("#idDiv_SAASTO_Title");
          if (timeoutError) {
            const errorMessage = await page.evaluate(() => {
              const errorElement = document.querySelector(
                "#idDiv_SAASTO_Title"
              );
              return errorElement
                ? errorElement.textContent.trim()
                : "Authentication request timed out";
            });
            console.error("Authentication timeout:", errorMessage);
            await updateJobLog(
              jobId,
              `Authentication timeout: ${errorMessage}`
            );
            throw new Error(
              "Microsoft Authenticator request timed out. Please try again."
            );
          }

          // Get verification code number
          console.log("Getting verification code number...");
          const verificationCodeNumber = await page.evaluate(() => {
            const codeElement = document.querySelector(
              "#idRichContext_DisplaySign"
            );
            return codeElement ? codeElement.textContent.trim() : null;
          });

          if (verificationCodeNumber) {
            console.log("Verification code number:", verificationCodeNumber);
            await updateJobLog(
              jobId,
              `Verification code number: ${verificationCodeNumber}`
            );
          }

          // Wait for page to redirect to home page
          console.log("Waiting for page to redirect to home page...");
          try {
            await page.waitForNavigation({
              waitUntil: "networkidle0",
              timeout: 60000,
            });
            console.log("✅ Successfully redirected to home page");
            await updateJobLog(jobId, "Successfully redirected to home page");
          } catch (error) {
            console.error("Failed to redirect to home page:", error);
            await updateJobLog(
              jobId,
              `Failed to redirect to home page: ${error.message}`
            );
            throw error;
          }
        }

        console.log("✅ Login completed successfully");
        await updateJobLog(jobId, "Login successful");
      } catch (error) {
        console.error("Login error:", error);
        await updateJobLog(jobId, `Login error: ${error.message}`);
        throw error;
      }
    } else {
      console.log("Already logged in, proceeding to course history");
      await updateJobLog(
        jobId,
        "Already logged in, proceeding to course history"
      );
    }

    // Manual mode: never deep-link to CS92 Course History URL (triggers 40,20 for many accounts).
    // Headless automated login may still use the direct URL when the table is not already visible.
    const alreadyOnCourseHistory = await hasCourseHistoryTable(page);
    if (manualLogin && !alreadyOnCourseHistory) {
      const foundManually = await waitForCourseHistoryTableManual(page, jobId);
      if (!foundManually) {
        throw new Error(
          "Could not detect Course History table in manual mode. Open Academics -> Course History in the same browser window and retry."
        );
      }
      await updateJobLog(jobId, "Detected Course History table in manual mode.");
    } else if (!alreadyOnCourseHistory) {
      await page.goto(COURSE_HISTORY_URL, {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 60000,
      });
      await updateJobLog(jobId, "Navigated to course history page");
    } else {
      await updateJobLog(
        jobId,
        "Already viewing Course History; skipping duplicate navigation to course history URL."
      );
    }

    // If this account cannot directly open the component, allow manual navigation flow.
    if (await isAuthorizationErrorPage(page)) {
      if (!manualLogin) {
        throw new Error(
          "MySlice returned 'not authorized (40,20)' for Course History. Re-run import with manual login enabled, then open Academics → Course History in the browser window when prompted."
        );
      }
      await updateJobLog(
        jobId,
        "Direct Course History access was blocked after login. Open Academics -> Course History in the same browser window and leave it open while import continues."
      );
      const foundManually = await waitForCourseHistoryTableManual(page, jobId);
      if (!foundManually) {
        throw new Error(
          "MySlice account is not authorized for direct Course History component access. Open Course History manually in the same window and retry import."
        );
      }
    } else {
      // Wait for course table to load (may be inside an iframe)
      const deadline = Date.now() + 30000;
      let courseFrame = await findCourseHistoryFrame(page);
      while (!courseFrame && Date.now() < deadline) {
        await delay(400);
        courseFrame = await findCourseHistoryFrame(page);
      }
      if (courseFrame) {
        await courseFrame.waitForSelector("tr[id^='trCRSE_HIST$']", {
          timeout: 15000,
        });
      } else {
        await page.waitForSelector("tr[id^='trCRSE_HIST$']", { timeout: 30000 });
      }
      await updateJobLog(jobId, "Course table loaded");
    }

    // Scrape HTML from the frame that actually contains course rows (not only top document)
    const courseHistoryFrame = await findCourseHistoryFrame(page);
    const htmlData = courseHistoryFrame
      ? await courseHistoryFrame.content()
      : await page.content();
    await updateJobLog(
      jobId,
      courseHistoryFrame
        ? "Retrieved course data (from Course History iframe)"
        : "Retrieved course data (top document)"
    );

    // Parse course data
    const courses = await parseCourseData(htmlData);
    await updateJobLog(jobId, `Successfully parsed ${courses.length} courses`);

    // Save course data
    const outputFile = path.join(process.cwd(), "course_history.json");
    await fs.promises.writeFile(outputFile, JSON.stringify(courses, null, 2));
    await updateJobLog(jobId, `Course data saved to ${outputFile}`);

    // Navigate to DegreeWorks page
    await page.goto(DEGREE_REQUIREMENTS_URL, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 100000,
    });
    await updateJobLog(jobId, "Navigated to degree requirements page");

    await updateJobLog(jobId, "DegreeWorks content loaded");

    // Get page content
    const degreeWorksHtml = await page.content();
    await updateJobLog(jobId, "Retrieved DegreeWorks data");

    // Parse DegreeWorks data using cheerio
    const $ = cheerio.load(degreeWorksHtml);
    const blocks = [];

    // Find containers with specific classes
    $(
      ".hedtech-spacing-responsive.hedtech-container-spacing.hedtech-spacing-standard"
    ).each((_, container) => {
      const $container = $(container);

      // Find h2 header within the container
      const $header = $container.find("h2");
      if (!$header.length) return; // Skip if no header found

      const title = $header.text().trim().replace(/\s+/g, " ");
      if (!title) return; // Skip if title is empty

      // Get the status from the header's parent or container
      const status =
        $header.parent().find("svg").length > 0 ? "Complete" : "Incomplete";

      const courses = [];

      // Get course information from table rows
      $container.find("tr").each((_, row) => {
        const $row = $(row);
        const tds = $row.find("td");

        if (tds.length >= 5) {
          // Ensure we have all required columns
          const courseCode = $(tds[0]).find("p").text().trim();
          const courseTitle = $(tds[1]).find("p").text().trim();
          const grade = $(tds[2]).find("p").text().trim();
          const credits = $(tds[3]).find("p").text().trim();
          const term = $(tds[4]).find("p").text().trim();

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

          courses.push({
            code: courseCode,
            title: courseTitle,
            grade: grade,
            credits: credits,
            term: term,
          });
        }
      });

      if (courses.length > 0) {
        blocks.push({
          title: title,
          status: status,
          courses: courses,
        });
      }
    });

    // Save the parsed blocks data
    fs.writeFileSync(
      path.join(__dirname, "..", "degree_requirements.json"),
      JSON.stringify(blocks, null, 2)
    );

    console.log("courses:", courses);
    console.log("blocks:", blocks);

    return { courses, blocks };
  } catch (error) {
    await updateJobLog(jobId, `Error: ${error.message}`);
    throw error;
  } finally {
    if (browser && !isTestEnvironment) {
      await browser.close();
    }
  }
}

// Parse course data
function parseCourseData(html) {
  const $ = cheerio.load(html);
  const courses = [];
  const seenCourses = new Set();

  // Find all course rows
  $('tr[id^="trCRSE_HIST$"]').each((index, element) => {
    const row = $(element);

    // Extract course code from CRSE_NAME span
    const code = row.find('span[id^="CRSE_NAME$"]').text().trim();

    // Extract course title from PSHYPERLINK class
    const title = row.find("a.PSHYPERLINK").text().trim();

    // Extract term from CRSE_TERM span
    const term = row.find('span[id^="CRSE_TERM$"]').text().trim();

    // Extract grade from ps-label span
    const grade = row
      .find('div[id^="win0divDERIVED_SSS_HST_SSR_GRADE_LONG$"] span.ps-label')
      .text()
      .trim();

    // Extract credits from CRSE_UNITS span
    const credits = row.find('span[id^="CRSE_UNITS$"]').text().trim();

    // Extract status from image alt text
    const status =
      row.find('img[src*="PS_CS_CREDIT_TAKEN_ICN"]').attr("alt") || "Unknown";

    // Only add the course if we have the essential information
    if (code && title) {
      const dedupeKey = [code, term, title, grade || "IP", credits || "0"]
        .map((value) => String(value || "").trim().toUpperCase())
        .join("::");

      if (seenCourses.has(dedupeKey)) {
        return;
      }

      seenCourses.add(dedupeKey);

      courses.push({
        code,
        name: title,
        term,
        grade: grade || "IP", // IP = In Progress if no grade
        credits: credits || "0",
        requirementGroup: null, // This will be set later based on the course code
        isRecommended: false,
        isFuture: false,
      });
    }
  });

  return courses;
}

// Login to MySlice and get course history
scrapingJobs[jobId].log += "Logging in to MySlice...\n";
try {
  const { courses, blocks } = await login(username, password, jobId);
  scrapingJobs[jobId].log += "Login successful\n";
  scrapingJobs[jobId].log += `Successfully fetched ${courses.length} courses\n`;
  scrapingJobs[
    jobId
  ].log += `Successfully fetched ${blocks.length} degree requirement blocks\n`;

  // Update task status
  scrapingJobs[jobId].status = "completed";
  scrapingJobs[
    jobId
  ].message = `Successfully scraped ${courses.length} courses and ${blocks.length} degree requirement blocks`;
  scrapingJobs[jobId].completed = new Date();
  scrapingJobs[jobId].result = { courses, blocks };
} catch (error) {
  scrapingJobs[jobId].status = "failed";
  scrapingJobs[jobId].message = error.message;
  scrapingJobs[jobId].completed = new Date();
  scrapingJobs[jobId].log += `Login failed: ${error.message}\n`;
}

import express from "express";
import cors from "cors";
import { login } from "../myslice_scraper.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Store scraping job status
const scrapingJobs = {};

// API Routes
app.post("/api/scrape-academic-record", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password are required",
    });
  }

  const jobId = Date.now().toString();

  // Set initial job status
  scrapingJobs[jobId] = {
    jobId,
    status: "running",
    message: "Starting academic record scraper...",
    started: new Date(),
    completed: null,
    result: null,
    log: "Starting academic record scraper...\n",
  };

  console.log(`Starting scraping job ${jobId}`);

  // Return immediately with jobId
  res.json({
    jobId,
    status: "running",
    message: "Starting academic record scraper...",
    log: scrapingJobs[jobId].log,
  });

  // Start scraping process asynchronously
  (async () => {
    try {
      // Login to MySlice and get course history
      scrapingJobs[jobId].log += "Logging in to MySlice...\n";
      try {
        const { courses, blocks } = await login(username, password, jobId);
        scrapingJobs[jobId].log += "Login successful\n";
        scrapingJobs[
          jobId
        ].log += `Successfully fetched ${courses.length} courses\n`;
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
    } catch (error) {
      console.error("Scraping error:", error);
      scrapingJobs[jobId].status = "failed";
      scrapingJobs[jobId].message = error.message;
      scrapingJobs[jobId].completed = new Date();
      scrapingJobs[jobId].log += `Error: ${error.message}\n`;
    }
  })();
});

// Update job log endpoint
app.post("/api/update-job-log", (req, res) => {
  const { jobId, log } = req.body;
  console.log(`Updating log for job ${jobId}`);

  if (scrapingJobs[jobId]) {
    scrapingJobs[jobId].log += log + "\n";
    res.json({ success: true });
  } else {
    console.log(`Job ${jobId} not found`);
    res.status(404).json({
      error: "Job not found",
      jobId,
    });
  }
});

// Check job status endpoint
app.get("/api/scrape-status/:jobId", (req, res) => {
  const { jobId } = req.params;
  console.log(`Checking status for job ${jobId}`);

  if (scrapingJobs[jobId]) {
    res.json(scrapingJobs[jobId]);
  } else {
    console.log(`Job ${jobId} not found`);
    res.status(404).json({
      error: "Job not found",
      jobId,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Academic scraper API running on port ${PORT}`);
  console.log(`Backend directory: ${process.cwd()}`);
  console.log(`Project root: ${process.cwd()}`);
});

export default app;

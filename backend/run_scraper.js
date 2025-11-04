import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory of the current script
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define path to the Python script
const scriptPath = path.join(__dirname, 'src', 'scrapers', 'ScrapeCourses.py');

// Check if Python script exists
if (!fs.existsSync(scriptPath)) {
  console.error(`Python script not found at: ${scriptPath}`);
  process.exit(1);
}

console.log(`Running Python script: ${scriptPath}`);

// Run the Python scraper using the system Python
const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
const pythonProcess = spawn(pythonExecutable, [scriptPath], { 
  stdio: 'inherit', // This will pipe the output directly to the console
  cwd: __dirname
});

pythonProcess.on('close', (code) => {
  console.log(`Scraper exited with code ${code}`);
  
  // Check results file
  const resultPath = path.join(__dirname, 'data', 'user_completed_courses.json');
  if (code === 0 && fs.existsSync(resultPath)) {
    console.log(`Results saved to: ${resultPath}`);
    
    // Display number of courses scraped
    try {
      const data = fs.readFileSync(resultPath, 'utf8');
      const courses = JSON.parse(data);
      console.log(`Successfully scraped ${courses.length} courses`);
    } catch (error) {
      console.error(`Error reading results file: ${error.message}`);
    }
  }
});

pythonProcess.on('error', (err) => {
  console.error(`Failed to start scraper process: ${err.message}`);
}); 
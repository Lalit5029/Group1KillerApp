// Academic Progress Tracker
// Main JavaScript file

console.log("Academic Progress Script loaded. Initializing...");

// --- Global Variables ---
let studentCourses = [];
let majorRequirements = {};
let selectedMajor = "";
let selectedYear = "";
let ecsMajorRequirements = {};

// --- Constants ---
const requirementsFile = "engineering_majors_requirements.json";
const ecsRequirementsFile = "backend/app_data/ecs_requirements_cleaned.json";
const studentCoursesFile = "backend/user_completed_courses.json";
const API_BASE_URL = "http://localhost:3001";

// GPA calculation constants
const gradePoints = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  D: 1.0,
  F: 0.0,
  IP: null,
  WD: null, // In Progress and Withdrawn don't count
};

// Requirement groups for progress tracking
const requirementGroups = {
  "ECS/Math/Science GPA": {
    name: "ECS, Math & Science",
    required: 65,
    completed: 0,
  },
  "CIS Core GPA (33 Credits)": { name: "CIS Core", required: 33, completed: 0 },
  "Upper Division CIS (9 cr) Min Grade C-": {
    name: "Upper Division CIS",
    required: 9,
    completed: 0,
  },
  "Upper Division Courses (8 cr) Min Grade C-": {
    name: "Upper Division Electives",
    required: 8,
    completed: 0,
  },
  "First Year Seminar": {
    name: "First Year Seminar",
    required: 1,
    completed: 0,
  },
};

// --- DOM Elements ---
const majorDisplay = document.getElementById("major-display");
const yearDisplay = document.getElementById("year-display");
const timelineContainer = document.querySelector(".timeline");
const tableBody = document.getElementById("courses-table-body");
const requirementsCards = document.getElementById("requirements-cards");
const remainingCoursesList = document.getElementById("remaining-courses-list");
const notificationArea = document.getElementById("notification-area");

// --- Utility Functions ---

/**
 * Shows a notification message
 */
function showNotification(message, type = "normal", duration = 4000) {
  if (!notificationArea) {
    console.error("Notification area not found");
    alert(message);
    return;
  }

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Add to DOM
  notificationArea.appendChild(notification);

  // Force browser to process the addition before adding visible class
  notification.offsetHeight; // Force reflow

  // Make visible with transition
  notification.classList.add("visible");

  // Set up removal
  const removeNotification = () => {
    notification.classList.remove("visible");
    // Wait for transition to complete before removing from DOM
    notification.addEventListener(
      "transitionend",
      () => {
        notification.remove();
      },
      { once: true }
    );
  };

  // Set timeout for automatic removal
  setTimeout(removeNotification, duration);

  // Allow click to dismiss early
  notification.addEventListener(
    "click",
    () => {
      removeNotification();
    },
    { once: true }
  );
}

/**
 * Calculates GPA from an array of courses
 */
function calculateGPA(courses) {
  let totalPoints = 0;
  let totalCredits = 0;

  courses.forEach((course) => {
    const grade = course.grade;
    const credits = Number.parseFloat(course.credits);

    if (gradePoints[grade] !== null && !isNaN(credits) && credits > 0) {
      totalPoints += gradePoints[grade] * credits;
      totalCredits += credits;
    }
  });

  return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00";
}

/**
 * Calculates total credits earned from completed courses
 */
function calculateTotalCredits(courses) {
  return courses.reduce((total, course) => {
    // Only count courses with valid grades (not IP or WD)
    if (gradePoints[course.grade] !== null) {
      return total + Number.parseFloat(course.credits || 0);
    }
    return total;
  }, 0);
}

/**
 * Gets a color for a grade
 */
function getGradeColor(grade) {
  if (grade === "IP") return "var(--primary-color)"; // Blue for in progress
  if (grade === "WD") return "var(--gray-500)"; // Gray for withdrawn

  // Color based on letter grade
  if (grade.startsWith("A")) return "#4cc9f0"; // Light blue
  if (grade.startsWith("B")) return "#4361ee"; // Blue
  if (grade.startsWith("C")) return "#f8961e"; // Orange
  if (grade.startsWith("D")) return "#f94144"; // Red
  if (grade.startsWith("F")) return "#d90429"; // Dark red

  return "var(--gray-600)"; // Default
}

// --- Data Fetching Functions ---

/**
 * Fetches student course data (tries scraper output first, then a default if needed)
 */
async function fetchStudentCourses() {
  console.log(`Attempting to load student data from: ${studentCoursesFile}...`);
  try {
    const response = await fetch(studentCoursesFile); // Check if scraper output exists
    if (!response.ok) {
      if (response.status === 404) {
        console.log("Scraper output not found. Need to import first.");
        // Return empty or load a default placeholder if you have one
        // Example: Load a default placeholder
        // const defaultDataPath = 'backend/app_data/default_student_placeholder.json';
        // const defaultResponse = await fetch(defaultDataPath);
        // if (!defaultResponse.ok) throw new Error(`Failed to load default placeholder: ${defaultResponse.statusText}`);
        // const data = await defaultResponse.json();
        // studentCourses = data;
        // return data;
        studentCourses = []; // Reset to empty if no scraper data
        showNotification(
          "Please import your academic record using the 'Import from MySlice' button.",
          "info"
        );
        return [];
      } else {
        throw new Error(
          `HTTP ${response.status} fetching ${studentCoursesFile}`
        );
      }
    }
    const data = await response.json();
    console.log(`Loaded ${data.length} courses from ${studentCoursesFile}`);
    // Don't overwrite if we have imported courses waiting
    if (currentlyImportedCourses.length === 0) {
      studentCourses = data;
    }
    return data;
  } catch (error) {
    console.error("Error fetching student courses:", error);
    showNotification(`Error loading student data: ${error.message}`, "error");
    studentCourses = []; // Reset on error
    return [];
  }
}

/**
 * Fetches NEW ECS major requirements data
 */
async function fetchECSRequirements() {
  console.log(`Fetching ECS requirements: ${ecsRequirementsFile}...`);
  try {
    const response = await fetch(ecsRequirementsFile);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} fetching ${ecsRequirementsFile}`
      );
    }
    const data = await response.json();
    console.log("ECS requirements data fetched");
    // Store requirements indexed by program name for easy lookup
    ecsMajorRequirements = data.reduce((acc, req) => {
      if (req.program) {
        acc[req.program] = req;
      }
      return acc;
    }, {});
    return ecsMajorRequirements;
  } catch (error) {
    console.error("Error fetching ECS requirements:", error);
    showNotification(
      `Error loading ECS requirements data: ${error.message}`,
      "error"
    );
    return {};
  }
}

/**
 * Fetches major requirements data
 */
function fetchRequirements() {
  console.log(`Fetching ${requirementsFile}...`);
  return fetch(requirementsFile)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${requirementsFile}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Requirements data fetched");
      majorRequirements = data.Unknown;
      return data.Unknown;
    });
}

// --- UI Rendering Functions ---

/**
 * Updates the statistics display
 */
function updateStatistics() {
  // Count completed courses (excluding WD and IP)
  const completedCourses = studentCourses.filter(
    (course) => gradePoints[course.grade] !== null
  );

  // Calculate total credits
  const totalCredits = calculateTotalCredits(studentCourses);

  // Calculate GPA
  const gpa = calculateGPA(studentCourses);

  // Calculate degree progress (simplified)
  const totalRequiredCredits = 120; // Standard for most BS degrees
  const progressPercentage = Math.min(
    100,
    Math.round((totalCredits / totalRequiredCredits) * 100)
  );

  // Update the DOM
  document.getElementById("stat-courses").textContent = completedCourses.length;
  document.getElementById("stat-credits").textContent = totalCredits;
  document.getElementById("stat-gpa").textContent = gpa;
  document.getElementById(
    "stat-progress"
  ).textContent = `${progressPercentage}%`;
}

/**
 * Renders the timeline view
 */
function renderTimeline() {
  if (!timelineContainer) {
    console.error("Timeline container not found");
    return;
  }

  timelineContainer.innerHTML = "";

  // Group courses by term
  const coursesByTerm = {};
  studentCourses.forEach((course) => {
    if (!coursesByTerm[course.term]) {
      coursesByTerm[course.term] = [];
    }
    coursesByTerm[course.term].push(course);
  });

  // Sort terms chronologically
  const sortedTerms = Object.keys(coursesByTerm).sort((a, b) => {
    const termA = a.split(" ");
    const termB = b.split(" ");

    // Compare years first
    const yearA = Number.parseInt(termA[1]);
    const yearB = Number.parseInt(termB[1]);
    if (yearA !== yearB) return yearA - yearB;

    // If years are the same, compare semesters
    const semesterOrder = { Spring: 0, Summer: 1, Fall: 2 };
    return semesterOrder[termA[0]] - semesterOrder[termB[0]];
  });

  // Create timeline items for each term
  sortedTerms.forEach((term, index) => {
    const courses = coursesByTerm[term];

    const timelineItem = document.createElement("div");
    timelineItem.className = "timeline-item";

    const timelineHeader = document.createElement("div");
    timelineHeader.className = "timeline-header";
    timelineHeader.innerHTML = `
           <div class="timeline-semester">${term}</div>
           <div class="timeline-credits">${calculateTotalCredits(
             courses
           )} Credits</div>
           <div class="timeline-gpa">GPA: ${calculateGPA(courses)}</div>
       `;

    const timelineCourses = document.createElement("div");
    timelineCourses.className = "timeline-courses";

    courses.forEach((course) => {
      const courseItem = document.createElement("div");
      courseItem.className = "timeline-course";

      // Add special class for in-progress or withdrawn courses
      if (course.grade === "IP") {
        courseItem.classList.add("course-in-progress");
      } else if (course.grade === "WD") {
        courseItem.classList.add("course-withdrawn");
      }

      courseItem.innerHTML = `
               <div class="course-code">${course.course}</div>
               <div class="course-title">${course.title}</div>
               <div class="course-grade" style="color: ${getGradeColor(
                 course.grade
               )}">${course.grade}</div>
               <div class="course-credits">${course.credits} cr</div>
           `;

      timelineCourses.appendChild(courseItem);
    });

    timelineItem.appendChild(timelineHeader);
    timelineItem.appendChild(timelineCourses);
    timelineContainer.appendChild(timelineItem);
  });
}

/**
 * Renders the table view
 */
function renderTableView() {
  if (!tableBody) {
    console.error("Table body not found");
    return;
  }

  tableBody.innerHTML = "";

  // Sort courses by term and then by course code
  const sortedCourses = [...studentCourses].sort((a, b) => {
    // First sort by term
    const termA = a.term.split(" ");
    const termB = b.term.split(" ");

    const yearA = Number.parseInt(termA[1]);
    const yearB = Number.parseInt(termB[1]);
    if (yearA !== yearB) return yearA - yearB;

    const semesterOrder = { Spring: 0, Summer: 1, Fall: 2 };
    const semesterCompare = semesterOrder[termA[0]] - semesterOrder[termB[0]];
    if (semesterCompare !== 0) return semesterCompare;

    // Then sort by course code
    return a.course.localeCompare(b.course);
  });

  sortedCourses.forEach((course) => {
    const row = document.createElement("tr");

    // Add special class for in-progress or withdrawn courses
    if (course.grade === "IP") {
      row.classList.add("course-in-progress");
    } else if (course.grade === "WD") {
      row.classList.add("course-withdrawn");
    }

    row.innerHTML = `
           <td>${course.course}</td>
           <td>${course.title}</td>
           <td>${course.term}</td>
           <td>${course.credits}</td>
           <td style="color: ${getGradeColor(course.grade)}">${
      course.grade
    }</td>
           <td>${course.requirementGroup || "General Education"}</td>
       `;

    tableBody.appendChild(row);
  });
}

/**
 * Renders the requirements progress cards
 */
function renderRequirementsProgress() {
  if (!requirementsCards) {
    console.error("Requirements cards container not found");
    return;
  }

  requirementsCards.innerHTML = "";

  // Reset completion counts
  Object.keys(requirementGroups).forEach((key) => {
    requirementGroups[key].completed = 0;
  });

  // Count completed credits for each requirement group
  studentCourses.forEach((course) => {
    if (course.requirementGroup && requirementGroups[course.requirementGroup]) {
      // Only count if not withdrawn and has credits
      if (course.grade !== "WD" && Number.parseFloat(course.credits) > 0) {
        requirementGroups[course.requirementGroup].completed +=
          Number.parseFloat(course.credits);
      }
    }
  });

  // Create cards for each requirement group
  Object.keys(requirementGroups).forEach((key) => {
    const group = requirementGroups[key];
    const percentComplete = Math.min(
      100,
      Math.round((group.completed / group.required) * 100)
    );

    const card = document.createElement("div");
    card.className = "requirement-card";

    card.innerHTML = `
           <div class="requirement-title">${group.name}</div>
           <div class="requirement-progress">
               <div class="progress-bar">
                   <div class="progress-fill" style="width: ${percentComplete}%"></div>
               </div>
               <div class="progress-text">${group.completed}/${group.required} credits (${percentComplete}%)</div>
           </div>
       `;

    requirementsCards.appendChild(card);
  });
}

/**
 * Renders the list of remaining required courses
 */
function renderRemainingCourses() {
  if (!remainingCoursesList || !majorRequirements[selectedMajor]) {
    console.error(
      "Remaining courses list container or major requirements not found"
    );
    return;
  }

  remainingCoursesList.innerHTML = "";

  // Get all required courses for the selected major and year
  const allRequiredCourses = [];

  // For a senior, we need to include all years
  const yearsToInclude = ["Freshman", "Sophomore", "Junior", "Senior"];

  yearsToInclude.forEach((year) => {
    if (majorRequirements[selectedMajor][year]) {
      majorRequirements[selectedMajor][year].forEach((course) => {
        allRequiredCourses.push(course);
      });
    }
  });

  // Get list of completed courses (not WD)
  const completedCourses = studentCourses
    .filter((course) => course.grade !== "WD")
    .map((course) => course.course);

  // Find courses that are required but not completed
  const remainingCourses = allRequiredCourses.filter(
    (course) => !completedCourses.includes(course)
  );

  // Create the remaining courses list
  if (remainingCourses.length === 0) {
    remainingCoursesList.innerHTML = `
           <div class="empty-state">
               <i class="fas fa-check-circle"></i>
               <p>All required courses completed!</p>
           </div>
       `;
  } else {
    // Group by year level
    const coursesByYear = {
      Freshman: [],
      Sophomore: [],
      Junior: [],
      Senior: [],
    };

    remainingCourses.forEach((course) => {
      // Find which year this course belongs to
      for (const year of yearsToInclude) {
        if (majorRequirements[selectedMajor][year]?.includes(course)) {
          coursesByYear[year].push(course);
          break;
        }
      }
    });

    // Create sections for each year
    yearsToInclude.forEach((year) => {
      if (coursesByYear[year].length > 0) {
        const yearSection = document.createElement("div");
        yearSection.className = "remaining-year-section";

        yearSection.innerHTML = `
                   <h4>${year} Requirements</h4>
                   <div class="remaining-courses-grid">
                       ${coursesByYear[year]
                         .map(
                           (course) => `
                           <div class="remaining-course">
                               <i class="fas fa-book"></i>
                               <span>${course}</span>
                           </div>
                       `
                         )
                         .join("")}
                   </div>
               `;

        remainingCoursesList.appendChild(yearSection);
      }
    });
  }
}

/**
 * Renders the requirements modal content
 */
function renderRequirementsModal() {
  const requirementsContent = document.getElementById("requirements-content");
  if (!requirementsContent || !majorRequirements[selectedMajor]) {
    console.error(
      "Requirements content container or major requirements not found"
    );
    return;
  }

  requirementsContent.innerHTML = "";

  // Create sections for each year
  const years = ["Freshman", "Sophomore", "Junior", "Senior"];

  years.forEach((year) => {
    if (majorRequirements[selectedMajor][year]) {
      const yearSection = document.createElement("div");
      yearSection.className = "requirements-year";

      yearSection.innerHTML = `
               <h4>${year} Year</h4>
               <ul class="requirements-list">
                   ${majorRequirements[selectedMajor][year]
                     .map((course) => {
                       // Check if course is completed
                       const courseData = studentCourses.find(
                         (c) => c.course === course
                       );
                       const isCompleted =
                         courseData && courseData.grade !== "WD";
                       const isInProgress =
                         courseData && courseData.grade === "IP";

                       let statusClass = "";
                       let statusIcon = "";

                       if (isCompleted) {
                         statusClass = "completed";
                         statusIcon = '<i class="fas fa-check-circle"></i>';
                       } else if (isInProgress) {
                         statusClass = "in-progress";
                         statusIcon = '<i class="fas fa-clock"></i>';
                       } else {
                         statusClass = "not-started";
                         statusIcon = '<i class="fas fa-times-circle"></i>';
                       }

                       return `
                           <li class="requirement-item ${statusClass}">
                               ${statusIcon}
                               <span>${course}</span>
                               ${
                                 courseData
                                   ? `<span class="requirement-grade">${courseData.grade}</span>`
                                   : ""
                               }
                           </li>
                       `;
                     })
                     .join("")}
               </ul>
           `;

      requirementsContent.appendChild(yearSection);
    }
  });
}

/**
 * Applies filters to the course displays
 */
function applyFilters() {
  const termFilter = document.getElementById("filter-term").value;
  const requirementFilter = document.getElementById("filter-requirement").value;

  // Apply to timeline view
  const timelineItems = document.querySelectorAll(".timeline-item");
  timelineItems.forEach((item) => {
    const termHeader = item.querySelector(".timeline-semester");
    if (termHeader) {
      const term = termHeader.textContent;

      if (termFilter && term !== termFilter) {
        item.style.display = "none";
      } else {
        item.style.display = "block";
      }
    }
  });

  // Apply to table view
  const tableRows = document.querySelectorAll("#courses-table-body tr");
  tableRows.forEach((row) => {
    const termCell = row.cells[2];
    const requirementCell = row.cells[5];

    let showRow = true;

    if (termFilter && termCell.textContent !== termFilter) {
      showRow = false;
    }

    if (
      requirementFilter &&
      !requirementCell.textContent.includes(requirementFilter)
    ) {
      showRow = false;
    }

    row.style.display = showRow ? "" : "none";
  });
}

/**
 * Toggles between timeline and table views
 */
function toggleView() {
  const timelineView = document.getElementById("timeline-view");
  const tableView = document.getElementById("table-view");

  if (timelineView.style.display === "none") {
    timelineView.style.display = "block";
    tableView.style.display = "none";
  } else {
    timelineView.style.display = "none";
    tableView.style.display = "block";
  }
}

/**
 * Shows the requirements modal
 */
function showRequirementsModal() {
  renderRequirementsModal();

  const modal = document.getElementById("requirements-modal");
  if (modal) {
    modal.classList.add("modal-visible");
  }
}

/**
 * Closes the requirements modal
 */
function closeRequirementsModal() {
  const modal = document.getElementById("requirements-modal");
  if (modal) {
    modal.classList.remove("modal-visible");
  }
}

/**
 * Exports the academic progress as PDF
 */
function exportProgress(format) {
  if (format === "pdf") {
    showNotification("Preparing PDF export...", "normal", 2000);
    setTimeout(() => {
      window.print();
    }, 500);
  }
}

// --- Main Initialization ---

/**
 * Loads student data and renders the UI
 */
function loadStudentData() {
  showNotification("Loading academic data...", "normal", 3000);

  // Get selected major and year from localStorage (shared with scheduler)
  const storedMajor = localStorage.getItem("selectedMajor");
  const storedYear = localStorage.getItem("selectedYear");

  if (storedMajor && storedYear) {
    selectedMajor = storedMajor;
    selectedYear = storedYear;
  } else {
    // Get the first available major from requirements
    const availableMajors = Object.keys(majorRequirements);
    selectedMajor = availableMajors.length > 0 ? availableMajors[0] : "";
    selectedYear = "Freshman";
  }

  // Update the display with selected major and year
  if (majorDisplay)
    majorDisplay.textContent = selectedMajor.replace(", BS", "");
  if (yearDisplay) yearDisplay.textContent = selectedYear;

  // Fetch both data sources
  Promise.all([
    fetchStudentCourses(),
    fetchECSRequirements(),
    fetchRequirements(),
  ])
    .then(([courses, ecsRequirements, requirements]) => {
      // Render all UI components
      updateStatistics();
      renderTimeline();
      renderTableView();
      renderRequirementsProgress();
      renderRemainingCourses();

      showNotification("Academic data loaded successfully", "success", 2000);
    })
    .catch((error) => {
      console.error("Error loading data:", error);
      showNotification(`Error loading data: ${error.message}`, "error", 5000);
    });
}

// Initialize the application when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing application...");
  loadStudentData();
});

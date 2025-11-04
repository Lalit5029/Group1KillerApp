// Engineering Course Planner - Combined JavaScript
// Handles both Course Scheduler and Academic Progress functionality

// --- Global Variables ---
// Shared
let courses = [];
let requirements = {};
let selectedCourses = [];
let selectedMajor = "";
let selectedYear = "";
const courseNotes = {};
let suggestedCourses = [];

// Course Scheduler specific
let currentSearchResults = [];
let currentCourseDetails = null;
let currentNotesCourseId = null;
let isSearchPopupOpen = false;
const isCourseDetailsModalOpen = false;
const isNotesModalOpen = false;
let isInitialModalOpen = true;
let isSuggestedCoursesModalOpen = false;
let currentView = "calendar";

// Academic Progress specific
let studentCourses = [];
const currentProgressView = "timeline";

// Add new state variables for AI progress tracking
let aiProgressData = null;
let isProgressDashboardVisible = false;

// --- Constants ---
const CALENDAR_START_HOUR = 8; // 8 AM
const HOUR_HEIGHT = 60; // 60px per hour
const MINUTES_PER_HOUR = 60;
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_MAP = {
  mo: "Monday",
  tu: "Tuesday",
  we: "Wednesday",
  th: "Thursday",
  fr: "Friday",
};

// GPA calculation constants
const GRADE_POINTS = {
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
const REQUIREMENT_GROUPS = {
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
// Shared
const majorDisplay = document.getElementById("major-display");
const yearDisplay = document.getElementById("year-display");
const notificationArea = document.getElementById("notification-area");

// Course Scheduler
const schedulerSection = document.getElementById("scheduler-section");
const calendarView = document.getElementById("calendar-view");
const listView = document.getElementById("list-view");
const scheduleTableBody = document.getElementById("schedule-table-body");
const scheduleStats = document.getElementById("schedule-stats");
const searchPopup = document.getElementById("search-popup");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const courseDetailsModal = document.getElementById("course-details-modal");
const courseDetailsContent = document.getElementById("course-details-content");
const courseNotesModal = document.getElementById("course-notes-modal");
const courseNotesTextarea = document.getElementById("course-notes-textarea");
const notesCourseInfo = document.getElementById("notes-course-info");
const initialSelectionModal = document.getElementById(
  "initial-selection-modal"
);
const majorSelect = document.getElementById("major-select");
const yearSelect = document.getElementById("year-select");
const confirmSelectionBtn = document.getElementById("confirm-selection-btn");
const generateScheduleBtn = document.getElementById("generate-schedule-btn");
const searchCoursesBtn = document.getElementById("search-courses-btn");
const suggestedCoursesModal = document.getElementById(
  "suggested-courses-modal"
);
const suggestedCoursesList = document.getElementById("suggested-courses-list");
const suggestedMajorSpan = document.getElementById("suggested-major");
const suggestedYearSpan = document.getElementById("suggested-year");

// Academic Progress
const progressSection = document.getElementById("progress-section");
const timelineContainer = document.querySelector(".timeline");
const tableView = document.getElementById("table-view");
const coursesTableBody = document.getElementById("courses-table-body");
const requirementsCards = document.getElementById("requirements-cards");
const remainingCoursesList = document.getElementById("remaining-courses-list");
const requirementsModal = document.getElementById("requirements-modal");
const requirementsContent = document.getElementById("requirements-content");
const progressStats = document.getElementById("progress-stats");

// --- Utility Functions ---

/**
 * Shows a notification message
 */
function showNotification(message, type = "normal", duration = 4000) {
  const id = Date.now().toString();
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.dataset.id = id;

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
  notification.addEventListener("click", () => {
    removeNotification();
  });

  return id;
}

/**
 * Gets department code from class name
 */
function getDepartmentCode(className) {
  if (!className) return "";
  const match = className.match(/^([A-Za-z]+)/);
  return match ? match[1] : "";
}

/**
 * Gets department styling class for calendar view
 */
function getDepartmentClass(className) {
  if (!className) return "border-gray-400 bg-gray-100";

  const deptCode = getDepartmentCode(className);

  const deptColors = {
    BEN: "border-blue-500 bg-blue-50",
    CSE: "border-green-500 bg-green-50",
    MAE: "border-red-500 bg-red-50",
    CEN: "border-yellow-500 bg-yellow-50",
    CEE: "border-purple-500 bg-purple-50",
    ELE: "border-teal-500 bg-teal-50",
    MAT: "border-orange-500 bg-orange-50",
    PHY: "border-indigo-500 bg-indigo-50",
    CHE: "border-emerald-500 bg-emerald-50",
    ECS: "border-cyan-500 bg-cyan-50",
    AEE: "border-rose-500 bg-rose-50",
    WRT: "border-gray-500 bg-gray-50",
  };

  return deptColors[deptCode] || "border-gray-400 bg-gray-100";
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

    if (GRADE_POINTS[grade] !== null && !isNaN(credits) && credits > 0) {
      totalPoints += GRADE_POINTS[grade] * credits;
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
    if (GRADE_POINTS[course.grade] !== null) {
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

/**
 * Check for time conflicts between courses
 */
function hasConflict(newCourse, existingCourses) {
  if (!newCourse?.DaysTimes || typeof newCourse.DaysTimes !== "string")
    return false;

  const dayRegex = /Mo|Tu|We|Th|Fr/gi;
  const timeRegex =
    /(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M)/i;

  const newDays = newCourse.DaysTimes.match(dayRegex) || [];
  const newTimeMatch = newCourse.DaysTimes.match(timeRegex);

  if (!newTimeMatch || newDays.length === 0) return false;

  const parseTimeToMinutes = (h, m, ap) => {
    let hr = Number.parseInt(h, 10);
    const mn = Number.parseInt(m, 10);

    if (
      typeof ap !== "string" ||
      isNaN(hr) ||
      isNaN(mn) ||
      hr < 1 ||
      hr > 12 ||
      mn < 0 ||
      mn > 59
    ) {
      return Number.NaN;
    }

    const isPM = ap.toUpperCase() === "PM";
    if (isPM && hr !== 12) hr += 12;
    else if (!isPM && hr === 12) hr = 0;

    return hr * 60 + mn;
  };

  const newStart = parseTimeToMinutes(
    newTimeMatch[1],
    newTimeMatch[2],
    newTimeMatch[3]
  );
  const newEnd = parseTimeToMinutes(
    newTimeMatch[4],
    newTimeMatch[5],
    newTimeMatch[6]
  );

  if (isNaN(newStart) || isNaN(newEnd) || newStart >= newEnd) return false;

  for (const existingCourse of existingCourses) {
    if (
      !existingCourse?.DaysTimes ||
      typeof existingCourse.DaysTimes !== "string"
    )
      continue;

    const existingDays = existingCourse.DaysTimes.match(dayRegex) || [];
    const existingTimeMatch = existingCourse.DaysTimes.match(timeRegex);

    if (!existingTimeMatch || existingDays.length === 0) continue;

    const existingStart = parseTimeToMinutes(
      existingTimeMatch[1],
      existingTimeMatch[2],
      existingTimeMatch[3]
    );
    const existingEnd = parseTimeToMinutes(
      existingTimeMatch[4],
      existingTimeMatch[5],
      existingTimeMatch[6]
    );

    if (
      isNaN(existingStart) ||
      isNaN(existingEnd) ||
      existingStart >= existingEnd
    )
      continue;

    const daysOverlap = newDays.some((nd) =>
      existingDays.some((ed) => nd.toLowerCase() === ed.toLowerCase())
    );

    if (daysOverlap) {
      const timeOverlap = newStart < existingEnd && existingStart < newEnd;
      if (timeOverlap) {
        return true;
      }
    }
  }

  return false;
}

// --- Data Fetching Functions ---

/**
 * Fetches course data
 */
function fetchCourses() {
  return fetch("courses.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching courses.json`);
      }
      return response.json();
    })
    .then((data) => {
      console.log(`Fetched ${data.length} courses`);
      courses = data;
      return data;
    });
}

/**
 * Fetches student course data
 */
function fetchStudentCourses() {
  return fetch("parsed_courses.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching parsed_courses.json`);
      }
      return response.json();
    })
    .then((data) => {
      console.log(`Fetched ${data.length} student courses`);
      studentCourses = data;
      return data;
    });
}

/**
 * Fetches major requirements data
 */
function fetchRequirements() {
  return fetch("engineering_majors_requirements.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching requirements`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Requirements data fetched");
      requirements = data;
      return data;
    });
}

// --- Tab Switching ---

/**
 * Switches between scheduler and progress tabs
 */
function switchTab(tab) {
  // Update active tab
  document
    .getElementById("scheduler-nav")
    .classList.toggle("active", tab === "scheduler");
  document
    .getElementById("progress-nav")
    .classList.toggle("active", tab === "progress");

  // Show/hide appropriate content
  if (tab === "scheduler") {
    schedulerSection.style.display = "block";
    progressSection.style.display = "none";
  } else {
    schedulerSection.style.display = "none";
    progressSection.style.display = "block";

    // Load progress data if not already loaded
    if (studentCourses.length === 0) {
      loadStudentData();
    }
  }
}

// --- Course Scheduler Functions ---

/**
 * Initializes the course scheduler
 */
function initializeScheduler() {
  // Populate majors dropdown
  if (Object.keys(requirements).length > 0) {
    majorSelect.innerHTML = '<option value="">Select a major</option>';

    Object.keys(requirements).forEach((major) => {
      const option = document.createElement("option");
      option.value = major;
      option.textContent = major;
      majorSelect.appendChild(option);
    });

    majorSelect.disabled = false;
    document.getElementById("loading-majors").style.display = "none";

    // Enable confirm button if major is selected
    majorSelect.addEventListener("change", () => {
      confirmSelectionBtn.disabled = !majorSelect.value;
    });

    // Handle selection confirmation
    confirmSelectionBtn.addEventListener("click", () => {
      handleSelectionConfirm(majorSelect.value, yearSelect.value);
    });
  }

  // Render schedule stats
  renderScheduleStats();

  // Render empty calendar
  renderCalendar();
}

/**
 * Handles major and year selection confirmation
 */
function handleSelectionConfirm(major, year) {
  selectedMajor = major;
  selectedYear = year;

  // Update display
  majorDisplay.textContent = major.replace(", BS", "");
  yearDisplay.textContent = year;

  // Save to localStorage for sharing with academic progress page
  localStorage.setItem("selectedMajor", major);
  localStorage.setItem("selectedYear", year);

  // Close modal
  isInitialModalOpen = false;
  initialSelectionModal.classList.remove("modal-visible");

  // Enable buttons
  generateScheduleBtn.disabled = false;
  searchCoursesBtn.disabled = false;

  // Show notification
  showNotification(`Selected ${major} - ${year}`, "success");

  // Load courses if not already loaded
  if (courses.length === 0) {
    fetchCourses()
      .then(() => {
        showNotification("Course data loaded successfully", "success");
      })
      .catch((error) => {
        console.error("Failed to load courses:", error);
        showNotification("Failed to load courses. Please try again.", "error");
      });
  }
}

/**
 * Shows the suggested courses modal
 */
function showSuggestedCoursesModal() {
  if (
    !selectedMajor ||
    !selectedYear ||
    Object.keys(requirements).length === 0 ||
    courses.length === 0
  ) {
    showNotification(
      "Please confirm selection or wait for data to load.",
      "error"
    );
    return;
  }

  // Get suggested courses for the selected major and year
  const suggestedCourseCodes = requirements[selectedMajor]?.[selectedYear];

  if (!suggestedCourseCodes || suggestedCourseCodes.length === 0) {
    showNotification(
      "No suggested courses listed for your selection.",
      "warning"
    );
    return;
  }

  // Update modal content
  suggestedMajorSpan.textContent = selectedMajor.replace(", BS", "");
  suggestedYearSpan.textContent = selectedYear;
  suggestedCoursesList.innerHTML = "";
  suggestedCourses = [];

  // Find course details for each suggested course code
  suggestedCourseCodes.forEach((code) => {
    if (!code) return;

    const possibleSections = courses.filter(
      (c) => c.Class?.toLowerCase() === code.toLowerCase()
    );

    if (possibleSections.length > 0) {
      // Find a section that doesn't conflict with current schedule
      let nonConflictingSection = null;
      for (const section of possibleSections) {
        if (!hasConflict(section, selectedCourses)) {
          nonConflictingSection = section;
          break;
        }
      }

      // If all sections conflict, use the first one but mark it
      const bestSection = nonConflictingSection || possibleSections[0];
      const hasTimeConflict =
        !nonConflictingSection && possibleSections.length > 0;

      // Add to suggested courses list
      suggestedCourses.push({
        ...bestSection,
        id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        hasConflict: hasTimeConflict,
      });

      // Create UI element
      const courseItem = document.createElement("div");
      courseItem.className = `suggested-course-item ${getDepartmentClass(
        bestSection.Class
      )}`;

      // Add conflict warning if needed
      let conflictWarning = "";
      if (hasTimeConflict) {
        conflictWarning =
          '<span class="conflict-warning"><i class="fas fa-exclamation-triangle"></i> Time conflict</span>';
      }

      courseItem.innerHTML = `
        <div class="suggested-course-info">
          <div class="suggested-course-title">${bestSection.Class} ${
        bestSection.Section
      }</div>
          <div class="suggested-course-description">
            ${bestSection.DaysTimes || "TBA"} - ${bestSection.Room || "TBA"}
            ${conflictWarning}
          </div>
          <div class="suggested-course-details">
            Instructor: ${bestSection.Instructor || "TBA"}
          </div>
        </div>
        <div class="suggested-course-action">
          <button onclick="addSuggestedCourse(${
            suggestedCourses.length - 1
          })" class="primary-button" ${hasTimeConflict ? "disabled" : ""}>
            <i class="fas fa-plus"></i> Add
          </button>
        </div>
      `;

      suggestedCoursesList.appendChild(courseItem);
    } else {
      // Course not found
      const courseItem = document.createElement("div");
      courseItem.className = "suggested-course-item border-gray-300 bg-gray-50";

      courseItem.innerHTML = `
        <div class="suggested-course-info">
          <div class="suggested-course-title">${code}</div>
          <div class="suggested-course-description">
            <i class="fas fa-exclamation-circle"></i> No sections available for this course
          </div>
        </div>
      `;

      suggestedCoursesList.appendChild(courseItem);
    }
  });

  // Show modal
  isSuggestedCoursesModalOpen = true;
  suggestedCoursesModal.classList.add("modal-visible");
}

/**
 * Closes the suggested courses modal
 */
function closeSuggestedCoursesModal() {
  isSuggestedCoursesModalOpen = false;
  suggestedCoursesModal.classList.remove("modal-visible");
}

/**
 * Adds a single suggested course to the schedule
 */
function addSuggestedCourse(index) {
  const course = suggestedCourses[index];

  if (!course) {
    showNotification("Course not found.", "error");
    return;
  }

  if (course.hasConflict) {
    showNotification(
      `Cannot add ${course.Class} ${course.Section}: Time conflict with existing courses.`,
      "warning"
    );
    return;
  }

  const alreadyAdded = selectedCourses.some(
    (sc) => sc.Class === course.Class && sc.Section === course.Section
  );

  if (alreadyAdded) {
    showNotification(
      `${course.Class} ${course.Section} is already added.`,
      "warning"
    );
    return;
  }

  selectedCourses.push(course);
  showNotification(`Added ${course.Class} ${course.Section}`, "success");

  // Update UI
  renderScheduleStats();
  renderCalendar();
  renderScheduleList();
}

/**
 * Adds all suggested courses to the schedule
 */
function addAllSuggestedCourses() {
  let addedCount = 0;
  let conflictCount = 0;

  suggestedCourses.forEach((course) => {
    if (course.hasConflict) {
      conflictCount++;
      return;
    }

    const alreadyAdded = selectedCourses.some(
      (sc) => sc.Class === course.Class && sc.Section === course.Section
    );

    if (!alreadyAdded) {
      selectedCourses.push(course);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    showNotification(
      `Added ${addedCount} course(s) to your schedule.`,
      "success"
    );

    // Update UI
    renderScheduleStats();
    renderCalendar();
    renderScheduleList();
  }

  if (conflictCount > 0) {
    showNotification(
      `${conflictCount} course(s) had time conflicts and were not added.`,
      "warning"
    );
  }

  // Close modal
  closeSuggestedCoursesModal();
}

/**
 * Generates best schedule based on major and year
 */
function generateBestSchedule() {
  if (
    !selectedMajor ||
    !selectedYear ||
    Object.keys(requirements).length === 0 ||
    courses.length === 0
  ) {
    showNotification(
      "Please confirm selection or wait for data to load.",
      "error"
    );
    return;
  }

  // Reset current schedule
  selectedCourses = [];

  // Get suggested courses for the selected major and year
  const suggestedCourseCodes = requirements[selectedMajor]?.[selectedYear];

  if (!suggestedCourseCodes || suggestedCourseCodes.length === 0) {
    showNotification(
      "No suggested courses listed for your selection.",
      "warning"
    );
    return;
  }

  let coursesAddedCount = 0;

  suggestedCourseCodes.forEach((code) => {
    if (!code) return;

    const possibleSections = courses.filter(
      (c) => c.Class?.toLowerCase() === code.toLowerCase()
    );

    let added = false;
    for (const section of possibleSections) {
      if (!hasConflict(section, selectedCourses)) {
        selectedCourses.push({
          ...section,
          id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
        added = true;
        coursesAddedCount++;
        break;
      }
    }

    if (!added && possibleSections.length > 0) {
      showNotification(
        `Could not add "${code}": All sections conflict.`,
        "warning"
      );
    } else if (possibleSections.length === 0) {
      showNotification(`Course code "${code}" not found.`, "warning");
    }
  });

  if (coursesAddedCount > 0) {
    showNotification(
      `Added ${coursesAddedCount} suggested course(s).`,
      "success"
    );
  }

  // Update UI
  renderScheduleStats();
  renderCalendar();
  renderScheduleList();
}

/**
 * Resets the schedule
 */
function resetSchedule() {
  selectedCourses = [];
  renderScheduleStats();
  renderCalendar();
  renderScheduleList();
  showNotification("Schedule cleared.", "normal");
}

/**
 * Toggles search popup
 */
function toggleSearchPopup() {
  isSearchPopupOpen = !isSearchPopupOpen;

  if (isSearchPopupOpen) {
    searchPopup.classList.add("modal-visible");
    searchInput.focus();
    currentSearchResults = [];
    searchResults.innerHTML =
      '<p class="empty-search">Enter a search term to find courses.</p>';
  } else {
    searchPopup.classList.remove("modal-visible");
  }
}

/**
 * Handles search input key down
 */
function handleSearchKeyDown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    searchCourses();
  }
}

/**
 * Searches courses
 */
function searchCourses() {
  const query = searchInput.value.trim();

  if (!query) {
    currentSearchResults = [];
    searchResults.innerHTML =
      '<p class="empty-search">Enter a search term to find courses.</p>';
    return;
  }

  const queryLower = query.toLowerCase();
  currentSearchResults = courses.filter(
    (c) =>
      c.Class?.toLowerCase().includes(queryLower) ||
      c.Instructor?.toLowerCase().includes(queryLower)
  );

  if (currentSearchResults.length === 0) {
    searchResults.innerHTML =
      '<p class="empty-search">No courses found matching your search.</p>';
  } else {
    searchResults.innerHTML = "";

    currentSearchResults.forEach((course, index) => {
      const resultItem = document.createElement("div");
      resultItem.className = `search-result-item ${getDepartmentClass(
        course.Class
      )}`;

      resultItem.innerHTML = `
                <div class="search-result-info">
                    <div class="search-result-title">${course.Class} ${
        course.Section
      }</div>
                    <div class="search-result-details">
                        ${course.DaysTimes || "TBA"} - ${
        course.Instructor || "N/A"
      }
                    </div>
                </div>
                <div class="search-result-action">
                    <button onclick="addCourseFromSearch(${index})" class="primary-button">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
            `;

      searchResults.appendChild(resultItem);
    });
  }
}

/**
 * Adds course from search results
 */
function addCourseFromSearch(index) {
  const course = currentSearchResults[index];

  if (!course) {
    showNotification("Course not found in search results.", "error");
    return;
  }

  const alreadyAdded = selectedCourses.some(
    (sc) => sc.Class === course.Class && sc.Section === course.Section
  );

  if (alreadyAdded) {
    showNotification(
      `${course.Class} ${course.Section} is already added.`,
      "warning"
    );
    return;
  }

  if (!hasConflict(course, selectedCourses)) {
    const newCourse = {
      ...course,
      id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    selectedCourses.push(newCourse);
    showNotification(`${course.Class} ${course.Section} added.`, "success");

    // Update UI
    renderScheduleStats();
    renderCalendar();
    renderScheduleList();
  } else {
    showNotification(
      `Conflict: Cannot add ${course.Class} ${course.Section}.`,
      "warning"
    );
  }
}

/**
 * Removes a course from the schedule
 */
function removeCourse(courseId) {
  const courseToRemove = selectedCourses.find((c) => c.id === courseId);

  if (courseToRemove) {
    selectedCourses = selectedCourses.filter((c) => c.id !== courseId);
    showNotification(
      `Removed ${courseToRemove.Class} ${courseToRemove.Section}`,
      "normal"
    );

    // Update UI
    renderScheduleStats();
    renderCalendar();
    renderScheduleList();
  }
}

/**
 * Shows course details
 */
function showCourseDetails(courseId) {
  const course = selectedCourses.find((c) => c.id === courseId);

  if (!course) {
    showNotification("Course not found.", "error");
    return;
  }

  currentCourseDetails = course;

  courseDetailsContent.innerHTML = `
        <h3 class="text-lg font-semibold text-primary">
            ${course.Class} ${course.Section || ""}
        </h3>

        <div class="detail-item">
            <i class="fas fa-calendar"></i>
            <div>
                <div class="detail-label">Days/Times</div>
                <div>${course.DaysTimes || "TBA"}</div>
            </div>
        </div>

        <div class="detail-item">
            <i class="fas fa-user"></i>
            <div>
                <div class="detail-label">Instructor</div>
                <div>${course.Instructor || "TBA"}</div>
            </div>
        </div>

        <div class="detail-item">
            <i class="fas fa-map-marker-alt"></i>
            <div>
                <div class="detail-label">Room</div>
                <div>${course.Room || "TBA"}</div>
            </div>
        </div>

        <div class="detail-item">
            <i class="fas fa-calendar-day"></i>
            <div>
                <div class="detail-label">Meeting Dates</div>
                <div>${course.MeetingDates || "TBA"}</div>
            </div>
        </div>
    `;

  courseDetailsModal.classList.add("modal-visible");
}

/**
 * Closes course details modal
 */
function closeCourseDetailsModal() {
  courseDetailsModal.classList.remove("modal-visible");
  currentCourseDetails = null;
}

/**
 * Opens notes modal for a course
 */
function openNotesModal(courseId) {
  const course = selectedCourses.find((c) => c.id === courseId);

  if (!course) {
    showNotification("Course not found.", "error");
    return;
  }

  currentNotesCourseId = courseId;
  courseNotesTextarea.value = courseNotes[courseId] || "";
  notesCourseInfo.textContent = `${course.Class} ${course.Section}`;

  courseNotesModal.classList.add("modal-visible");
}

/**
 * Closes course notes modal
 */
function closeCourseNotesModal() {
  courseNotesModal.classList.remove("modal-visible");
  currentNotesCourseId = null;
}

/**
 * Saves notes for a course
 */
function saveNotes() {
  if (currentNotesCourseId) {
    const notes = courseNotesTextarea.value;

    if (notes.trim()) {
      courseNotes[currentNotesCourseId] = notes;
      showNotification("Notes saved successfully", "success");
    } else {
      // Remove notes if empty
      delete courseNotes[currentNotesCourseId];
    }
  }

  closeCourseNotesModal();

  // Update UI to show notes indicators
  renderCalendar();
  renderScheduleList();
}

/**
 * Toggles between calendar and list views
 */
function toggleView() {
  currentView = currentView === "calendar" ? "list" : "calendar";

  if (currentView === "calendar") {
    calendarView.style.display = "block";
    listView.style.display = "none";
  } else {
    calendarView.style.display = "none";
    listView.style.display = "block";
  }
}

/**
 * Exports the schedule
 */
function exportSchedule() {
  showNotification("Preparing schedule export...", "normal", 2000);
  setTimeout(() => {
    window.print();
  }, 500);
}

/**
 * Applies filters to the schedule
 */
function applyFilters() {
  const departmentFilter = document.getElementById("department-filter").value;
  const timeFilter = document.getElementById("time-filter").value;

  // Filter courses
  const filteredCourses = selectedCourses.filter((course) => {
    let passesFilter = true;

    // Department filter
    if (departmentFilter) {
      const deptCode = getDepartmentCode(course.Class);
      if (deptCode !== departmentFilter) {
        passesFilter = false;
      }
    }

    // Time filter
    if (timeFilter && passesFilter) {
      const timeMatch = course.DaysTimes?.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
      if (timeMatch) {
        let hour = Number.parseInt(timeMatch[1]);
        const period = timeMatch[3].toUpperCase();

        // Convert to 24-hour
        if (period === "PM" && hour !== 12) hour += 12;
        if (period === "AM" && hour === 12) hour = 0;

        if (timeFilter === "morning" && (hour < 8 || hour >= 12)) {
          passesFilter = false;
        } else if (timeFilter === "afternoon" && (hour < 12 || hour >= 17)) {
          passesFilter = false;
        } else if (timeFilter === "evening" && hour < 17) {
          passesFilter = false;
        }
      }
    }

    return passesFilter;
  });

  // Update UI with filtered courses
  renderCalendar(filteredCourses);
  renderScheduleList(filteredCourses);
}

/**
 * Renders schedule statistics
 */
function renderScheduleStats() {
  if (!scheduleStats) return;

  // Count total courses
  const totalCourses = selectedCourses.length;

  // Estimate credit hours (most courses are 3-4 credits)
  const estimatedCredits = Math.round(totalCourses * 3.5);

  // Calculate total class hours per week
  let totalMinutes = 0;
  selectedCourses.forEach((course) => {
    if (course.DaysTimes) {
      const timeMatch = course.DaysTimes.match(
        /(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M)/i
      );
      if (timeMatch) {
        const startHour = Number.parseInt(timeMatch[1]);
        const startMin = Number.parseInt(timeMatch[2]);
        const startPeriod = timeMatch[3];
        const endHour = Number.parseInt(timeMatch[4]);
        const endMin = Number.parseInt(timeMatch[5]);
        const endPeriod = timeMatch[6];

        // Convert to 24-hour format
        let start24Hour = startHour;
        if (startPeriod.toUpperCase() === "PM" && startHour !== 12)
          start24Hour += 12;
        if (startPeriod.toUpperCase() === "AM" && startHour === 12)
          start24Hour = 0;

        let end24Hour = endHour;
        if (endPeriod.toUpperCase() === "PM" && endHour !== 12) end24Hour += 12;
        if (endPeriod.toUpperCase() === "AM" && endHour === 12) end24Hour = 0;

        // Calculate duration in minutes
        const startMinutes = start24Hour * 60 + startMin;
        const endMinutes = end24Hour * 60 + endMin;
        const duration = endMinutes - startMinutes;

        // Count days
        const dayMatches = course.DaysTimes.match(/Mo|Tu|We|Th|Fr/gi) || [];
        const dayCount = dayMatches.length;

        // Add to total (duration * days per week)
        if (duration > 0 && dayCount > 0) {
          totalMinutes += duration * dayCount;
        }
      }
    }
  });

  // Convert minutes to hours
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal

  // Count unique departments
  const departments = new Set();
  selectedCourses.forEach((course) => {
    if (course.Class) {
      const deptCode = course.Class.match(/^([A-Za-z]+)/);
      if (deptCode) departments.add(deptCode[1]);
    }
  });

  // Render stats
  scheduleStats.innerHTML = `
    <div class="stat-item">
      <div class="stat-icon"><i class="fas fa-book"></i></div>
      <div class="stat-content">
        <div class="stat-value">${totalCourses}</div>
        <div class="stat-label">Total Courses</div>
      </div>
    </div>

    <div class="stat-item">
      <div class="stat-icon"><i class="fas fa-graduation-cap"></i></div>
      <div class="stat-content">
        <div class="stat-value">${estimatedCredits}</div>
        <div class="stat-label">Credit Hours</div>
      </div>
    </div>

    <div class="stat-item">
      <div class="stat-icon"><i class="fas fa-clock"></i></div>
      <div class="stat-content">
        <div class="stat-value">${totalHours}</div>
        <div class="stat-label">Class Hours</div>
      </div>
    </div>

    <div class="stat-item">
      <div class="stat-icon"><i class="fas fa-building"></i></div>
      <div class="stat-content">
        <div class="stat-value">${departments.size}</div>
        <div class="stat-label">Departments</div>
      </div>
    </div>
  `;
}

/**
 * Renders the calendar view
 */
function renderCalendar(coursesToRender = selectedCourses) {
  if (!calendarView) return;

  // Generate time markers (8 AM to 7 PM)
  const timeMarkers = Array.from({ length: 12 }, (_, i) => {
    const hour = i + CALENDAR_START_HOUR;
    return hour <= 12 ? `${hour} AM` : `${hour - 12} PM`;
  });

  // Create calendar structure
  let calendarHTML = `
    <div class="weekly-calendar">
      <div class="time-column">
        ${timeMarkers
          .map((time) => `<div class="time-marker">${time}</div>`)
          .join("")}
      </div>
  `;

  // Add day columns
  DAYS_OF_WEEK.forEach((day) => {
    calendarHTML += `
      <div class="day-column">
        <div class="day-header">${day}</div>
        <div class="day-schedule">
          ${Array.from({ length: 12 })
            .map(
              (_, i) =>
                `<div class="hour-marker" style="top: ${
                  i * HOUR_HEIGHT
                }px;"></div>`
            )
            .join("")}
    `;

    // Add courses for this day
    coursesToRender.forEach((course) => {
      if (!course.DaysTimes) {
        // Handle TBA courses - only show on Monday
        if (day === "Monday") {
          calendarHTML += `
            <div class="course-slot ${getDepartmentClass(course.Class)} ${
            courseNotes[course.id] ? "has-notes" : ""
          }"
                 style="top: 0; height: 60px;"
                 onclick="showCourseDetails('${course.id}')">
              <div class="course-code">${course.Class} ${
            course.Section
          } (TBA)</div>
              <div class="course-time">${course.DaysTimes || "TBA"}</div>
              <div class="course-instructor">${course.Instructor || "N/A"}</div>
              <div class="course-room">${course.Room || "N/A"}</div>
            </div>
          `;
        }
        return;
      }

      // Check if this course should be displayed on this day
      const dayRegex = /Mo|Tu|We|Th|Fr/gi;
      const matchedDays = course.DaysTimes.match(dayRegex) || [];

      const shouldDisplayOnDay = matchedDays.some(
        (d) => DAY_MAP[d.toLowerCase()] === day
      );

      if (!shouldDisplayOnDay) return;

      // Parse time for positioning
      const timeRegex =
        /(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M)/i;
      const timeMatch = course.DaysTimes.match(timeRegex);

      if (!timeMatch) return;

      // Calculate position and height
      const startHour = Number.parseInt(timeMatch[1]);
      const startMinute = Number.parseInt(timeMatch[2]);
      const startPeriod = timeMatch[3].toUpperCase();
      const endHour = Number.parseInt(timeMatch[4]);
      const endMinute = Number.parseInt(timeMatch[5]);
      const endPeriod = timeMatch[6].toUpperCase();

      // Convert to 24-hour format
      let start24Hour = startHour;
      if (startPeriod === "PM" && startHour !== 12) start24Hour += 12;
      if (startPeriod === "AM" && startHour === 12) start24Hour = 0;

      let end24Hour = endHour;
      if (endPeriod === "PM" && endHour !== 12) end24Hour += 12;
      if (endPeriod === "AM" && endHour === 12) end24Hour = 0;

      // Calculate minutes from calendar start
      const startMinutes =
        start24Hour * 60 + startMinute - CALENDAR_START_HOUR * 60;
      const endMinutes = end24Hour * 60 + endMinute - CALENDAR_START_HOUR * 60;

      // Calculate position and height
      const topPosition = (startMinutes / MINUTES_PER_HOUR) * HOUR_HEIGHT;
      const height =
        ((endMinutes - startMinutes) / MINUTES_PER_HOUR) * HOUR_HEIGHT;

      calendarHTML += `
        <div class="course-slot ${getDepartmentClass(course.Class)} ${
        courseNotes[course.id] ? "has-notes" : ""
      }"
             style="top: ${topPosition}px; height: ${height}px;"
             onclick="showCourseDetails('${course.id}')">
          <div class="course-code">${course.Class} ${course.Section}</div>
          <div class="course-time">${timeMatch[1]}:${timeMatch[2]} ${
        timeMatch[3]
      }-${timeMatch[4]}:${timeMatch[5]} ${timeMatch[6]}</div>
          <div class="course-instructor">${course.Instructor || "N/A"}</div>
          <div class="course-room">${course.Room || "N/A"}</div>
        </div>
      `;
    });

    calendarHTML += `
        </div>
      </div>
    `;
  });

  calendarHTML += `</div>`;

  calendarView.innerHTML = calendarHTML;
}

/**
 * Renders the schedule list view
 */
function renderScheduleList(coursesToRender = selectedCourses) {
  if (!scheduleTableBody) return;

  scheduleTableBody.innerHTML = "";

  if (coursesToRender.length === 0) {
    scheduleTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted-foreground">
          No courses added yet.
        </td>
      </tr>
    `;
    return;
  }

  coursesToRender.forEach((course) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${course.Class || "N/A"}</td>
      <td>${course.Section || "N/A"}</td>
      <td>${course.DaysTimes || "TBA"}</td>
      <td>${course.Instructor || "N/A"}</td>
      <td>${course.Room || "N/A"}</td>
      <td>
        <div class="table-actions">
          <button onclick="showCourseDetails('${
            course.id
          }')" class="icon-button" title="View Details">
            <i class="fas fa-info-circle"></i>
          </button>
          <button onclick="openNotesModal('${
            course.id
          }')" class="icon-button" title="Add Notes">
            <i class="fas fa-sticky-note"></i>
          </button>
          <button onclick="removeCourse('${
            course.id
          }')" class="icon-button" title="Remove Course">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    `;

    scheduleTableBody.appendChild(row);
  });
}

// --- Academic Progress Functions ---

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
    const availableMajors = Object.keys(requirements);
    selectedMajor = availableMajors.length > 0 ? availableMajors[0] : "";
    selectedYear = "Freshman";
  }

  // Update the display with selected major and year
  if (majorDisplay)
    majorDisplay.textContent = selectedMajor.replace(", BS", "");
  if (yearDisplay) yearDisplay.textContent = selectedYear;

  // Fetch both data sources
  Promise.all([fetchStudentCourses(), fetchRequirements()])
    .then(([courses, requirements]) => {
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

/**
 * Updates the statistics display
 */
function updateStatistics() {
  // Count completed courses (excluding WD and IP)
  const completedCourses = studentCourses.filter(
    (course) => GRADE_POINTS[course.grade] !== null
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
  if (!coursesTableBody) {
    console.error("Table body not found");
    return;
  }

  coursesTableBody.innerHTML = "";

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
      <td style="color: ${getGradeColor(course.grade)}">${course.grade}</td>
      <td>${course.requirementGroup || "General Education"}</td>
    `;

    coursesTableBody.appendChild(row);
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
  Object.keys(REQUIREMENT_GROUPS).forEach((key) => {
    REQUIREMENT_GROUPS[key].completed = 0;
  });

  // Count completed credits for each requirement group
  studentCourses.forEach((course) => {
    if (
      course.requirementGroup &&
      REQUIREMENT_GROUPS[course.requirementGroup]
    ) {
      // Only count if not withdrawn and has credits
      if (course.grade !== "WD" && Number.parseFloat(course.credits) > 0) {
        REQUIREMENT_GROUPS[course.requirementGroup].completed +=
          Number.parseFloat(course.credits);
      }
    }
  });

  // Create cards for each requirement group
  Object.keys(REQUIREMENT_GROUPS).forEach((key) => {
    const group = REQUIREMENT_GROUPS[key];
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
  if (!remainingCoursesList || !requirements[selectedMajor]) {
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
    if (requirements[selectedMajor][year]) {
      requirements[selectedMajor][year].forEach((course) => {
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
        if (requirements[selectedMajor][year]?.includes(course)) {
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
  if (!requirementsContent || !requirements[selectedMajor]) {
    console.error(
      "Requirements content container or major requirements not found"
    );
    return;
  }

  requirementsContent.innerHTML = "";

  // Create sections for each year
  const years = ["Freshman", "Sophomore", "Junior", "Senior"];

  years.forEach((year) => {
    if (requirements[selectedMajor][year]) {
      const yearSection = document.createElement("div");
      yearSection.className = "requirements-year";

      yearSection.innerHTML = `
        <h4>${year} Year</h4>
        <ul class="requirements-list">
          ${requirements[selectedMajor][year]
            .map((course) => {
              // Check if course is completed
              const courseData = studentCourses.find(
                (c) => c.course === course
              );
              const isCompleted = courseData && courseData.grade !== "WD";
              const isInProgress = courseData && courseData.grade === "IP";

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
 * Applies filters to the progress views
 */
function applyProgressFilters() {
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
function toggleProgressView() {
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

// Add new function to toggle progress dashboard
function toggleProgressDashboard() {
  isProgressDashboardVisible = !isProgressDashboardVisible;
  if (isProgressDashboardVisible) {
    // Initialize AI progress tracking
    initializeAIProgressTracking();
  }
  renderProgressDashboard();
}

// Add new function to initialize AI progress tracking
async function initializeAIProgressTracking() {
  try {
    const studentData = {
      gpa: calculateGPA(studentCourses),
      completedCourses: studentCourses,
      historicalPerformance: studentCourses.map((course) => ({
        course: course.code,
        grade: course.grade,
        semester: course.semester,
      })),
    };

    const requirementsData = {
      totalCreditsRequired: requirements.totalCredits,
      courseAvailability: await fetchCourseAvailability(),
      upcomingCourses: calculateUpcomingCourses(),
    };

    aiProgressData = {
      studentData,
      requirements: requirementsData,
    };
  } catch (error) {
    console.error("Error initializing AI progress tracking:", error);
    showNotification("Failed to initialize AI progress tracking", "error");
  }
}

// Add new function to render progress dashboard
function renderProgressDashboard() {
  const dashboardContainer = document.getElementById(
    "progress-dashboard-container"
  );
  if (!dashboardContainer) return;

  if (isProgressDashboardVisible && aiProgressData) {
    const root = ReactDOM.createRoot(dashboardContainer);
    root.render(
      <ProgressDashboard
        studentData={aiProgressData.studentData}
        requirements={aiProgressData.requirements}
      />
    );
  } else {
    dashboardContainer.innerHTML = "";
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing application...");

  // Check if we have saved major/year from previous session
  const savedMajor = localStorage.getItem("selectedMajor");
  const savedYear = localStorage.getItem("selectedYear");

  if (savedMajor && savedYear) {
    // Pre-select in the dropdown
    majorSelect.value = savedMajor;
    yearSelect.value = savedYear;
    confirmSelectionBtn.disabled = false;
  }

  // Fetch requirements first to populate majors dropdown
  fetchRequirements()
    .then(() => {
      initializeScheduler();
    })
    .catch((error) => {
      console.error("Failed to initialize app:", error);
      showNotification(
        "Failed to load majors. Please refresh the page.",
        "error"
      );
    });
});

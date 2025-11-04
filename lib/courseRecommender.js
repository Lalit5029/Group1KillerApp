import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { predictStudentPerformance } from './performancePredictor.js';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load all course and professor data
const courseDataPath = path.resolve(__dirname, '..', 'public', 'data', 'courses.json');
const reviewsDataPath = path.resolve(__dirname, '..', 'public', 'data', 'reviews.csv');
const ecsRequirementsPath = path.resolve(__dirname, '..', 'backend', 'data', 'ecs_requirements_cleaned.json');

/**
 * Loads course data from JSON file
 * @returns {Array} Array of course objects
 */
function loadCourseData() {
  try {
    const courseData = JSON.parse(fs.readFileSync(courseDataPath, 'utf8'));
    return courseData;
  } catch (error) {
    console.error('Error loading course data:', error);
    return [];
  }
}

/**
 * Parses CSV data into an array of objects
 * @param {string} csvData - Raw CSV data
 * @returns {Array} Array of objects with header keys and row values
 */
function parseCSV(csvData) {
  const lines = csvData.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  
  return lines.slice(1).filter(line => line.trim() !== '').map(line => {
    // Handle commas within quotes properly
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && (i === 0 || line[i-1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (line[i] === ',' && !inQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += line[i];
      }
    }
    values.push(currentValue); // Add the last value
    
    // Create object with header keys
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
    });
    
    return obj;
  });
}

/**
 * Loads professor review data
 * @returns {Array} Array of professor review objects
 */
function loadProfessorReviews() {
  try {
    const csvData = fs.readFileSync(reviewsDataPath, 'utf8');
    return parseCSV(csvData);
  } catch (error) {
    console.error('Error loading professor reviews:', error);
    return [];
  }
}

/**
 * Converts a course object to a format suitable for prediction
 * @param {Object} course - Course data from courses.json
 * @param {Array} allCourses - All available courses
 * @returns {Object} Course object formatted for prediction
 */
function formatCourseForPrediction(course, allCourses) {
  // Extract department from course code (e.g., "CIS 151" -> "CIS")
  const department = course.Class.split(' ')[0];
  
  // Estimate course difficulty based on course level
  // Extract the course number and use it to estimate difficulty
  const courseNumber = parseInt(course.Class.split(' ')[1]);
  const difficulty = Math.min(0.9, Math.max(0.3, courseNumber / 500)); // Scale to 0.3-0.9 range
  
  // Determine prerequisites based on course number (simplified approach)
  const prerequisites = allCourses
    .filter(c => {
      const cDept = c.Class.split(' ')[0];
      const cNum = parseInt(c.Class.split(' ')[1]);
      return cDept === department && cNum < courseNumber && cNum >= courseNumber - 100;
    })
    .map(c => c.Class);
  
  // Estimate credits based on typical patterns (simplified approach)
  const credits = courseNumber >= 400 ? 4 : 3;
  
  return {
    code: course.Class,
    name: `${course.Class} with ${course.Instructor}`,
    department: department,
    credits: credits,
    difficulty: difficulty,
    prerequisites: prerequisites,
    instructor: course.Instructor,
    daysTimes: course.DaysTimes,
    room: course.Room,
    section: course.Section
  };
}

/**
 * Get professor rating info from reviews data
 * @param {string} professorName - Name of the professor
 * @param {Array} professorReviews - Array of professor review objects
 * @returns {Object} Professor rating information
 */
function getProfessorRating(professorName, professorReviews) {
  const review = professorReviews.find(r => 
    professorName.includes(r.Instructor) || r.Instructor.includes(professorName)
  );
  
  if (review) {
    return {
      rating: parseFloat(review.RMP_Rating) || 3.0,
      reviews: [review.RMP_Review1, review.RMP_Review2, review.RMP_Review3].filter(r => r)
    };
  }
  
  return {
    rating: 3.0, // Default rating if not found
    reviews: []
  };
}

/**
 * Get difficulty level description based on numeric value
 * @param {number} difficulty - Numeric difficulty value (0-1)
 * @returns {string} Difficulty description
 */
function getDifficultyLevel(difficulty) {
  if (difficulty <= 0.4) return "Easy";
  if (difficulty <= 0.7) return "Moderate";
  return "Challenging";
}

/**
 * Checks if a course fulfills any major requirement
 * @param {Object} course - Course to check
 * @param {string} major - Student's major
 * @param {Object} requirementsByMajor - Requirements data by major
 * @returns {Object} Object containing if course is required and details
 */
function checkMajorRequirement(course, major, requirementsByMajor) {
  if (!requirementsByMajor || !major || !requirementsByMajor[major]) {
    return { isRequired: false, category: null, importance: 0 };
  }
  
  const majorReqs = requirementsByMajor[major];
  const categories = majorReqs.categories || {};
  
  for (const [categoryName, coursesInCategory] of Object.entries(categories)) {
    const matchingCourse = coursesInCategory.find(c => c.code === course.code);
    if (matchingCourse) {
      // Calculate importance - core requirements are more important
      let importance = 0.5; // Base importance
      
      // Core courses are more important
      if (categoryName.toLowerCase().includes('core') || 
          categoryName.toLowerCase().includes('required') ||
          categoryName.toLowerCase().includes('foundation')) {
        importance = 0.8;
      } 
      // Electives are less important but still valuable
      else if (categoryName.toLowerCase().includes('elective')) {
        importance = 0.4;
      }
      
      return { 
        isRequired: true, 
        category: categoryName,
        importance: importance
      };
    }
  }
  
  return { isRequired: false, category: null, importance: 0 };
}

/**
 * Get match reason based on student data and course
 * @param {Object} studentData - Student academic data
 * @param {Object} course - Course object
 * @param {number} predictedGPA - Predicted GPA for this course
 * @param {Object} requirementInfo - Information about major requirements
 * @returns {string} Reason for recommending this course
 */
function getMatchReason(studentData, course, predictedGPA, requirementInfo = null) {
  // Check if this is a required course for the major
  if (requirementInfo && requirementInfo.isRequired) {
    return `Required ${requirementInfo.category} course for your major`;
  }
  
  // Original logic for match reasons
  // Check if student has completed prerequisites
  const hasPrereqs = course.prerequisites.every(prereq => 
    studentData.completedCourses.some(c => c.code === prereq)
  );
  
  // Check if student has done well in this department before
  const departmentPerformance = studentData.historicalPerformance
    .filter(c => c.department === course.department)
    .map(c => {
      const gradeMap = {
        'A+': 4.0, 'A': 4.0, 'A-': 3.7,
        'B+': 3.3, 'B': 3.0, 'B-': 2.7,
        'C+': 2.3, 'C': 2.0, 'C-': 1.7,
        'D+': 1.3, 'D': 1.0, 'D-': 0.7,
        'F': 0.0
      };
      return gradeMap[c.grade] || 0;
    });
  
  const avgDeptPerformance = departmentPerformance.length > 0 
    ? departmentPerformance.reduce((sum, grade) => sum + grade, 0) / departmentPerformance.length 
    : 0;
  
  if (predictedGPA >= 3.7) {
    return "Strong match based on your academic profile and past performance";
  } else if (hasPrereqs && predictedGPA >= 3.0) {
    return "Good match with your completed prerequisites and expected performance";
  } else if (avgDeptPerformance >= 3.0) {
    return `Good fit based on your strong performance in ${course.department} courses`;
  } else if (course.prerequisites.length === 0) {
    return "Introductory course that fits your academic progression";
  } else {
    return "Aligns with your degree requirements and academic path";
  }
}

/**
 * Generate sections for a course
 * @param {Object} course - Course object
 * @param {Object} professorInfo - Professor rating information
 * @returns {Array} Array of course section objects
 */
function generateSections(course, professorInfo) {
  // Create a main section based on the course data
  const mainSection = {
    section: course.section,
    days: course.daysTimes.split(' ')[0].replace(/([A-Z][a-z])/, '$1,'),
    time: course.daysTimes.split(' ').slice(1).join(' '),
    location: course.room,
    professor: course.instructor,
    professor_rating: professorInfo.rating,
    seats_available: Math.floor(Math.random() * 20) + 5 // Random number of seats between 5-25
  };
  
  return [mainSection];
}

/**
 * Recommends courses based on student data and major
 * @param {Object} studentData - Student academic data
 * @param {number} count - Number of courses to recommend
 * @param {string} major - Student's major (optional)
 * @returns {Promise<Array>} Array of recommended courses
 */
export async function recommendCourses(studentData, count = 5, major = "Computer Science") {
  try {
    // Load course data
    const allCourses = loadCourseData();
    const professorReviews = loadProfessorReviews();
    
    // Load major requirements if available
    let requirementsByMajor = {};
    try {
      // If we're running on the server, read from the file
      if (typeof window === 'undefined') {
        const requirements = JSON.parse(fs.readFileSync(ecsRequirementsPath, 'utf8'));
        // Create a map of requirements by major
        requirementsByMajor = requirements.reduce((acc, req) => {
          if (req.program) acc[req.program] = req;
          return acc;
        }, {});
      } 
      // If we're in the browser, try to fetch from the API
      else {
        const reqResponse = await fetch('/api/requirements');
        if (reqResponse.ok) {
          requirementsByMajor = await reqResponse.json();
        } else {
          throw new Error(`Failed to fetch requirements: ${reqResponse.status}`);
        }
      }
      console.log(`Loaded requirements for ${Object.keys(requirementsByMajor).length} majors`);
    } catch (error) {
      console.warn('Could not load major requirements:', error.message);
    }
    
    // Filter out courses the student has already taken
    const completedCourseCodes = studentData.completedCourses.map(c => c.code);
    const inProgressCourseCodes = studentData.currentCourses?.map(c => c.code) || [];
    
    const eligibleCourses = allCourses.filter(course => {
      const courseCode = course.Class;
      return !completedCourseCodes.includes(courseCode) && !inProgressCourseCodes.includes(courseCode);
    });
    
    // Format courses for prediction
    const coursesForPrediction = eligibleCourses.map(course => 
      formatCourseForPrediction(course, allCourses)
    );
    
    // Get major requirements for the student's major
    let majorReqsForPrediction = null;
    if (requirementsByMajor && requirementsByMajor[major]) {
      majorReqsForPrediction = requirementsByMajor[major];
    }
    
    // Use performancePredictor to predict student performance in these courses
    const predictions = await predictStudentPerformance(studentData, coursesForPrediction, majorReqsForPrediction);
    
    // Combine predictions with course data and check major requirements
    const coursesWithPredictions = predictions.map((prediction, index) => {
      const course = coursesForPrediction[index];
      const professorInfo = getProfessorRating(course.instructor, professorReviews);
      const requirementInfo = checkMajorRequirement(course, major, requirementsByMajor);
      
      return {
        code: course.code,
        name: course.name,
        credits: course.credits,
        term: "Fall 2024", // Assuming next term
        prerequisite_codes: course.prerequisites,
        professor: course.instructor,
        professor_rating: professorInfo.rating,
        course_difficulty: getDifficultyLevel(course.difficulty),
        average_grade: prediction.predictedGrade,
        match_reason: getMatchReason(studentData, course, prediction.predictedGPA, requirementInfo),
        highly_recommended: prediction.predictedGPA >= 3.5 || requirementInfo.isRequired,
        difficulty_warning: course.difficulty > 0.7 && prediction.predictedGPA < 3.0,
        sections: generateSections(course, professorInfo),
        student_feedback: professorInfo.reviews.slice(0, 2),
        predictedGPA: prediction.predictedGPA,
        confidence: prediction.confidence,
        fulfills_requirement: requirementInfo.isRequired,
        requirement_category: requirementInfo.category
      };
    });
    
    // Sort by a combined score of predicted GPA and requirement importance
    return coursesWithPredictions
      .sort((a, b) => {
        // Base score from predicted GPA (0-4 scale)
        const aGpaScore = parseFloat(a.predictedGPA);
        const bGpaScore = parseFloat(b.predictedGPA);
        
        // Requirement bonus (0-1 scale)
        const aReqBonus = a.fulfills_requirement ? checkMajorRequirement({code: a.code}, major, requirementsByMajor).importance : 0;
        const bReqBonus = b.fulfills_requirement ? checkMajorRequirement({code: b.code}, major, requirementsByMajor).importance : 0;
        
        // Calculate total score (weighted)
        const aScore = (aGpaScore * 0.7) + (aReqBonus * 4 * 0.3); // Scale requirement bonus to similar range as GPA
        const bScore = (bGpaScore * 0.7) + (bReqBonus * 4 * 0.3);
        
        return bScore - aScore; // Sort descending
      })
      .slice(0, count);
  } catch (error) {
    console.error('Error recommending courses:', error);
    return [];
  }
}

export default {
  recommendCourses
}; 
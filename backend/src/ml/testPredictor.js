import { predictStudentPerformance, getRecommendation } from '../lib/performancePredictor.js';

// Test student data
const testStudent = {
  id: "TEST001",
  gpa: 3.5,
  completedCourses: [
    { code: "CS101", grade: "A-", department: "CS", credits: 3 },
    { code: "MATH101", grade: "B+", department: "MATH", credits: 4 },
    { code: "PHYS101", grade: "B", department: "PHYS", credits: 4 }
  ],
  currentWorkload: 14,
  historicalPerformance: [
    { code: "CS101", grade: "A-", department: "CS" },
    { code: "MATH101", grade: "B+", department: "MATH" },
    { code: "PHYS101", grade: "B", department: "PHYS" }
  ]
};

// Test courses to predict
const testCourses = [
  {
    code: "CS102",
    department: "CS",
    credits: 3,
    difficulty: 0.6,
    prerequisites: ["CS101"]
  },
  {
    code: "CS201",
    department: "CS",
    credits: 4,
    difficulty: 0.8,
    prerequisites: ["CS101", "MATH101"]
  },
  {
    code: "MATH201",
    department: "MATH",
    credits: 4,
    difficulty: 0.7,
    prerequisites: ["MATH101"]
  },
  {
    code: "PHYS201",
    department: "PHYS",
    credits: 4,
    difficulty: 0.75,
    prerequisites: ["PHYS101", "MATH101"]
  }
];

async function runTest() {
  console.log("Starting performance prediction test...");
  console.log("Student GPA:", testStudent.gpa);
  console.log("Current workload:", testStudent.currentWorkload, "credits");
  console.log("Completed courses:", testStudent.completedCourses.map(c => c.code).join(", "));
  
  try {
    console.log("\nPredicting performance for courses...");
    const predictions = await predictStudentPerformance(testStudent, testCourses);
    
    console.log("\nResults:");
    console.log("--------------------------------------------------");
    console.log("Course | Predicted GPA | Grade | Confidence | Recommendation");
    console.log("--------------------------------------------------");
    
    predictions.forEach(prediction => {
      const recommendation = getRecommendation(parseFloat(prediction.predictedGPA));
      console.log(
        `${prediction.courseCode.padEnd(6)} | ` +
        `${prediction.predictedGPA.padEnd(13)} | ` +
        `${prediction.predictedGrade.padEnd(5)} | ` +
        `${prediction.confidence.padEnd(10)} | ` +
        `${recommendation}`
      );
    });
    
    console.log("--------------------------------------------------");
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error during test:", error);
  }
}

runTest(); 
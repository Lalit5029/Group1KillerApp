import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the model architecture paths relative to the script's location (backend folder)
const modelJsonPath = path.join(__dirname, 'ml_models', 'performance_model.json');
const modelWeightsPath = path.join(__dirname, 'ml_models', 'performance_model_weights.json');

// Function to convert grade to number
function gradeToNumber(grade) {
  const gradeMap = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  };
  return gradeMap[grade] || 0.0;
}

// Function to calculate prerequisite strength
function calculatePrerequisiteStrength(prerequisites, completedCourses) {
  if (!prerequisites || prerequisites.length === 0) return 1.0;
  
  const completedPrereqs = prerequisites.filter(prereq => 
    completedCourses.some(course => course.code === prereq)
  );
  
  return completedPrereqs.length / prerequisites.length;
}

// Function to calculate historical performance
function calculateHistoricalPerformance(historicalPerformance, department) {
  if (!historicalPerformance || historicalPerformance.length === 0) return 0.5;
  
  const departmentGrades = historicalPerformance
    .filter(course => course.department === department)
    .map(course => gradeToNumber(course.grade));
  
  if (departmentGrades.length === 0) return 0.5;
  
  return departmentGrades.reduce((a, b) => a + b, 0) / departmentGrades.length;
}

// Function to calculate workload factor
function calculateWorkloadFactor(credits, currentWorkload) {
  const maxWorkload = 18;
  return 1 - (currentWorkload + credits) / maxWorkload;
}

// Function to load the model and make predictions
async function predictStudentPerformance(studentData, courses) {
  try {
    // Load model architecture and create a new model
    console.log(`Loading model architecture from: ${modelJsonPath}`);
    const modelJsonString = fs.readFileSync(modelJsonPath, 'utf8');
    // Model JSON is NOT double-stringified when saved by the updated trainModels.js
    const modelJson = JSON.parse(modelJsonString); 
    const model = tf.sequential();
    
    // Manually recreate the model architecture
    for (const layer of modelJson.config.layers) {
      if (layer.class_name === 'Dense') {
        model.add(tf.layers.dense({
          units: layer.config.units,
          activation: layer.config.activation,
          inputShape: layer.config.batch_input_shape ? layer.config.batch_input_shape.slice(1) : undefined
        }));
      }
    }
    
    // Load model weights
    console.log(`Loading model weights from: ${modelWeightsPath}`);
    const weightData = JSON.parse(fs.readFileSync(modelWeightsPath, 'utf8'));
    const weights = weightData.map(w => tf.tensor(w));
    model.setWeights(weights);
    
    console.log('Model loaded successfully!');
    
    // Prepare features for prediction
    const features = courses.map(course => [
      studentData.gpa,
      course.difficulty || 0.5,
      calculatePrerequisiteStrength(course.prerequisites, studentData.completedCourses),
      calculateHistoricalPerformance(studentData.historicalPerformance, course.department),
      calculateWorkloadFactor(course.credits, studentData.currentWorkload)
    ]);
    
    // Make predictions
    const predictions = model.predict(tf.tensor2d(features));
    const predictedGrades = Array.from(predictions.dataSync());
    
    // Map courses to their predicted grades
    const results = courses.map((course, i) => {
      // Convert normalized prediction back to GPA scale (0-4)
      const predictedGPA = predictedGrades[i] * 4.0;
      
      // Convert GPA to letter grade
      let letterGrade = 'F';
      if (predictedGPA >= 3.7) letterGrade = 'A';
      else if (predictedGPA >= 3.3) letterGrade = 'B+';
      else if (predictedGPA >= 3.0) letterGrade = 'B';
      else if (predictedGPA >= 2.7) letterGrade = 'B-';
      else if (predictedGPA >= 2.3) letterGrade = 'C+';
      else if (predictedGPA >= 2.0) letterGrade = 'C';
      else if (predictedGPA >= 1.7) letterGrade = 'C-';
      else if (predictedGPA >= 1.3) letterGrade = 'D+';
      else if (predictedGPA >= 1.0) letterGrade = 'D';
      else if (predictedGPA >= 0.7) letterGrade = 'D-';
      
      return {
        courseCode: course.code,
        predictedGPA: predictedGPA.toFixed(2),
        predictedGrade: letterGrade
      };
    });
    
    return results;
  } catch (error) {
    console.error('Error predicting student performance:', error);
    return [];
  }
}

// Example usage
const sampleStudent = {
  id: "S004",
  gpa: 3.5,
  completedCourses: [
    { code: "CS101", grade: "A-", department: "CS", credits: 3 },
    { code: "MATH101", grade: "B+", department: "MATH", credits: 4 }
  ],
  currentWorkload: 10,
  historicalPerformance: [
    { code: "CS101", grade: "A-", department: "CS" },
    { code: "MATH101", grade: "B+", department: "MATH" }
  ]
};

const coursesToPredict = [
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
  }
];

// Run prediction
predictStudentPerformance(sampleStudent, coursesToPredict)
  .then(results => {
    console.log('Prediction Results:');
    results.forEach(result => {
      console.log(`Course: ${result.courseCode}, Predicted GPA: ${result.predictedGPA}, Predicted Grade: ${result.predictedGrade}`);
    });
  })
  .catch(error => {
    console.error('Failed to run prediction:', error);
  }); 
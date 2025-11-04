import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths relative to the script's location (backend folder)
const historicalDataPath = path.join(__dirname, 'app_data', 'historical_performance.json');
const modelSavePath = path.join(__dirname, 'ml_models');
const modelJsonPath = path.join(modelSavePath, 'performance_model.json');
const modelWeightsPath = path.join(modelSavePath, 'performance_model_weights.json');

// Load historical data
console.log(`Loading historical data from: ${historicalDataPath}`);
const historicalData = JSON.parse(fs.readFileSync(historicalDataPath, 'utf8'));

// Prepare training data
function prepareTrainingData(data) {
  const features = [];
  const labels = [];

  for (const student of data) {
    for (const course of student.courses) {
      features.push([
        student.gpa,
        course.difficulty || 0.5,
        calculatePrerequisiteStrength(course.prerequisites, student.completedCourses),
        calculateHistoricalPerformance(student.historicalPerformance, course.department),
        calculateWorkloadFactor(course.credits, student.currentWorkload)
      ]);

      // Convert grade to normalized value (0-1)
      const gradeValue = gradeToNumber(course.grade) / 4.0;
      labels.push(gradeValue);
    }
  }

  return {
    features: tf.tensor2d(features),
    labels: tf.tensor1d(labels)
  };
}

// Helper functions
function calculatePrerequisiteStrength(prerequisites, completedCourses) {
  if (!prerequisites || prerequisites.length === 0) return 1.0;
  
  const completedPrereqs = prerequisites.filter(prereq => 
    completedCourses.some(course => course.code === prereq)
  );
  
  return completedPrereqs.length / prerequisites.length;
}

function calculateHistoricalPerformance(historicalPerformance, department) {
  if (!historicalPerformance || historicalPerformance.length === 0) return 0.5;
  
  const departmentGrades = historicalPerformance
    .filter(course => course.department === department)
    .map(course => gradeToNumber(course.grade));
  
  if (departmentGrades.length === 0) return 0.5;
  
  return departmentGrades.reduce((a, b) => a + b, 0) / departmentGrades.length;
}

function calculateWorkloadFactor(credits, currentWorkload) {
  const maxWorkload = 18;
  return 1 - (currentWorkload + credits) / maxWorkload;
}

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

// Create and train the model
async function trainModel() {
  const { features, labels } = prepareTrainingData(historicalData);

  // Create the model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [5], units: 10, activation: 'relu' }),
      tf.layers.dense({ units: 5, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' })
    ]
  });

  // Compile the model
  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: ['accuracy']
  });

  // Train the model
  console.log("Starting model training...");
  const history = await model.fit(features, labels, {
    epochs: 100,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        // Log less frequently to avoid spamming console
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
            console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc?.toFixed(4) || 'N/A'}, val_loss = ${logs.val_loss?.toFixed(4) || 'N/A'}, val_accuracy = ${logs.val_acc?.toFixed(4) || 'N/A'}`);
        }
      }
    }
  });
  console.log("Model training finished.");

  // Ensure the target directory exists
  if (!fs.existsSync(modelSavePath)) {
    console.log(`Creating directory: ${modelSavePath}`);
    fs.mkdirSync(modelSavePath, { recursive: true });
  }

  // Save the model by serializing it
  console.log(`Saving model JSON to: ${modelJsonPath}`);
  const modelJson = model.toJSON();
  fs.writeFileSync(
    modelJsonPath,
    JSON.stringify(modelJson), // Keep it as a plain JSON object, not double-stringified
    'utf8'
  );

  // Save model weights
  console.log(`Saving model weights to: ${modelWeightsPath}`);
  const weightData = await model.getWeights();
  const weightDataArrays = weightData.map(w => w.arraySync());
  fs.writeFileSync(
    modelWeightsPath,
    JSON.stringify(weightDataArrays),
    'utf8'
  );

  console.log('Model training completed and model saved!');
}

// Run the training
trainModel().catch(console.error); 
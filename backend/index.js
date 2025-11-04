/**
 * Backend Index
 * Main entry point for the backend services testing
 */

import academicScraperApi from './src/api/academic_scraper_api.js';
import { predictStudentPerformance } from './src/ml/predictPerformance.js';
import { trainModel } from './src/ml/trainModels.js';

export {
  academicScraperApi,
  predictStudentPerformance,
  trainModel
};

export default {
  academicScraperApi,
  predictStudentPerformance,
  trainModel
}; 
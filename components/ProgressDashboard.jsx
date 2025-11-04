import React, { useState, useEffect } from 'react';
import AIProgressTracker from '../lib/aiProgressTracker';

const ProgressDashboard = ({ studentData, requirements }) => {
  const [progress, setProgress] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeTracker = async () => {
      const tracker = new AIProgressTracker();
      await tracker.initialize();

      // Calculate progress
      const progressData = await tracker.calculateGraduationTimeline(
        studentData,
        requirements.courseAvailability
      );
      setProgress(progressData);

      // Get predictions
      const predictionsData = await tracker.predictPerformance(
        studentData,
        requirements.upcomingCourses
      );
      setPredictions(predictionsData);

      // Get risks
      const risksData = tracker.identifyRisks(progressData);
      setRisks(risksData);

      setLoading(false);
    };

    initializeTracker();
  }, [studentData, requirements]);

  if (loading) {
    return <div className="loading">Loading progress data...</div>;
  }

  return (
    <div className="progress-dashboard">
      <div className="dashboard-section">
        <h2>Progress Overview</h2>
        <div className="progress-metrics">
          <div className="metric">
            <h3>Credits Completed</h3>
            <p>{progress.completedCredits} / {requirements.totalCreditsRequired}</p>
          </div>
          <div className="metric">
            <h3>Projected Graduation</h3>
            <p>{new Date(progress.projectedGraduation).toLocaleDateString()}</p>
          </div>
          <div className="metric">
            <h3>Current GPA</h3>
            <p>{studentData.gpa.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Course Predictions</h2>
        <div className="predictions-grid">
          {Object.entries(predictions).map(([course, data]) => (
            <div key={course} className={`prediction-card risk-${data.riskLevel.toLowerCase()}`}>
              <h3>{course}</h3>
              <p>Predicted Grade: {data.predictedGrade}</p>
              <p>Confidence: {(data.confidence * 100).toFixed(1)}%</p>
              <p className="risk-level">Risk Level: {data.riskLevel}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Risk Factors</h2>
        <div className="risks-list">
          {risks.map((risk, index) => (
            <div key={index} className={`risk-item severity-${risk.severity.toLowerCase()}`}>
              <h3>{risk.type}</h3>
              <p>{risk.description}</p>
              <span className="severity-badge">{risk.severity}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Recommended Course Sequence</h2>
        <div className="course-sequence">
          {progress.semesterPlans.map((semester, index) => (
            <div key={index} className="semester-plan">
              <h3>{semester.term}</h3>
              <ul>
                {semester.courses.map((course, courseIndex) => (
                  <li key={courseIndex}>
                    {course.code} - {course.name}
                    <span className={`priority-badge priority-${course.priority.toLowerCase()}`}>
                      {course.priority}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressDashboard; 
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { recommendCourses } from '@/lib/courseRecommender';

export async function GET(request) {
  try {
    // Get the URL and parse query parameters
    const url = new URL(request.url);
    
    // Get major from the query parameters if provided
    const requestedMajor = url.searchParams.get('major');
    
    // Read the sample data file
    const sampleDataPath = path.join(process.cwd(), 'backend', 'data', 'sample_student_courses.json');
    
    if (!fs.existsSync(sampleDataPath)) {
      console.error('Sample data file not found at', sampleDataPath);
      return NextResponse.json(
        { error: 'Sample data file not found' },
        { status: 404 }
      );
    }
    
    // Read and parse the file
    const sampleData = fs.readFileSync(sampleDataPath, 'utf8');
    let studentData;
    
    try {
      studentData = JSON.parse(sampleData);
    } catch (error) {
      console.error('Error parsing sample data file:', error);
      return NextResponse.json(
        { error: 'Failed to parse sample data file' },
        { status: 500 }
      );
    }
    
    // Extract student info and course history from the data
    const studentInfo = studentData.student || {};
    const coursesData = studentData.courses || [];
    
    // Format the student data for the course recommender
    const formattedStudentData = {
      gpa: studentInfo.gpa || 3.5,
      completedCourses: coursesData.filter(c => c.grade && c.grade !== 'IP').map(c => ({ code: c.code, grade: c.grade })),
      historicalPerformance: coursesData.filter(c => c.grade && c.grade !== 'IP').map(c => ({ 
        department: c.code ? c.code.split(' ')[0] : '',
        grade: c.grade
      })),
      currentWorkload: coursesData.filter(c => c.grade === 'IP').length
    };
    
    // Get the student's major from query param or student info
    const studentMajor = requestedMajor || (studentInfo && studentInfo.major) || "Computer Science";
    
    // Use the course recommender with the student's major
    try {
      const recommendedCourses = await recommendCourses(formattedStudentData, 5, studentMajor);
      
      // Return the compiled data
      return NextResponse.json({
        courses: coursesData,
        student: {
          name: studentInfo.name || "Alex Johnson",
          id: studentInfo.id || "900123456",
          major: studentMajor,
          graduation_year: studentInfo.graduation_year || 2026,
          academic_year: studentInfo.academic_year || "Junior",
          advisor: studentInfo.advisor || "Dr. Sarah Chen",
          college: studentInfo.college || "College of Engineering and Computer Science"
        },
        recommendedCourses: recommendedCourses,
        futureRequirements: studentData.future_requirements || [],
        major: studentMajor
      });
    } catch (recommendError) {
      console.error('Error generating recommendations:', recommendError);
      
      // Return the data without recommendations
      return NextResponse.json({
        courses: coursesData,
        student: {
          name: studentInfo.name || "Alex Johnson",
          id: studentInfo.id || "900123456",
          major: studentMajor,
          graduation_year: studentInfo.graduation_year || 2026,
          academic_year: studentInfo.academic_year || "Junior",
          advisor: studentInfo.advisor || "Dr. Sarah Chen",
          college: studentInfo.college || "College of Engineering and Computer Science"
        },
        recommendedCourses: studentData.fallback_recommendations || [],
        futureRequirements: studentData.future_requirements || [],
        major: studentMajor
      });
    }
  } catch (error) {
    console.error('Error in sample-courses API route:', error);
    
    // In case of any error, try to return the original sample data file
    try {
      const sampleDataPath = path.join(process.cwd(), 'backend', 'data', 'sample_student_courses.json');
      const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
      return NextResponse.json(sampleData);
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to process request: ' + error.message },
        { status: 500 }
      );
    }
  }
} 
const fs = require('fs');
const path = require('path');

async function generateCoursesData() {
  try {
    // In a real application, this would fetch from a database or API
    const courses = await fetchCoursesFromSource();
    
    // Clean up the data
    const cleanedCourses = courses.map(course => ({
      ...course,
      Section: course.Section.replace(/\n/g, ' '), // Remove newlines
      DaysTimes: course.DaysTimes || 'TBA',
      MeetingDates: course.MeetingDates || 'TBA'
    }));

    // Write to file
    fs.writeFileSync(
      path.join(__dirname, '../public/courses.json'),
      JSON.stringify(cleanedCourses, null, 2)
    );
    console.log('Successfully generated courses.json');
  } catch (error) {
    console.error('Error generating courses data:', error);
  }
}

async function generateParsedCoursesData() {
  try {
    // In a real application, this would fetch from a database or API
    const parsedCourses = await fetchParsedCoursesFromSource();
    
    // Write to file
    fs.writeFileSync(
      path.join(__dirname, '../public/parsed_courses.json'),
      JSON.stringify(parsedCourses, null, 2)
    );
    console.log('Successfully generated parsed_courses.json');
  } catch (error) {
    console.error('Error generating parsed courses data:', error);
  }
}

// Placeholder functions - replace with actual data fetching logic
async function fetchCoursesFromSource() {
  // TODO: Implement actual data fetching
  return [];
}

async function fetchParsedCoursesFromSource() {
  // TODO: Implement actual data fetching
  return [];
}

// Run the generators
generateCoursesData();
generateParsedCoursesData(); 
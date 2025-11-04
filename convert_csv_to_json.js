const fs = require('fs');
const csv = require('csv-parser');

const results = [];
let idCounter = 1;

fs.createReadStream('public/courses.csv')
  .pipe(csv())
  .on('data', (data) => {
    // Add an ID to each course
    const course = {
      id: `course-${idCounter++}`,
      Class: data.Class || '',
      Section: data.Section || '',
      DaysTimes: data.DaysTimes || '',
      Room: data.Room || '',
      Instructor: data.Instructor || '',
      MeetingDates: data.MeetingDates || ''
    };
    results.push(course);
  })
  .on('end', () => {
    // Write the results to courses.json
    fs.writeFileSync('courses.json', JSON.stringify(results, null, 2));
    console.log(`Successfully converted ${results.length} courses to JSON format`);
  }); 
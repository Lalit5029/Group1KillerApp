import type { Course, SelectedCourse } from "./types"

/**
 * Determines if a course has a time conflict with any of the selected courses
 */
export function hasConflict(course: Course, selectedCourses: SelectedCourse[]): boolean {
  // Check for duplicate course code and section first
  const isDuplicate = selectedCourses.some(
    (sc) => sc.Class === course.Class && sc.Section === course.Section
  );
  
  if (isDuplicate) {
    console.log(`Course ${course.Class} ${course.Section} is already added to schedule`);
    return true;
  }

  // If the course doesn't have a DaysTimes field or it's empty, we can't detect time conflicts
  // But we'll still allow the course to be added
  if (!course.DaysTimes || course.DaysTimes.trim() === "") {
    console.log(`Course ${course.Class} ${course.Section} has no days/times info - no conflict`);
    return false;
  }

  // Parse time info from the new course
  const newCourseInfo = parseDaysTimes(course.DaysTimes);
  if (!newCourseInfo) {
    console.log(`Could not parse days/times for ${course.Class} ${course.Section}: "${course.DaysTimes}"`);
    return false; // If we can't parse, assume no conflict
  }

  // Check each selected course for conflicts
  for (const selectedCourse of selectedCourses) {
    // If the selected course doesn't have days/times, it can't conflict
    if (!selectedCourse.DaysTimes || selectedCourse.DaysTimes.trim() === "") {
      continue;
    }

    const existingCourseInfo = parseDaysTimes(selectedCourse.DaysTimes);
    if (!existingCourseInfo) continue; // If we can't parse, assume no conflict

    // Check for day overlap
    const dayOverlap = existingCourseInfo.days.some((day) => 
      newCourseInfo.days.includes(day)
    );
    
    if (!dayOverlap) continue; // No day overlap means no conflict

    // Check for time overlap
    const timeOverlap = (
      (newCourseInfo.startMinutes <= existingCourseInfo.endMinutes) &&
      (newCourseInfo.endMinutes >= existingCourseInfo.startMinutes)
    );
    
    if (timeOverlap) {
      console.log(`Time conflict detected: ${course.Class} conflicts with ${selectedCourse.Class}`);
      return true;
    }
  }

  return false;
}

/**
 * Parses the days and times string into an object with days and start/end times
 * Format example: "MoWe 10:00AM - 11:20AM" or "TuTh 2:30PM - 3:50PM"
 */
export function parseDaysTimes(daysTimes: string): { days: string[], startMinutes: number, endMinutes: number } | null {
  if (!daysTimes || daysTimes.trim() === "") {
    return null;
  }

  try {
    // Handle different day formats
    const dayMap: Record<string, string> = {
      'mo': 'Mo', 'tu': 'Tu', 'we': 'We', 'th': 'Th', 'fr': 'Fr',
      'monday': 'Mo', 'tuesday': 'Tu', 'wednesday': 'We', 'thursday': 'Th', 'friday': 'Fr',
      'm': 'Mo', 't': 'Tu', 'w': 'We', 'r': 'Th', 'f': 'Fr'
    };
    
    // Extract days and times using a more flexible pattern
    const dayPattern = /([a-zA-Z]{1,9})/;  // Matches day codes of different lengths
    const timePattern = /(\d{1,2}:\d{2}[AP]M)\s*-\s*(\d{1,2}:\d{2}[AP]M)/i;  // Matches time range format
    
    const dayMatch = daysTimes.match(dayPattern);
    const timeMatch = daysTimes.match(timePattern);
    
    if (!dayMatch || !timeMatch) {
      console.warn(`Could not parse days/times: "${daysTimes}"`);
      return null;
    }
    
    const daysString = dayMatch[0].toLowerCase();
    const startTimeStr = timeMatch[1];
    const endTimeStr = timeMatch[2];
    
    // Parse days more flexibly
    const days: string[] = [];
    
    // Try to extract standard 2-letter day codes (Mo, Tu, etc.)
    if (daysString.includes('mo') || daysString.includes('m')) days.push('Mo');
    if (daysString.includes('tu') || daysString.includes('t')) days.push('Tu');
    if (daysString.includes('we') || daysString.includes('w')) days.push('We');
    if (daysString.includes('th') || daysString.includes('r')) days.push('Th');
    if (daysString.includes('fr') || daysString.includes('f')) days.push('Fr');
    
    // If we couldn't identify any days, try an alternative approach
    if (days.length === 0) {
      // Try to parse days in pairs (Mo, Tu, We, Th, Fr)
      for (let i = 0; i < daysString.length; i += 2) {
        if (i + 1 < daysString.length) {
          const day = daysString.substring(i, i + 2);
          if (dayMap[day]) {
            days.push(dayMap[day]);
          }
        }
      }
      
      // If still no days found, try single letter codes
      if (days.length === 0) {
        for (let i = 0; i < daysString.length; i++) {
          const day = daysString[i];
          if (dayMap[day]) {
            days.push(dayMap[day]);
          }
        }
      }
    }
    
    if (days.length === 0) {
      console.warn(`Could not identify any days in: "${daysString}"`);
      return null;
    }

    const startTime = parseTimeToMinutes(startTimeStr);
    const endTime = parseTimeToMinutes(endTimeStr);
    
    if (startTime === null || endTime === null) {
      console.warn(`Invalid time format in: "${daysTimes}"`);
      return null;
    }

    return {
      days,
      startMinutes: startTime,
      endMinutes: endTime,
    };
  } catch (error) {
    console.warn(`Error parsing days/times: ${daysTimes}`, error);
    return null;
  }
}

/**
 * Converts a time string (e.g., "10:30AM") to minutes since midnight
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  try {
    // Format: "10:30AM" or "2:45PM"
    const match = timeStr.match(/(\d{1,2}):(\d{2})([AP]M)/i);
    if (!match) return null;
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const isPM = match[3].toUpperCase() === "PM" && hours !== 12;
    const isAM12 = match[3].toUpperCase() === "AM" && hours === 12;
    
    // Validate time values
    if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }
    
    // Convert to 24-hour format
    let hourIn24 = hours;
    if (isPM) hourIn24 += 12;
    if (isAM12) hourIn24 = 0; // 12 AM is 0 in 24-hour format
    
    return hourIn24 * 60 + minutes;
  } catch (error) {
    console.warn(`Error parsing time: ${timeStr}`, error);
    return null;
  }
}

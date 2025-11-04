import React, { useState, useEffect, useMemo } from 'react';
import CourseCard from '@/components/CourseCard';
import type { SelectedCourse } from '@/lib/types';
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided, DroppableStateSnapshot, DraggableStateSnapshot, DropResult } from '@hello-pangea/dnd';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download } from 'lucide-react';

interface CalendarViewProps {
  courses: SelectedCourse[];
  onShowDetails: (course: SelectedCourse) => void;
  onOpenNotes?: (courseId: string) => void;
  onRemoveCourse?: (courseId: string) => void;
  courseNotes: Record<string, string>;
  onCourseDrop?: (courseId: string, newDay: string, newTime: string) => void;
}

export function CalendarView({ 
  courses, 
  onShowDetails, 
  onOpenNotes = () => {}, 
  onRemoveCourse = () => {}, 
  courseNotes = {},
  onCourseDrop = () => {} 
}: CalendarViewProps) {
  const [selectedCourse, setSelectedCourse] = useState<SelectedCourse | null>(null);

  // Add a unique key to force re-render when courses change
  const [calendarKey, setCalendarKey] = useState(Date.now());
  
  // Force a re-render whenever courses change
  useEffect(() => {
    setCalendarKey(Date.now());
    console.log("Calendar refreshing with", courses.length, "courses");
  }, [courses]);

  function parseTimeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    
    const [hoursStr, minutesWithAmPm] = timeStr.split(':');
    if (!hoursStr || !minutesWithAmPm) return 0;
    
    let hours = parseInt(hoursStr, 10);
    const isPM = minutesWithAmPm.toLowerCase().includes('pm') && hours !== 12;
    const isAM = minutesWithAmPm.toLowerCase().includes('am') && hours === 12;
    
    if (isPM) hours += 12;
    if (isAM) hours = 0;
    
    const minutes = parseInt(minutesWithAmPm.substring(0, 2), 10);
    return hours * 60 + minutes;
  }

  // Format minutes back to time string
  const formatTime = (minutes: number): string => {
    const hours24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const hours12 = hours24 > 12 ? hours24 - 12 : hours24 === 0 ? 12 : hours24;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    return `${hours12}:${mins.toString().padStart(2, '0')}${ampm}`;
  };

  // Generate a unique list of all time slots based on DaysTimes
  const allTimeSlots = useMemo(() => {
    const timeSlots = new Set<string>();
    
    // Add standard time slots for working hours
    for (let hour = 8; hour <= 20; hour++) {
      const h = hour > 12 ? hour - 12 : hour;
      const amPm = hour >= 12 ? "PM" : "AM";
      timeSlots.add(`${h}:00${amPm}`);
    }
    
    // Add actual course time slots
    courses.forEach((course) => {
      if (course.DaysTimes) {
        const timeMatch = course.DaysTimes.match(/(\d{1,2}:\d{2}[AP]M)\s*-\s*(\d{1,2}:\d{2}[AP]M)/i);
        if (timeMatch) {
          timeSlots.add(timeMatch[1]);  // Start time
          timeSlots.add(timeMatch[2]);  // End time
        }
      }
    });
    
    // Convert to array and sort
    return Array.from(timeSlots)
      .sort((a, b) => {
        const timeA = parseTimeToMinutes(a) || 0;
        const timeB = parseTimeToMinutes(b) || 0;
        return timeA - timeB;
      });
  }, [courses]);

  // Extract unique days from courses
  const uniqueDays = useMemo(() => {
    // Define the ordered weekdays we want to display
    const orderedDays = ['Mo', 'Tu', 'We', 'Th', 'Fr'];
    
    // Always return all weekdays in the correct order
    return orderedDays;
  }, []);

  const getDayName = (day: string): string => {
    const dayNames = {
      'Mo': 'Monday',
      'Tu': 'Tuesday',
      'We': 'Wednesday',
      'Th': 'Thursday',
      'Fr': 'Friday'
    };
    return dayNames[day as keyof typeof dayNames] || day;
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const courseId = result.draggableId;
    const newDay = result.destination.droppableId;
    const timeSlot = allTimeSlots[Math.floor((result.destination.index / 100) * allTimeSlots.length)];
    
    onCourseDrop(courseId, newDay, timeSlot);
  };

  const exportCalendar = () => {
    // Create iCal format string
    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Course Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    // Add each course as an event
    courses.forEach(course => {
      if (!course.DaysTimes) return;

      const timeMatch = course.DaysTimes.match(/(\d{1,2}:\d{2}[AP]M)\s*-\s*(\d{1,2}:\d{2}[AP]M)/i);
      if (!timeMatch) return;

      const startTime = timeMatch[1];
      const endTime = timeMatch[2];
      const days = course.DaysTimes.match(/[MTWFS][ouehra]/g) || [];

      // Convert time to 24-hour format
      const parseTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':');
        const ampm = timeStr.slice(-2).toUpperCase();
        let hour = parseInt(hours);
        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}${minutes.slice(0, 2)}`;
      };

      const startTime24 = parseTime(startTime);
      const endTime24 = parseTime(endTime);

      // Create an event for each day
      days.forEach(day => {
        const dayMap: Record<string, number> = {
          'Mo': 1, 'Tu': 2, 'We': 3, 'Th': 4, 'Fr': 5
        };
        const dayNum = dayMap[day];
        if (!dayNum) return;

        // Create a date for the current semester (assuming Fall 2024)
        const startDate = new Date(2024, 8, 2); // September 2, 2024
        const eventDate = new Date(startDate);
        eventDate.setDate(startDate.getDate() + (dayNum - 1));

        const formatDate = (date: Date, time: string) => {
          return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}T${time}00`;
        };

        icalContent.push(
          'BEGIN:VEVENT',
          `DTSTART:${formatDate(eventDate, startTime24)}`,
          `DTEND:${formatDate(eventDate, endTime24)}`,
          `SUMMARY:${course.Class || 'Unknown Course'} - ${course.Section || 'Unknown Section'}`,
          `LOCATION:${course.Room || 'TBD'}`,
          `DESCRIPTION:Instructor: ${course.Instructor || 'TBD'}\\nNotes: ${courseNotes[course.id] || 'No notes'}`,
          'END:VEVENT'
        );
      });
    });

    icalContent.push('END:VCALENDAR');

    // Create and download the file
    const blob = new Blob([icalContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'course_schedule.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderCalendar = () => {
    return (
      <div className="w-full bg-background rounded-lg shadow-sm border border-border">
        <div className="grid grid-cols-[auto_1fr]">
          {/* Time column */}
          <div className="border-r border-border">
            {allTimeSlots.map((time) => (
              <div
                key={time}
                className="h-16 border-b border-border text-sm text-muted-foreground flex items-center justify-end pr-2"
              >
                {time}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-5">
              {uniqueDays.map((day) => (
                <Droppable key={day} droppableId={day}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="border-r border-border last:border-r-0"
                    >
                      <div className="h-8 border-b border-border bg-muted/50 text-sm font-medium flex items-center justify-center">
                        {getDayName(day)}
                      </div>
                      {allTimeSlots.map((timeSlot) => (
                        <div
                          key={`${day}-${timeSlot}`}
                          className="h-16 border-b border-border relative"
                        >
                          {courses
                            .filter(
                              (course) =>
                                course.DaysTimes &&
                                course.DaysTimes.split(' ')[0] === day &&
                                course.DaysTimes.match(/(\d{1,2}:\d{2}[AP]M)\s*-\s*(\d{1,2}:\d{2}[AP]M)/i)
                            )
                            .map((course, index) => (
                              <Draggable
                                key={course.id}
                                draggableId={course.id}
                                index={index}
                              >
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="absolute inset-0 m-1"
                                  >
                                    <CourseCard
                                      course={course}
                                      position={{ top: 0, height: 100 }}
                                      hasNotes={!!courseNotes[course.id]}
                                      onShowDetails={() => onShowDetails(course)}
                                      onOpenNotes={() => onOpenNotes(course.id)}
                                      onRemove={() => onRemoveCourse(course.id)}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                        </div>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        </div>
      </div>
    );
  };

  return renderCalendar();
} 
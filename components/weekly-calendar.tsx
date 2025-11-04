"use client"

import React, { useState, useEffect } from 'react';
import type { SelectedCourse } from "@/lib/types"
import { getDepartmentCode } from "@/lib/utils"
import { CalendarView } from './calendar-view';

interface WeeklyCalendarProps {
  selectedCourses: SelectedCourse[]
  onShowDetails: (course: SelectedCourse) => void
  onOpenNotes?: (courseId: string) => void
  onRemoveCourse?: (courseId: string) => void
  courseNotes: Record<string, string>
}

export function WeeklyCalendar({ 
  selectedCourses, 
  onShowDetails, 
  onOpenNotes = () => {}, 
  onRemoveCourse = () => {},
  courseNotes = {} 
}: WeeklyCalendarProps) {
  // Add a unique key to force re-render when courses change
  const [calendarKey, setCalendarKey] = useState<number>(Date.now());

  // Update the key whenever selectedCourses changes
  useEffect(() => {
    setCalendarKey(Date.now());
    console.log("Weekly calendar refreshing with", selectedCourses.length, "courses");
  }, [selectedCourses]);

  const CALENDAR_START_HOUR = 8 // 8 AM
  const HOUR_HEIGHT = 60 // 60px per hour
  const MINUTES_PER_HOUR = 60
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  const dayMap = { mo: "Monday", tu: "Tuesday", we: "Wednesday", th: "Thursday", fr: "Friday" }

  // Generate time markers (8 AM to 7 PM)
  const timeMarkers = Array.from({ length: 12 }, (_, i) => {
    const hour = i + CALENDAR_START_HOUR
    return hour <= 12 ? `${hour} AM` : `${hour - 12} PM`
  })

  return (
    <div className="weekly-calendar mt-6" key={`calendar-${calendarKey}`}>
      <CalendarView 
        courses={selectedCourses}
        onShowDetails={onShowDetails}
        onOpenNotes={onOpenNotes}
        onRemoveCourse={onRemoveCourse}
        courseNotes={courseNotes}
      />
      
      {selectedCourses.length === 0 && (
        <div className="text-center p-8 bg-gray-50 rounded-lg mt-4 border border-dashed border-gray-300">
          <p className="text-gray-500 mb-2">No courses have been added to your schedule yet.</p>
          <p className="text-sm text-gray-400">Use "Generate Schedule" or search for courses to add them.</p>
        </div>
      )}
    </div>
  );
}

// Helper function to get department styling class
function getDepartmentClass(className?: string): string {
  if (!className) return "border-gray-400 bg-gray-100"

  const deptCode = getDepartmentCode(className)

  const deptColors: Record<string, string> = {
    BEN: "border-blue-500 bg-blue-50",
    CSE: "border-green-500 bg-green-50",
    MAE: "border-red-500 bg-red-50",
    CEN: "border-yellow-500 bg-yellow-50",
    CEE: "border-purple-500 bg-purple-50",
    ELE: "border-teal-500 bg-teal-50",
    MAT: "border-orange-500 bg-orange-50",
    PHY: "border-indigo-500 bg-indigo-50",
    CHE: "border-emerald-500 bg-emerald-50",
    ECS: "border-cyan-500 bg-cyan-50",
    AEE: "border-rose-500 bg-rose-50",
    WRT: "border-gray-500 bg-gray-50",
  }

  return deptColors[deptCode] || "border-gray-400 bg-gray-100"
}

// Helper function to check if a particular day is in the course schedule
function isDayInSchedule(daysTimes?: string, dayCode: string = 'Mo'): boolean {
  if (!daysTimes) return false;
  
  const daysStr = daysTimes.split(' ')[0]?.toLowerCase() || '';
  
  // Check for day code matches using various formats
  switch (dayCode) {
    case 'Mo': return daysStr.includes('mo') || daysStr.includes('m');
    case 'Tu': return daysStr.includes('tu') || daysStr.includes('t');
    case 'We': return daysStr.includes('we') || daysStr.includes('w');
    case 'Th': return daysStr.includes('th') || daysStr.includes('r');
    case 'Fr': return daysStr.includes('fr') || daysStr.includes('f');
    default: return false;
  }
}

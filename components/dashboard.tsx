"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, RefreshCw, FileOutputIcon as FileExport } from "lucide-react"
import { ScheduleStats } from "./schedule-stats"
import { WeeklyCalendar } from "./weekly-calendar"
import { CourseListView } from "./course-list-view"
import type { SelectedCourse } from "@/lib/types"

interface DashboardProps {
  selectedCourses: SelectedCourse[]
  currentView: "calendar" | "list"
  onToggleView: () => void
  onShowDetails: (course: SelectedCourse) => void
  onOpenNotes: (courseId: string) => void
  onRemoveCourse: (courseId: string) => void
  courseNotes: Record<string, string>
}

export function Dashboard({
  selectedCourses,
  currentView,
  onToggleView,
  onShowDetails,
  onOpenNotes,
  onRemoveCourse,
  courseNotes,
}: DashboardProps) {
  const [departmentFilter, setDepartmentFilter] = useState("")
  const [timeFilter, setTimeFilter] = useState("")

  const exportSchedule = () => {
    window.print()
  }

  const filteredCourses = selectedCourses.filter((course) => {
    let passesFilter = true

    // Department filter
    if (departmentFilter) {
      const deptCode = getDepartmentCode(course.Class)
      if (deptCode !== departmentFilter) {
        passesFilter = false
      }
    }

    // Time filter
    if (timeFilter && passesFilter) {
      const timeMatch = course.DaysTimes?.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i)
      if (timeMatch) {
        let hour = Number.parseInt(timeMatch[1])
        const period = timeMatch[3].toUpperCase()

        // Convert to 24-hour
        if (period === "PM" && hour !== 12) hour += 12
        if (period === "AM" && hour === 12) hour = 0

        if (timeFilter === "morning" && (hour < 8 || hour >= 12)) {
          passesFilter = false
        } else if (timeFilter === "afternoon" && (hour < 12 || hour >= 17)) {
          passesFilter = false
        } else if (timeFilter === "evening" && hour < 17) {
          passesFilter = false
        }
      }
    }

    return passesFilter
  })

  return (
    <Card className="shadow-soft rounded-xl overflow-hidden hover-card-effect">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 bg-gradient-to-br from-primary-50 to-white border-b border-primary-100">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl text-primary-800">Weekly Schedule</CardTitle>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px] border-primary-200">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="BEN">BEN - Biomedical</SelectItem>
                <SelectItem value="CSE">CSE - Computer Science</SelectItem>
                <SelectItem value="MAE">MAE - Mechanical</SelectItem>
                <SelectItem value="CEN">CEN - Chemical</SelectItem>
                <SelectItem value="CEE">CEE - Civil</SelectItem>
                <SelectItem value="ELE">ELE - Electrical</SelectItem>
                <SelectItem value="MAT">MAT - Mathematics</SelectItem>
                <SelectItem value="PHY">PHY - Physics</SelectItem>
                <SelectItem value="CHE">CHE - Chemistry</SelectItem>
                <SelectItem value="ECS">ECS - Engineering</SelectItem>
              </SelectContent>
            </Select>

            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[180px] border-primary-200">
                <SelectValue placeholder="All Times" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Times</SelectItem>
                <SelectItem value="morning">Morning (8AM-12PM)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12PM-5PM)</SelectItem>
                <SelectItem value="evening">Evening (5PM+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportSchedule}
              className="flex items-center gap-1 border-primary-200 text-primary-700 hover:bg-primary-50"
            >
              <FileExport className="h-4 w-4" />
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onToggleView}
              className="flex items-center gap-1 border-primary-200 text-primary-700 hover:bg-primary-50"
            >
              <RefreshCw className="h-4 w-4" />
              Toggle View
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <ScheduleStats selectedCourses={selectedCourses} />

        {currentView === "calendar" ? (
          <WeeklyCalendar selectedCourses={filteredCourses} onShowDetails={onShowDetails} courseNotes={courseNotes} />
        ) : (
          <CourseListView
            selectedCourses={filteredCourses}
            onShowDetails={onShowDetails}
            onOpenNotes={onOpenNotes}
            onRemoveCourse={onRemoveCourse}
          />
        )}
      </CardContent>
    </Card>
  )
}

// Helper function to get department code
function getDepartmentCode(className?: string): string {
  if (!className) return ""
  const match = className.match(/^([A-Z]+)/)
  return match ? match[1] : ""
}

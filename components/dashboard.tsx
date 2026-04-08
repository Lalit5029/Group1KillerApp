"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, RefreshCw, FileOutputIcon as FileExport } from "lucide-react"
import { ScheduleStats } from "./schedule-stats"
import { WeeklyCalendar } from "./weekly-calendar"
import { CourseListView } from "./course-list-view"
import type { SelectedCourse, Course } from "@/lib/types"
import type { RankedRecommendation } from "@/lib/recommendation/types"
import { findScheduleConflicts, hasConflict } from "@/lib/schedule-utils"

interface DashboardProps {
  selectedCourses: SelectedCourse[]
  allCourses: Course[]
  currentView: "calendar" | "list"
  onToggleView: () => void
  onShowDetails: (course: SelectedCourse) => void
  onOpenNotes: (courseId: string) => void
  onRemoveCourse: (courseId: string) => void
  courseNotes: Record<string, string>
  onSwapCourse: (oldCourseId: string, newCourse: Course) => void
  scheduledRecommendations?: RankedRecommendation[]
}

export function Dashboard({
  selectedCourses,
  allCourses,
  currentView,
  onToggleView,
  onShowDetails,
  onOpenNotes,
  onRemoveCourse,
  courseNotes,
  onSwapCourse,
  scheduledRecommendations = [],
}: DashboardProps) {
  const [departmentFilter, setDepartmentFilter] = useState("")
  const [timeFilter, setTimeFilter] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const exportSchedule = () => {
    window.print()
  }

  const filteredCourses = selectedCourses.filter((course) => {
    let passesFilter = true

    if (departmentFilter) {
      const deptCode = getDepartmentCode(course.Class)
      if (deptCode !== departmentFilter) {
        passesFilter = false
      }
    }

    if (timeFilter && passesFilter) {
      const timeMatch = course.DaysTimes?.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i)
      if (timeMatch) {
        let hour = Number.parseInt(timeMatch[1])
        const period = timeMatch[3].toUpperCase()

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

  const conflicts = findScheduleConflicts(filteredCourses)

  const scheduledRecommendationInsights = selectedCourses
    .map((course) => {
      const classCode = course.Class?.trim().toUpperCase()
      if (!classCode) return null
      return scheduledRecommendations.find(
        (recommendation) => recommendation.courseCode.trim().toUpperCase() === classCode
      ) || null
    })
    .filter((item): item is RankedRecommendation => item != null)

  const getAlternativesForCourse = (course: SelectedCourse): Course[] => {
    const sameClass = allCourses.filter(
      (c) => c.Class === course.Class && c.Section !== course.Section,
    )
    const otherSelected = selectedCourses.filter((c) => c.id !== course.id)
    return sameClass.filter((candidate) => !hasConflict(candidate, otherSelected))
  }

  return (
    <Card className="shadow-soft rounded-xl overflow-hidden hover-card-effect">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 bg-gradient-to-br from-primary-50 to-white border-b border-primary-100">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl text-primary-800">Weekly Schedule</CardTitle>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            {mounted ? (
              <>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[180px] bg-primary-700 text-white border-primary-800 hover:bg-primary-800">
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
                  <SelectTrigger className="w-[180px] bg-primary-700 text-white border-primary-800 hover:bg-primary-800">
                    <SelectValue placeholder="All Times" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Times</SelectItem>
                    <SelectItem value="morning">Morning (8AM-12PM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12PM-5PM)</SelectItem>
                    <SelectItem value="evening">Evening (5PM+)</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <div className="w-[180px] h-9 rounded-md border border-primary-200 bg-muted/50" aria-hidden />
                <div className="w-[180px] h-9 rounded-md border border-primary-200 bg-muted/50" aria-hidden />
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={exportSchedule}
              className="flex items-center gap-1 bg-primary-700 hover:bg-primary-800 text-white"
            >
              <FileExport className="h-4 w-4" />
              Export
            </Button>

            <Button
              size="sm"
              onClick={onToggleView}
              className="flex items-center gap-1 bg-primary-700 hover:bg-primary-800 text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Toggle View
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <ScheduleStats selectedCourses={selectedCourses} />

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div>
            {currentView === "calendar" ? (
              <WeeklyCalendar
                selectedCourses={filteredCourses}
                onShowDetails={onShowDetails}
                courseNotes={courseNotes}
              />
            ) : (
              <CourseListView
                selectedCourses={filteredCourses}
                onShowDetails={onShowDetails}
                onOpenNotes={onOpenNotes}
                onRemoveCourse={onRemoveCourse}
              />
            )}
          </div>

          <aside className="border rounded-lg p-4 bg-muted/40 space-y-3">
            <div>
              <h3 className="font-semibold text-sm text-primary-900">Course Conflict Advisor</h3>
              <p className="text-xs text-muted-foreground">
                See overlapping courses and quickly swap to conflict-free sections.
              </p>
            </div>

            {conflicts.length === 0 ? (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
                No time conflicts detected in your current schedule.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {conflicts.map((conflict) => {
                  const { courseA, courseB, overlapLabel } = conflict
                  const alternatives = getAlternativesForCourse(courseA)

                  return (
                    <div
                      key={conflict.id}
                      className="border border-destructive/30 bg-destructive/5 rounded-md px-2.5 py-2 space-y-1"
                    >
                      <p className="text-xs font-semibold text-destructive">
                        Conflict: {courseA.Class} {courseA.Section} and {courseB.Class} {courseB.Section}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Overlap around <span className="font-medium">{overlapLabel}</span>
                      </p>

                      {alternatives.length > 0 ? (
                        <div className="pt-1 space-y-1">
                          <p className="text-[11px] text-muted-foreground">
                            Try a different section of {courseA.Class}:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {alternatives.slice(0, 3).map((alt) => (
                              <Button
                                key={`${alt.Class}-${alt.Section}`}
                                size="xs"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => onSwapCourse(courseA.id, alt)}
                              >
                                Swap to {alt.Section} ({alt.DaysTimes || "TBA"})
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No conflict-free alternative sections of {courseA.Class} found in the catalog.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {scheduledRecommendationInsights.length > 0 && (
              <div className="pt-3 border-t border-border space-y-3">
                <div>
                  <h3 className="font-semibold text-sm text-primary-900">Scheduled Course Insights</h3>
                  <p className="text-xs text-muted-foreground">
                    Why these scheduled courses were selected by the recommendation layer.
                  </p>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {scheduledRecommendationInsights.map((course) => (
                    <div
                      key={`insight-${course.courseCode}`}
                      className="rounded-md border border-primary/15 bg-background px-3 py-2 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{course.courseCode}</p>
                          {course.explanation.requirementCategoryLabel && (
                            <p className="text-[11px] text-muted-foreground">
                              {course.explanation.requirementCategoryLabel}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Score {course.priorityScore}
                        </span>
                      </div>

                      {course.explanation.servesRequirementGroups.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Serves: {course.explanation.servesRequirementGroups.join(", ")}
                        </p>
                      )}

                      {course.explanation.rankingHighlights.length > 0 && (
                        <ul className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground">
                          {course.explanation.rankingHighlights.slice(0, 3).map((reason) => (
                            <li key={`${course.courseCode}-${reason}`}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </CardContent>
    </Card>
  )
}

function getDepartmentCode(className?: string): string {
  if (!className) return ""
  const match = className.match(/^([A-Z]+)/)
  return match ? match[1] : ""
}
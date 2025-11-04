"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  type CourseData,
  groupCoursesByTerm,
  calculateGPA,
  calculateTotalCredits,
  getGradeColor,
} from "@/lib/academic-data"

interface AcademicCalendarDisplayProps {
  courses: CourseData[] | null
}

export function AcademicCalendarDisplay({ courses }: AcademicCalendarDisplayProps) {
  const [groupedCourses, setGroupedCourses] = useState<Record<string, CourseData[]>>({})
  const [sortedTerms, setSortedTerms] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>("timeline")

  useEffect(() => {
    if (courses && courses.length > 0) {
      // Group courses by term
      const grouped = groupCoursesByTerm(courses)
      setGroupedCourses(grouped)

      // Sort terms chronologically
      const terms = Object.keys(grouped).sort((a, b) => {
        const [semesterA, yearA] = a.split(" ")
        const [semesterB, yearB] = b.split(" ")

        // Compare years first
        const yearDiff = Number.parseInt(yearA) - Number.parseInt(yearB)
        if (yearDiff !== 0) return yearDiff

        // If same year, compare semesters
        const semesterOrder = { Spring: 0, Summer: 1, Fall: 2 }
        return (
          (semesterOrder[semesterA as keyof typeof semesterOrder] || 0) -
          (semesterOrder[semesterB as keyof typeof semesterOrder] || 0)
        )
      })

      setSortedTerms(terms)

      // Set the most recent term as the default selected tab
      if (terms.length > 0) {
        setActiveTab(terms[terms.length - 1])
      }
    }
  }, [courses])

  // If no courses are available yet
  if (!courses || courses.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Academic Calendar View</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
          <p>No academic data loaded</p>
          <p className="text-sm mt-2">Use the "Import from MySlice" button to load your course data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Academic Calendar View</span>
          <Badge variant="outline" className="ml-2">
            {courses.length} Courses
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full mb-4 overflow-x-auto flex-wrap justify-start">
            <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            {sortedTerms.map((term) => (
              <TabsTrigger key={term} value={term}>
                {term}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="timeline" className="pt-2">
            <div className="space-y-6">
              {sortedTerms.map((term) => {
                const termCourses = groupedCourses[term] || []
                return (
                  <div key={term} className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">{term}</h3>
                      <div className="flex gap-4">
                        <Badge variant="outline">Credits: {calculateTotalCredits(termCourses)}</Badge>
                        <Badge variant="outline">GPA: {calculateGPA(termCourses)}</Badge>
                      </div>
                    </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {termCourses.map((course, idx) => (
                          <div
                            key={`${course.course}-${idx}`}
                            className="border rounded p-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div className="font-medium">{course.course}</div>
                              <div className="font-medium" style={{ color: getGradeColor(course.grade) }}>
                                {course.grade}
                              </div>
                            </div>
                            <div className="text-sm text-slate-600 truncate" title={course.title}>
                              {course.title}
                            </div>
                            <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                              <div>{course.requirementGroup || "General Education"}</div>
                              <div>{course.credits} cr</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          {sortedTerms.map((term) => {
            const termCourses = groupedCourses[term] || []
            return (
              <TabsContent key={term} value={term} className="pt-2">
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Courses for {term}</h3>
                    <div className="flex gap-4">
                      <Badge variant="outline">Credits: {calculateTotalCredits(termCourses)}</Badge>
                      <Badge variant="outline">GPA: {calculateGPA(termCourses)}</Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="p-3 text-left font-medium text-slate-600">Course</th>
                          <th className="p-3 text-left font-medium text-slate-600">Title</th>
                          <th className="p-3 text-left font-medium text-slate-600">Grade</th>
                          <th className="p-3 text-left font-medium text-slate-600">Credits</th>
                          <th className="p-3 text-left font-medium text-slate-600">Requirement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {termCourses.map((course, idx) => (
                          <tr key={`${course.course}-${idx}`} className="border-t hover:bg-slate-50">
                            <td className="p-3 font-medium">{course.course}</td>
                            <td className="p-3">{course.title}</td>
                            <td className="p-3 font-medium" style={{ color: getGradeColor(course.grade) }}>
                              {course.grade}
                            </td>
                            <td className="p-3">{course.credits}</td>
                            <td className="p-3 text-sm">{course.requirementGroup || "General Education"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, AlertCircle } from "lucide-react"
import { type CourseData, categorizeRequirements, getGradeColor } from "@/lib/academic-data"

interface DegreeRequirementsViewProps {
  courses: CourseData[] | null
}

export function DegreeRequirementsView({ courses }: DegreeRequirementsViewProps) {
  const [activeTab, setActiveTab] = useState<string>("all")

  if (!courses || courses.length === 0) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle>Degree Requirements</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
          <p>No academic data loaded</p>
          <p className="text-sm mt-2">Use the "Academic Data Processor" to load your course data</p>
        </CardContent>
      </Card>
    )
  }

  // Get in-progress courses
  const inProgressCourses = courses.filter((course) => course.grade === "IP")

  // Categorize courses by requirement
  const { categories } = categorizeRequirements(courses)

  // Get all unique requirement groups
  const requirementGroups = Object.keys(categories)

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Degree Requirements Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full mb-4 overflow-x-auto flex-wrap justify-start">
            <TabsTrigger value="all">All Requirements</TabsTrigger>
            {requirementGroups.map((group) => (
              <TabsTrigger key={group} value={group}>
                {group.replace(/ $$[^)]*$$/g, "")} {/* Remove text in parentheses */}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {requirementGroups.map((group) => {
              const category = categories[group]
              const progressPercentage = Math.min(
                100,
                Math.round((category.totalCredits / category.requiredCredits) * 100),
              )

              return (
                <div key={group} className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <h3 className="font-medium text-lg">{group}</h3>
                      <div className="flex gap-2">
                        <Badge variant={progressPercentage === 100 ? "success" : "outline"}>
                          {category.totalCredits}/{category.requiredCredits} credits
                        </Badge>
                        {progressPercentage === 100 && (
                          <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" /> Complete
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    <p className="text-sm text-slate-500 mt-2">
                      {category.remainingCredits > 0
                        ? `${category.remainingCredits} credits remaining`
                        : "All credits completed"}
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="mb-4">
                      <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wide mb-2">
                        Completed Courses
                      </h4>
                      {category.completed.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {category.completed.map((course, idx) => (
                            <div
                              key={`${course.code}-${idx}`}
                              className="flex items-center gap-2 p-2 border rounded bg-slate-50"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-center">
                                  <div className="font-medium truncate">{course.code}</div>
                                  <div className="font-medium" style={{ color: getGradeColor(course.grade) }}>
                                    {course.grade}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500 truncate">{course.title}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic">No courses completed in this category yet.</p>
                      )}
                    </div>

                    {/* In Progress Courses for this category */}
                    {inProgressCourses.filter((c) => (c.requirementGroup || "General Education") === group).length >
                      0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wide mb-2">In Progress</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {inProgressCourses
                            .filter((c) => (c.requirementGroup || "General Education") === group)
                            .map((course, idx) => (
                              <div
                                key={`ip-${course.code}-${idx}`}
                                className="flex items-center gap-2 p-2 border rounded bg-blue-50"
                              >
                                <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex justify-between items-center">
                                    <div className="font-medium truncate">{course.code}</div>
                                    <div className="font-medium text-blue-500">IP</div>
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">{course.title}</div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Remaining Requirements */}
                    {category.remainingCredits > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wide mb-2">
                          Still Needed
                        </h4>
                        <div className="p-3 border rounded bg-amber-50 text-amber-800">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">
                                You need {category.remainingCredits} more credits in this category
                              </p>
                              <p className="text-sm mt-1">
                                Consider taking additional courses to fulfill the {group} requirement.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </TabsContent>

          {/* Individual requirement tabs */}
          {requirementGroups.map((group) => {
            const category = categories[group]
            const progressPercentage = Math.min(
              100,
              Math.round((category.totalCredits / category.requiredCredits) * 100),
            )

            return (
              <TabsContent key={group} value={group} className="space-y-6">
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <h3 className="font-medium text-lg">{group}</h3>
                      <div className="flex gap-2">
                        <Badge variant={progressPercentage === 100 ? "success" : "outline"}>
                          {category.totalCredits}/{category.requiredCredits} credits
                        </Badge>
                        {progressPercentage === 100 && (
                          <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" /> Complete
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    <p className="text-sm text-slate-500 mt-2">
                      {category.remainingCredits > 0
                        ? `${category.remainingCredits} credits remaining`
                        : "All credits completed"}
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="mb-6">
                      <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wide mb-3">
                        Completed Courses
                      </h4>
                      {category.completed.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="p-3 text-left font-medium text-slate-600">Course</th>
                                <th className="p-3 text-left font-medium text-slate-600">Title</th>
                                <th className="p-3 text-left font-medium text-slate-600">Grade</th>
                                <th className="p-3 text-left font-medium text-slate-600">Credits</th>
                                <th className="p-3 text-left font-medium text-slate-600">Term</th>
                              </tr>
                            </thead>
                            <tbody>
                              {category.completed.map((course, idx) => (
                                <tr key={`${course.code}-${idx}`} className="border-t hover:bg-slate-50">
                                  <td className="p-3 font-medium">{course.code}</td>
                                  <td className="p-3">{course.title}</td>
                                  <td className="p-3 font-medium" style={{ color: getGradeColor(course.grade) }}>
                                    {course.grade}
                                  </td>
                                  <td className="p-3">{course.credits}</td>
                                  <td className="p-3">{course.term}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic">No courses completed in this category yet.</p>
                      )}
                    </div>

                    {/* In Progress Courses for this category */}
                    {inProgressCourses.filter((c) => (c.requirementGroup || "General Education") === group).length >
                      0 && (
                      <div className="mb-6">
                        <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wide mb-3">In Progress</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="p-3 text-left font-medium text-slate-600">Course</th>
                                <th className="p-3 text-left font-medium text-slate-600">Title</th>
                                <th className="p-3 text-left font-medium text-slate-600">Status</th>
                                <th className="p-3 text-left font-medium text-slate-600">Credits</th>
                                <th className="p-3 text-left font-medium text-slate-600">Term</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inProgressCourses
                                .filter((c) => (c.requirementGroup || "General Education") === group)
                                .map((course, idx) => (
                                  <tr key={`ip-${course.code}-${idx}`} className="border-t hover:bg-slate-50">
                                    <td className="p-3 font-medium">{course.code}</td>
                                    <td className="p-3">{course.title}</td>
                                    <td className="p-3 font-medium text-blue-500">In Progress</td>
                                    <td className="p-3">{course.credits}</td>
                                    <td className="p-3">{course.term}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Remaining Requirements */}
                    {category.remainingCredits > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wide mb-3">
                          Still Needed
                        </h4>
                        <div className="p-4 border rounded bg-amber-50 text-amber-800">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">
                                You need {category.remainingCredits} more credits in this category
                              </p>
                              <p className="text-sm mt-2">
                                Consider taking additional courses to fulfill the {group} requirement.
                              </p>
                              <div className="mt-3 p-3 bg-white rounded border border-amber-200">
                                <h5 className="font-medium mb-2">Recommended Next Courses:</h5>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                  {group === "ECS/Math/Science GPA" && (
                                    <>
                                      <li>MAT 397 - Calculus III</li>
                                      <li>PHY 212 - General Physics II</li>
                                      <li>ECS 326 - Engineering Materials</li>
                                    </>
                                  )}
                                  {group === "CIS Core GPA (33 Credits)" && (
                                    <>
                                      <li>CIS 341 - Computer Organization</li>
                                      <li>CIS 351 - Data Structures</li>
                                      <li>CIS 352 - Programming Languages</li>
                                    </>
                                  )}
                                  {group === "Upper Division CIS (9 cr) Min Grade C-" && (
                                    <>
                                      <li>CIS 400 - Selected Topics</li>
                                      <li>CIS 425 - Introduction to Computer Graphics</li>
                                      <li>CIS 453 - Software Specification and Design</li>
                                    </>
                                  )}
                                  {group === "Upper Division Courses (8 cr) Min Grade C-" && (
                                    <>
                                      <li>CSE 484 - Introduction to Computer and Network Security</li>
                                      <li>CSE 486 - Design of Operating Systems</li>
                                    </>
                                  )}
                                  {group === "General Education" && (
                                    <>
                                      <li>WRT 205 - Critical Research and Writing</li>
                                      <li>PSY 205 - Foundations of Human Behavior</li>
                                      <li>HST 102 - American History Since 1865</li>
                                    </>
                                  )}
                                  {![
                                    "ECS/Math/Science GPA",
                                    "CIS Core GPA (33 Credits)",
                                    "Upper Division CIS (9 cr) Min Grade C-",
                                    "Upper Division Courses (8 cr) Min Grade C-",
                                    "General Education",
                                  ].includes(group) && (
                                    <li>Consult with your academic advisor for course recommendations</li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
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

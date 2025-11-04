"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Info, StickyNote, Trash2 } from "lucide-react"
import type { SelectedCourse } from "@/lib/types"

interface CourseListViewProps {
  selectedCourses: SelectedCourse[]
  onShowDetails: (course: SelectedCourse) => void
  onOpenNotes: (courseId: string) => void
  onRemoveCourse: (courseId: string) => void
}

export function CourseListView({ selectedCourses, onShowDetails, onOpenNotes, onRemoveCourse }: CourseListViewProps) {
  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 mb-4 text-lg font-medium">
        <Info className="h-5 w-5 text-primary" />
        Course List View
      </h3>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Course</TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Days/Times</TableHead>
            <TableHead>Instructor</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {selectedCourses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                No courses added yet.
              </TableCell>
            </TableRow>
          ) : (
            selectedCourses.map((course) => (
              <TableRow key={course.id} className="hover:bg-gray-50">
                <TableCell>{course.Class || "N/A"}</TableCell>
                <TableCell>{course.Section || "N/A"}</TableCell>
                <TableCell>{course.DaysTimes || "TBA"}</TableCell>
                <TableCell>{course.Instructor || "N/A"}</TableCell>
                <TableCell>{course.Room || "N/A"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onShowDetails(course)} title="View Details">
                      <Info className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onOpenNotes(course.id)} title="Add Notes">
                      <StickyNote className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onRemoveCourse(course.id)} title="Remove Course">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

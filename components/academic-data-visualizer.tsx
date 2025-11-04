"use client"

import { useState } from "react"
import { AcademicFileProcessor } from "./academic-file-processor"
import { AcademicCalendarDisplay } from "./academic-calendar-display"
import { DegreeRequirementsView } from "./degree-requirements-view"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileUp } from "lucide-react"
import type { CourseData, AcademicDataVisualizerProps } from "@/lib/academic-data"

export function AcademicDataVisualizer({
  selectedMajor,
  selectedYear,
  requirements,
  selectedCourses,
}: AcademicDataVisualizerProps) {
  const [courseData, setCourseData] = useState<CourseData[] | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleDataProcessed = (data: CourseData[]) => {
    setCourseData(data)
    setIsDialogOpen(false) // Close dialog after processing
  }

  return (
    <div className="w-full space-y-6">
      {/* Button to open the file processor */}
      <div className="flex justify-center mb-6">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" size="lg">
              <FileUp className="h-4 w-4" />
              Import Academic Data
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import Academic Data</DialogTitle>
              <DialogDescription>
                Upload your academic data file to visualize your courses on the calendar.
              </DialogDescription>
            </DialogHeader>
            <AcademicFileProcessor onDataProcessed={handleDataProcessed} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Display the processed data */}
      {!courseData ? (
        <div className="text-center p-12 border rounded-lg bg-slate-50">
          <h3 className="text-lg font-medium mb-2">No Academic Data Loaded</h3>
          <p className="text-muted-foreground mb-6">
            Import your academic data to view your course history and degree progress.
          </p>
          <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Import Data
          </Button>
        </div>
      ) : (
        <>
          <AcademicCalendarDisplay courses={courseData} />
          <DegreeRequirementsView courses={courseData} />
        </>
      )}
    </div>
  )
}

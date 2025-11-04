"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ImageScheduleImport } from "./image-schedule-import"
import { ScanText } from "lucide-react"
import type { SelectedCourse } from "@/lib/types"

interface ScheduleImportModalProps {
  onCoursesImported: (courses: SelectedCourse[]) => void
}

export function ScheduleImportModal({ onCoursesImported }: ScheduleImportModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleCoursesExtracted = (courses: SelectedCourse[]) => {
    onCoursesImported(courses)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <ScanText className="h-4 w-4" />
          Import from Image
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Import Schedule from Image</DialogTitle>
          <DialogDescription>
            Upload an image of your schedule or course list to automatically extract and add courses to your calendar.
          </DialogDescription>
        </DialogHeader>
        <ImageScheduleImport onCoursesExtracted={handleCoursesExtracted} />
      </DialogContent>
    </Dialog>
  )
}

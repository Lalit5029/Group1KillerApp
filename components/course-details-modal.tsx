"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Info, Calendar, User, MapPin, CalendarDays } from "lucide-react"
import type { Course } from "@/lib/types"

interface CourseDetailsModalProps {
  course: Course
  onClose: () => void
}

export function CourseDetailsModal({ course, onClose }: CourseDetailsModalProps) {
  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Course Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <h3 className="text-lg font-semibold text-primary">
            {course.Class} {course.Section || ""}
          </h3>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Days/Times</div>
              <div>{course.DaysTimes || "TBA"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Instructor</div>
              <div>{course.Instructor || "TBA"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Room</div>
              <div>{course.Room || "TBA"}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CalendarDays className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Meeting Dates</div>
              <div>{course.MeetingDates || "TBA"}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

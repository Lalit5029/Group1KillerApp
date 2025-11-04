"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { StickyNote } from "lucide-react"
import type { Course } from "@/lib/types"

interface CourseNotesModalProps {
  courseId: string
  initialNotes: string
  onSave: (notes: string) => void
  onClose: () => void
  course: Course | null
}

export function CourseNotesModal({ courseId, initialNotes, onSave, onClose, course }: CourseNotesModalProps) {
  const [notes, setNotes] = useState(initialNotes)

  const handleSave = () => {
    onSave(notes)
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Course Notes
          </DialogTitle>
        </DialogHeader>

        {course && (
          <p className="text-sm font-medium">
            {course.Class} {course.Section}
          </p>
        )}

        <Textarea
          placeholder="Add your notes about this course here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[150px]"
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Notes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

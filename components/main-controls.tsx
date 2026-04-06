"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FlaskConical, Sparkles, Search, Trash2 } from "lucide-react"
import { ScheduleImportModal } from "./schedule-import-modal"
import type { SelectedCourse } from "@/lib/types"

type WorkloadLevel = "low" | "medium" | "high"

interface MainControlsProps {
  onGenerateSchedule: (workload: WorkloadLevel) => void
  onToggleSearch: () => void
  onResetSchedule: () => void
  onImportFromImage: (courses: SelectedCourse[]) => void
  onOpenWhatIf: () => void
  disabled: boolean
}

export function MainControls({
  onGenerateSchedule,
  onToggleSearch,
  onResetSchedule,
  onImportFromImage,
  onOpenWhatIf,
  disabled,
}: MainControlsProps) {
  const [isWorkloadDialogOpen, setIsWorkloadDialogOpen] = useState(false)

  const handleWorkloadSelect = (workload: WorkloadLevel) => {
    console.log("[SuggestedCourses] Workload selected:", workload)
    onGenerateSchedule(workload)
    setIsWorkloadDialogOpen(false)
  }

  return (
    <>
      <Dialog open={isWorkloadDialogOpen} onOpenChange={setIsWorkloadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Semester Workload</DialogTitle>
            <DialogDescription>
              Suggested courses will stay between 12 and 19 credits and target the workload you choose.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <Button onClick={() => handleWorkloadSelect("low")} className="justify-between">
              <span>Low Workload</span>
              <span className="text-xs opacity-80">Target 12 credits</span>
            </Button>
            <Button onClick={() => handleWorkloadSelect("medium")} variant="secondary" className="justify-between">
              <span>Medium Workload</span>
              <span className="text-xs opacity-80">Target 15 credits</span>
            </Button>
            <Button onClick={() => handleWorkloadSelect("high")} variant="outline" className="justify-between">
              <span>High Workload</span>
              <span className="text-xs opacity-80">Target 18 credits</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-gradient-to-br from-primary-50 to-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            onClick={() => {
              console.log("[SuggestedCourses] Add Suggested Courses clicked")
              setIsWorkloadDialogOpen(true)
            }}
            disabled={disabled}
            className="flex items-center gap-2 bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            <Sparkles className="h-4 w-4" />
            Add Suggested Courses
          </Button>

          <Button
            onClick={onToggleSearch}
            disabled={disabled}
            className="flex items-center gap-2 bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            <Search className="h-4 w-4" />
            Search & Add Courses
          </Button>

          <Button
            onClick={onOpenWhatIf}
            disabled={disabled}
            variant="secondary"
            className="flex items-center gap-2 border border-primary/20"
          >
            <FlaskConical className="h-4 w-4" />
            What-if planner
          </Button>

          <ScheduleImportModal onCoursesImported={onImportFromImage} />

          <Button
            onClick={onResetSchedule}
            variant="outline"
            className="flex items-center gap-2 border-primary-200 text-primary-700 hover:bg-primary-50"
          >
            <Trash2 className="h-4 w-4" />
            Reset Schedule
          </Button>
        </div>
      </div>
    </>
  )
}

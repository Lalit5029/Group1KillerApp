"use client"

import { Button } from "@/components/ui/button"
import { Sparkles, Search, Trash2 } from "lucide-react"
import { ScheduleImportModal } from "./schedule-import-modal"
import type { SelectedCourse } from "@/lib/types"

interface MainControlsProps {
  onGenerateSchedule: () => void
  onToggleSearch: () => void
  onResetSchedule: () => void
  onImportFromImage: (courses: SelectedCourse[]) => void
  disabled: boolean
}

export function MainControls({
  onGenerateSchedule,
  onToggleSearch,
  onResetSchedule,
  onImportFromImage,
  disabled,
}: MainControlsProps) {
  return (
    <div className="bg-gradient-to-br from-primary-50 to-white p-6 rounded-xl shadow-sm mb-6">
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          onClick={onGenerateSchedule}
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
  )
}

"use client"

import { Loader2, GraduationCap } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type PlannerTermOption = { value: string; label: string }

interface AppHeaderProps {
  selectedMajor: string
  selectedYear: string
  isLoading: boolean
  studentName?: string
  /** Semester or legacy class-year buckets for suggested courses (from major requirements keys). */
  planOptions: PlannerTermOption[]
  /** Called when the user changes planner term (semester or class year). */
  onPlannerTermChange?: (value: string) => void
}

export function AppHeader({
  selectedMajor,
  selectedYear,
  isLoading,
  studentName,
  planOptions,
  onPlannerTermChange,
}: AppHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary via-primary-600 to-secondary p-5 text-primary-foreground shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.35)]">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Academic Planner</h1>
          {studentName ? <p className="text-xs text-white/80">Student: {studentName}</p> : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-3">
        {selectedMajor ? (
          <p className="text-center text-lg font-medium">
            <span className="inline-block rounded-full bg-white/20 px-4 py-1 backdrop-blur-sm">
              <span className="font-semibold">{selectedMajor}</span>
            </span>
          </p>
        ) : null}
        {selectedMajor && selectedYear && onPlannerTermChange && planOptions.length > 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline opacity-90">Planner term</span>
            <Select
              value={
                planOptions.some((o) => o.value === selectedYear)
                  ? selectedYear
                  : planOptions[0]?.value ?? ""
              }
              onValueChange={(v) => onPlannerTermChange(v)}
            >
              <SelectTrigger className="h-9 min-w-[200px] max-w-[280px] border-white/30 bg-white/15 text-primary-foreground backdrop-blur-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : selectedMajor && selectedYear ? (
          <p className="text-lg font-medium bg-white/20 px-4 py-1 rounded-full backdrop-blur-sm">
            {selectedYear}
          </p>
        ) : (
          <p className="text-lg italic opacity-80">
            Loading planner context…
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading Courses...</span>
        </div>
      )}
    </header>
  )
}

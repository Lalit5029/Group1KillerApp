"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { CourseData } from "@/lib/types"
import {
  CS_GRADUATION_SEMESTERS,
  CS_PREREQUISITE_CHAINS,
  completionMapFromAcademic,
  rowStatus,
  summarizeProgress,
} from "@/lib/cs-graduation-path"
import { CheckCircle2, CircleDashed, ChevronRight, Route } from "lucide-react"

interface GraduationPathTimelineProps {
  courses: CourseData[]
}

export function GraduationPathTimeline({ courses }: GraduationPathTimelineProps) {
  const completed = useMemo(() => completionMapFromAcademic(courses), [courses])
  const summary = useMemo(() => summarizeProgress(completed), [completed])

  const semesterFill = useMemo(() => {
    return CS_GRADUATION_SEMESTERS.map((sem) => {
      const rows = sem.rows.filter((r) => r.key !== "ud")
      if (rows.length === 0) return 100
      const done = rows.filter((r) => rowStatus(r, completed) === "done").length
      return Math.round((done / rows.length) * 100)
    })
  }, [completed])

  if (!courses.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" aria-hidden />
            Path to graduation
          </CardTitle>
          <CardDescription>
            Gantt-style CS BS roadmap from now through graduation. Load academic data on the Academic tab first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No transcript courses loaded yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" aria-hidden />
          Path to graduation
        </CardTitle>
        <CardDescription>
          Suggested eight-term CS BS sequence with your completion status, prerequisite chains, and what is still open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Core roadmap progress
              <span className="text-muted-foreground font-normal">
                {" "}
                ({summary.doneCount} of {summary.trackedCount} checklist rows satisfied on transcript)
              </span>
            </p>
            <Badge variant={summary.doneCount === summary.trackedCount ? "default" : "secondary"}>
              {summary.trackedCount > 0
                ? `${Math.round((summary.doneCount / summary.trackedCount) * 100)}%`
                : "—"}
            </Badge>
          </div>
          <Progress
            value={
              summary.trackedCount > 0
                ? (summary.doneCount / summary.trackedCount) * 100
                : 0
            }
            className="h-2"
          />
          {summary.remainingLabels.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {summary.remainingLabels.length} requirement row{summary.remainingLabels.length === 1 ? "" : "s"} left
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto list-disc pl-5 text-muted-foreground space-y-0.5">
                {summary.remainingLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Timeline (by suggested term)</p>
          <div
            className="flex h-3 gap-0.5 rounded-md overflow-hidden border bg-muted/40"
            role="img"
            aria-label="Semester completion strip: eight terms from year one fall through year four spring"
          >
            {semesterFill.map((pct, i) => (
              <div
                key={CS_GRADUATION_SEMESTERS[i].id}
                className="flex-1 min-w-[2rem] relative bg-muted"
                title={`${CS_GRADUATION_SEMESTERS[i].fullLabel}: ${pct}% of rows done`}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all",
                    pct === 100 ? "bg-emerald-500/90" : pct > 0 ? "bg-amber-500/85" : "bg-transparent"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 mt-1 text-[10px] text-muted-foreground uppercase tracking-tight overflow-x-auto">
            {CS_GRADUATION_SEMESTERS.map((s) => (
              <span key={s.id} className="flex-1 min-w-[2rem] text-center truncate" title={s.fullLabel}>
                {s.shortLabel}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex gap-2 min-w-[720px] pb-1">
            {CS_GRADUATION_SEMESTERS.map((sem) => (
              <div
                key={sem.id}
                className="flex-1 min-w-[88px] rounded-lg border bg-card shadow-sm flex flex-col"
              >
                <div className="px-2 py-1.5 border-b bg-muted/50 text-center">
                  <p className="text-xs font-semibold leading-tight">{sem.shortLabel}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{sem.fullLabel}</p>
                </div>
                <ul className="p-1.5 space-y-1 flex-1">
                  {sem.rows.map((row) => {
                    const status = rowStatus(row, completed)
                    return (
                      <li
                        key={row.key}
                        className={cn(
                          "text-[11px] leading-snug rounded px-1.5 py-1 border",
                          status === "done" &&
                            "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
                          status === "remaining" &&
                            "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
                          status === "advisory" &&
                            "border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground"
                        )}
                      >
                        <span className="flex items-start gap-1">
                          {status === "done" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                          ) : status === "remaining" ? (
                            <CircleDashed className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <CircleDashed className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-50" />
                          )}
                          <span>{row.display}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Prerequisite chains (CS — advisory)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CS_PREREQUISITE_CHAINS.map((block) => (
              <div
                key={block.title}
                className="rounded-md border bg-muted/20 p-3 text-xs"
              >
                <p className="font-medium mb-2 text-foreground">{block.title}</p>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-0">
                  {block.chain.map((step, idx) => (
                    <span key={step} className="inline-flex items-center">
                      {idx > 0 && (
                        <ChevronRight className="h-3.5 w-3.5 mx-0.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="rounded bg-background/80 px-1.5 py-0.5 border border-border/80 whitespace-nowrap">
                        {step}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Course, SelectedCourse } from "@/lib/types";
import { findScheduleConflicts, hasConflict } from "@/lib/schedule-utils";
import { sumSelectedCredits } from "@/lib/schedule-credits";
import {
  ENTIRE_SCHEDULE,
  cloneScheduleWithNewIds,
  collectTermLabels,
  diffBaselineVsScratch,
  mergeWhatIfApply,
  sliceScheduleForTerm,
  type TermMode,
} from "@/lib/what-if-schedule";
import { FlaskConical, Plus, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatIfPlannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCourses: SelectedCourse[];
  catalogCourses: Course[];
  onApply: (nextSchedule: SelectedCourse[]) => void;
}

export function WhatIfPlanner({
  open,
  onOpenChange,
  selectedCourses,
  catalogCourses,
  onApply,
}: WhatIfPlannerProps) {
  const termOptions = useMemo(() => collectTermLabels(selectedCourses), [selectedCourses]);
  const [termMode, setTermMode] = useState<TermMode>(ENTIRE_SCHEDULE);
  const [baselineIds, setBaselineIds] = useState<Set<string>>(new Set());
  const [baselineSlice, setBaselineSlice] = useState<SelectedCourse[]>([]);
  const [scratch, setScratch] = useState<SelectedCourse[]>([]);
  const [addQuery, setAddQuery] = useState("");

  const resetFromProps = useCallback(() => {
    const slice = sliceScheduleForTerm(selectedCourses, termMode);
    setBaselineIds(new Set(slice.map((c) => c.id)));
    setBaselineSlice(slice);
    setScratch(cloneScheduleWithNewIds(slice));
    setAddQuery("");
  }, [selectedCourses, termMode]);

  useEffect(() => {
    if (open) {
      resetFromProps();
    }
  }, [open, resetFromProps]);

  const baselineCredits = useMemo(
    () => sumSelectedCredits(baselineSlice, catalogCourses),
    [baselineSlice, catalogCourses]
  );
  const scratchCredits = useMemo(
    () => sumSelectedCredits(scratch, catalogCourses),
    [scratch, catalogCourses]
  );
  const creditDelta = Math.round((scratchCredits - baselineCredits) * 10) / 10;

  const conflicts = useMemo(() => findScheduleConflicts(scratch), [scratch]);
  const { added, removed } = useMemo(
    () => diffBaselineVsScratch(baselineSlice, scratch),
    [baselineSlice, scratch]
  );

  const addCandidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalogCourses
      .filter((c) => {
        if (!c.Class || !c.Section) return false;
        const hay = `${c.Class} ${c.Section} ${c.Instructor || ""} ${c.DaysTimes || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
        if (scratch.some((s) => s.Class === c.Class && s.Section === c.Section)) return false;
        return !hasConflict(c, scratch);
      })
      .slice(0, 25);
  }, [addQuery, catalogCourses, scratch]);

  const removeFromScratch = (id: string) => {
    setScratch((prev) => prev.filter((c) => c.id !== id));
  };

  const swapInScratch = (oldId: string, alt: Course) => {
    setScratch((prev) =>
      prev.map((row) =>
        row.id === oldId
          ? {
              ...alt,
              id: oldId,
            }
          : row
      )
    );
  };

  const addToScratch = (course: Course) => {
    if (!course.Class || !course.Section) return;
    if (scratch.some((s) => s.Class === course.Class && s.Section === course.Section)) return;
    if (hasConflict(course, scratch)) return;
    const row: SelectedCourse = {
      ...course,
      id: `whatif-add-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
    setScratch((prev) => [...prev, row]);
    setAddQuery("");
  };

  const alternativesFor = (row: SelectedCourse): Course[] => {
    return catalogCourses.filter(
      (c) => c.Class === row.Class && c.Section !== row.Section && !hasConflict(c, scratch.filter((s) => s.id !== row.id))
    );
  };

  const handleApply = () => {
    const next = mergeWhatIfApply(selectedCourses, baselineIds, scratch);
    onApply(next);
    onOpenChange(false);
  };

  const sliceEmpty = baselineSlice.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-xl"
      >
        <SheetHeader className="space-y-1 border-b border-border pb-4 pr-8 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-primary" />
            What-if semester planner
          </SheetTitle>
          <SheetDescription>
            Duplicate part of your schedule, try different sections, and review credits and conflicts.
            Nothing is saved until you click <span className="font-medium text-foreground">Apply to schedule</span>.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-1">
          <div className="space-y-6 py-4 pr-4">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={termMode}
                onValueChange={(v) => setTermMode(v as TermMode)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose which courses to copy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ENTIRE_SCHEDULE}>
                    Entire current schedule ({selectedCourses.length} courses)
                  </SelectItem>
                  {termOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      Term: {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {termOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No per-term labels on your courses yet—use &quot;Entire current schedule&quot; or add a
                  term on imports later. For now, all selected courses are treated as one plan.
                </p>
              )}
            </div>

            {sliceEmpty ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No courses in this scope. Add courses to your main schedule first or pick
                &quot;Entire current schedule&quot;.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Baseline</p>
                    <p className="text-lg font-semibold tabular-nums">{baselineCredits} cr</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">What-if</p>
                    <p className="text-lg font-semibold tabular-nums">{scratchCredits} cr</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Δ Credits</p>
                    <p
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        creditDelta > 0 && "text-amber-700",
                        creditDelta < 0 && "text-blue-700"
                      )}
                    >
                      {creditDelta > 0 ? "+" : ""}
                      {creditDelta}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Conflicts</p>
                    <p className="text-lg font-semibold tabular-nums text-destructive">
                      {conflicts.length}
                    </p>
                  </div>
                </div>

                {(added.length > 0 || removed.length > 0) && (
                  <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                    <p className="text-xs font-semibold text-foreground">Change summary</p>
                    <div className="flex flex-wrap gap-2">
                      {removed.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <span className="text-muted-foreground">Removed vs baseline:</span>
                          {removed.map((c) => (
                            <Badge key={`rm-${c.id}`} variant="outline" className="font-mono">
                              {c.Class} {c.Section}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {added.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <span className="text-muted-foreground">Added vs baseline:</span>
                          {added.map((c) => (
                            <Badge key={`ad-${c.id}`} variant="secondary" className="font-mono">
                              {c.Class} {c.Section}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Requirement planning is unchanged here—compare credit load and course codes against your
                      degree checklist separately.
                    </p>
                  </div>
                )}

                {conflicts.length > 0 && (
                  <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {conflicts.length} time overlap{conflicts.length > 1 ? "s" : ""} in the what-if plan.
                      Swap sections or remove a course before applying.
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>What-if schedule (editable)</Label>
                  <div className="space-y-2 rounded-lg border border-border">
                    {scratch.map((row) => {
                      const alts = alternativesFor(row);
                      return (
                        <div
                          key={row.id}
                          className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-semibold">
                              {row.Class} <span className="text-muted-foreground">{row.Section}</span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.DaysTimes || "TBA"} · {row.Instructor || "Instructor TBA"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {alts.length > 0 && (
                              <Select
                                key={`${row.id}-${row.Section}`}
                                onValueChange={(val) => {
                                  const alt = alts.find((a) => `${a.Class}|${a.Section}` === val);
                                  if (alt) swapInScratch(row.id, alt);
                                }}
                              >
                                <SelectTrigger className="h-8 w-[200px] text-xs">
                                  <SelectValue placeholder="Swap section" />
                                </SelectTrigger>
                                <SelectContent>
                                  {alts.map((a) => (
                                    <SelectItem
                                      key={`${a.Class}-${a.Section}`}
                                      value={`${a.Class}|${a.Section}`}
                                    >
                                      {a.Section} — {a.DaysTimes || "TBA"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              aria-label="Remove from what-if"
                              onClick={() => removeFromScratch(row.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatif-add">Add a course (catalog search)</Label>
                  <Input
                    id="whatif-add"
                    placeholder="Type at least 2 characters (e.g. CIS, 454)…"
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                  />
                  {addQuery.trim().length >= 2 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 p-1">
                      {addCandidates.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-muted-foreground">
                          No matching sections, or all conflict with the what-if plan.
                        </p>
                      ) : (
                        addCandidates.map((c) => (
                          <button
                            key={`${c.Class}-${c.Section}`}
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addToScratch(c)}
                          >
                            <span className="font-mono text-xs">
                              {c.Class} {c.Section}
                            </span>
                            <Plus className="h-4 w-4 shrink-0 text-primary" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row gap-2 border-t border-border bg-background pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" disabled={sliceEmpty} onClick={handleApply}>
            Apply to schedule
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

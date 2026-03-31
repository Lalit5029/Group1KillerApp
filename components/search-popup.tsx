"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Plus } from "lucide-react";
import type { Course, CourseSearchCriteria } from "@/lib/types";
import {
  buildSearchQueryFromCriteria,
  filterCoursesByCriteria,
} from "@/lib/course-search";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PREVIEW_DEBOUNCE_MS = 200;
const AUTOCOMPLETE_MAX = 40;

interface SearchPopupProps {
  onClose: () => void;
  onSearch: (criteria: CourseSearchCriteria) => void;
  /** Updates result list while typing (no toast). */
  onCriteriaPreview?: (criteria: CourseSearchCriteria) => void;
  catalogCourses: Course[];
  searchResults: Course[];
  onAddCourse: (course: Course) => void;
}

const emptyCriteria: CourseSearchCriteria = {
  query: "",
  subject: "",
  courseNumber: "",
  instructor: "",
  section: "",
};

export function SearchPopup({
  onClose,
  onSearch,
  onCriteriaPreview,
  catalogCourses,
  searchResults,
  onAddCourse,
}: SearchPopupProps) {
  const [criteria, setCriteria] = useState<CourseSearchCriteria>({ ...emptyCriteria });
  const [debouncedCriteria, setDebouncedCriteria] = useState<CourseSearchCriteria>({
    ...emptyCriteria,
  });
  const [focusWithinForm, setFocusWithinForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedCriteria(criteria), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [criteria]);

  useEffect(() => {
    onCriteriaPreview?.(debouncedCriteria);
  }, [debouncedCriteria, onCriteriaPreview]);

  const suggestions = useMemo(() => {
    const q = buildSearchQueryFromCriteria(debouncedCriteria);
    if (!q.trim()) return [];
    return filterCoursesByCriteria(catalogCourses, debouncedCriteria).slice(0, AUTOCOMPLETE_MAX);
  }, [catalogCourses, debouncedCriteria]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(criteria);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch(criteria);
    }
  };

  const requestedCourseLabel = [criteria.subject, criteria.courseNumber]
    .filter(Boolean)
    .join(" ")
    .trim();

  const hasInput = Object.values(criteria).some((value) => (value || "").trim().length > 0);

  const showAutocomplete =
    focusWithinForm &&
    buildSearchQueryFromCriteria(debouncedCriteria).trim().length > 0 &&
    suggestions.length > 0;

  const pickSuggestion = (course: Course) => {
    onAddCourse(course);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search courses
          </DialogTitle>
        </DialogHeader>

        <form
          ref={formRef}
          onSubmit={handleSearch}
          className="mt-4"
          onFocusCapture={() => setFocusWithinForm(true)}
          onBlurCapture={(e) => {
            if (!formRef.current?.contains(e.relatedTarget as Node)) {
              setFocusWithinForm(false);
            }
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label htmlFor="course-keyword-search">Keyword search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="course-keyword-search"
                  placeholder='Try "CIS", instructor name, section, or room…'
                  value={criteria.query}
                  onChange={(e) =>
                    setCriteria((prev) => ({ ...prev, query: e.target.value }))
                  }
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  className="border-2 border-input bg-background pl-10 focus-visible:border-primary focus-visible:ring-primary/25"
                />

                {showAutocomplete && (
                  <ul
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                    role="listbox"
                    aria-label="Matching courses"
                  >
                    {suggestions.map((course, index) => (
                      <li key={`${course.Class}-${course.Section}-${index}`} role="option">
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm",
                            "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickSuggestion(course);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="font-medium">
                              {course.Class || requestedCourseLabel || "Course"}{" "}
                              <span className="text-muted-foreground">{course.Section}</span>
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {course.Instructor || "Instructor TBA"} · {course.DaysTimes || "TBA"}
                            </span>
                          </span>
                          <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="course-subject">Subject</Label>
                <Input
                  id="course-subject"
                  placeholder="e.g., CIS"
                  value={criteria.subject}
                  onChange={(e) =>
                    setCriteria((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-number">Course number</Label>
                <Input
                  id="course-number"
                  placeholder="e.g., 454"
                  value={criteria.courseNumber}
                  onChange={(e) =>
                    setCriteria((prev) => ({ ...prev, courseNumber: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-instructor">Instructor</Label>
                <Input
                  id="course-instructor"
                  placeholder="Name"
                  value={criteria.instructor}
                  onChange={(e) =>
                    setCriteria((prev) => ({ ...prev, instructor: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-section">Section</Label>
                <Input
                  id="course-section"
                  placeholder="Section"
                  value={criteria.section}
                  onChange={(e) =>
                    setCriteria((prev) => ({ ...prev, section: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              Search
            </Button>
          </div>
        </form>

        <div className="mt-4 max-h-[350px] overflow-y-auto rounded-md border border-border">
          {searchResults.length === 0 ? (
            <p className="bg-muted/40 py-8 text-center text-sm text-muted-foreground">
              {hasInput
                ? "No courses found matching your search."
                : "Type above to see suggestions, or use Search for the full result list."}
            </p>
          ) : (
            <div className="space-y-2 p-2">
              {searchResults.map((course, index) => {
                const isNotAvailable = course.Section === "Not Available";
                return (
                  <div
                    key={`${course.Class}-${course.Section}-${index}`}
                    className="flex items-center justify-between rounded-md border border-border bg-card p-3 transition-shadow hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {course.Class || requestedCourseLabel || "Requested course"} {course.Section}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {course.DaysTimes || "TBA"} -
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 transition-colors hover:bg-muted/80">
                                {course.Instructor || "N/A"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px]">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{course.Instructor}</h4>
                                  <p className="text-sm">Rating: {course.RMP_Rating || "N/A"}/5</p>
                                </div>
                                {course.Reviews?.length ? (
                                  <ul className="list-disc space-y-1 pl-4">
                                    {course.Reviews.map((review, i) => (
                                      <li key={i}>{review}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p>No reviews yet</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-xs text-muted-foreground">{course.Room || "TBA"}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onAddCourse(course)}
                      disabled={isNotAvailable}
                      className="shrink-0 bg-primary hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      {isNotAvailable ? "Unavailable" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

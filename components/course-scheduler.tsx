"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { AppHeader } from "./app-header"
import { MainControls } from "./main-controls"
import { Dashboard } from "./dashboard"
import { SearchPopup } from "./search-popup"
import { CourseDetailsModal } from "./course-details-modal"
import { CourseNotesModal } from "./course-notes-modal"
import { NotificationArea } from "./notification-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, GraduationCap, BookOpen, Download, Upload } from "lucide-react"
import type { Course, SelectedCourse, Notification, Major, Requirements, CourseData, CourseSearchCriteria } from "@/lib/types"
import { fetchCourses, fetchRequirements } from "@/lib/data-utils"
import { findFirstBlockingCourse, findScheduleConflicts, hasConflict, parseDaysTimes } from "@/lib/schedule-utils"
import {
  buildSearchQueryFromCriteria,
  filterCoursesByCriteria,
} from "@/lib/course-search"
import { estimateSectionCredits } from "@/lib/schedule-credits"
import { WhatIfPlanner } from "@/components/what-if-planner"
import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { evaluateCsGraduationReadiness } from "@/lib/graduation-readiness"
import { GraduationPathTimeline } from "@/components/graduation-path-timeline"
import {
  normalizePlannerTerm,
  orderedRequirementKeys,
  PLAN_SEMESTER_OPTIONS,
} from "@/lib/plan-semester"
import { buildCsWorkloadSuggestionList, usesCsWorkloadMatrix } from "@/lib/cs-workload-suggestions"
import {
  applyLowWorkloadPostpone,
  buildFillerCourseQueue,
  isSparseSemesterBucket,
  requirementStringsToSlots,
  workloadTargetCredits,
} from "@/lib/schedule-generation"
import { usePresentationPrivacy } from "@/components/presentation-privacy-provider"
import { ScheduleAssistantChat } from "@/components/schedule-assistant-chat"
import type { RankedRecommendation } from "@/lib/recommendation/types"

interface RequirementGroup {
  name: string;
  required: number;
  completed: number;
}

const requirementGroups: Record<string, RequirementGroup> = {
  "ECS/Math/Science GPA": { name: "ECS, Math & Science", required: 65, completed: 0 },
  "CIS Core GPA (33 Credits)": { name: "CIS Core", required: 33, completed: 0 },
  "Upper Division CIS (9 cr) Min Grade C-": { name: "Upper Division CIS", required: 9, completed: 0 },
  "Upper Division Courses (8 cr) Min Grade C-": { name: "Upper Division Electives", required: 8, completed: 0 },
  "First Year Seminar": { name: "First Year Seminar", required: 1, completed: 0 },
}

interface RequirementCourse {
  code: string;
  title: string;
  grade: string;
  credits: string;
  term: string;
}

interface RequirementBlock {
  title: string;
  status: string;
  courses: RequirementCourse[];
}

interface BlockData {
  title: string;
  status: string;
  courses: RequirementCourse[];
}

type WorkloadLevel = "low" | "medium" | "high"

const MIN_SEMESTER_CREDITS = 12
const MAX_SEMESTER_CREDITS = 19
const WORKLOAD_TARGETS: Record<WorkloadLevel, number> = {
  low: 12,
  medium: 15,
  high: 18,
}

const DEFAULT_CS_MAJOR_KEY = "Computer Science, BS"

function plannerYearStorageKey(studentId: string) {
  return `planner:selectedYear:${studentId}`
}

function recommendationSourcePoolLabel(poolId: string) {
  switch (poolId) {
    case "required_courses":
      return "Required courses"
    case "upper_division_cs":
      return "Upper-division CS"
    case "ssh_distribution":
      return "SSH distribution"
    case "free_electives":
      return "Free electives"
    default:
      return poolId.replace(/_/g, " ")
  }
}

function normalizeRecommendationCourseCode(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
}

interface CourseSchedulerProps {
  selectedStudentId: string
  selectedStudentName?: string
  /** From student record (advisee registration); drives class year when set. */
  studentAcademicYear?: string | null
}

export default function CourseScheduler({
  selectedStudentId,
  selectedStudentName,
  studentAcademicYear,
}: CourseSchedulerProps) {
  const dedupeAcademicCourseRows = (rows: CourseData[]) => {
    const seen = new Set<string>()

    return rows.filter((course) => {
      const dedupeKey = [
        course.code,
        course.term,
        course.name || course.title,
        course.grade,
        course.credits,
      ]
        .map((value) => String(value || "").trim().toUpperCase())
        .join("::")

      if (seen.has(dedupeKey)) {
        return false
      }

      seen.add(dedupeKey)
      return true
    })
  }

  const dedupeRecommendedCourses = useCallback((rows: RankedRecommendation[]) => {
    const byCourseCode = new Map<string, RankedRecommendation>()

    for (const row of rows) {
      const normalizedCode = normalizeRecommendationCourseCode(row.courseCode)
      if (!normalizedCode) continue

      const existing = byCourseCode.get(normalizedCode)
      if (!existing || row.priorityScore > existing.priorityScore) {
        byCourseCode.set(normalizedCode, row)
      }
    }

    return Array.from(byCourseCode.values())
  }, [])

  // State
  const [courses, setCourses] = useState<Course[]>([])
  const [requirements, setRequirements] = useState<Requirements>({})
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([])
  const [currentSearchResults, setCurrentSearchResults] = useState<Course[]>([])
  const [selectedMajor, setSelectedMajor] = useState<string>("")
  const [selectedYear, setSelectedYear] = useState<string>("")
  const [currentView, setCurrentView] = useState<"calendar" | "list">("calendar")
  const [courseNotes, setCourseNotes] = useState<Record<string, string>>({})
  const [currentNotesCourseId, setCurrentNotesCourseId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState<boolean>(false)
  const [isCourseDetailsModalOpen, setIsCourseDetailsModalOpen] = useState<boolean>(false)
  const [isNotesModalOpen, setIsNotesModalOpen] = useState<boolean>(false)
  const [currentCourseDetails, setCurrentCourseDetails] = useState<Course | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [isDataReady, setIsDataReady] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState("schedule")
  const { data: session } = useSession()
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [importStatus, setImportStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [importStatusMessage, setImportStatusMessage] = useState("")
  const { toast } = useToast()
  const [courseData, setCourseData] = useState<CourseData[]>([])
  const [calendarCourses, setCalendarCourses] = useState<SelectedCourse[]>([])
  const [academicCourses, setAcademicCourses] = useState<CourseData[]>([])
  const [latestRecommendations, setLatestRecommendations] = useState<RankedRecommendation[]>([])
  const [latestBlockedRecommendations, setLatestBlockedRecommendations] = useState<RankedRecommendation[]>([])
  const [isRecommendationPreviewOpen, setIsRecommendationPreviewOpen] = useState(false)
  const [pendingRecommendationWorkload, setPendingRecommendationWorkload] = useState<WorkloadLevel | null>(null)
  /** True when user chose "Add Recommended Courses" so we do not fall back to matrix/slots on dialog close. */
  const pyReasonRecommendationsAppliedRef = useRef(false)
  /** Mirrors pendingRecommendationWorkload so dismiss always reads the latest workload (avoids stale onOpenChange). */
  const pendingWorkloadRef = useRef<WorkloadLevel | null>(null)

  useEffect(() => {
    pendingWorkloadRef.current = pendingRecommendationWorkload
  }, [pendingRecommendationWorkload])

  const [degreeCourses, setDegreeCourses] = useState<BlockData[]>([])
  const [blocks, setBlocks] = useState<BlockData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({})
  const [expandedTerms, setExpandedTerms] = useState<Record<string, boolean>>({});
  const [isStudentDataHydrating, setIsStudentDataHydrating] = useState(false)
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false)
  const [csMajorKey, setCsMajorKey] = useState(DEFAULT_CS_MAJOR_KEY)
  const [csRequirementsReference, setCsRequirementsReference] = useState<{
    minimumCredits: number;
    generalEducation: string[];
    mathematics: string[];
    core: string[];
    standards: string[];
    roadmap: Record<string, string[]>;
  } | null>(null)
  const advisorAlerts = useMemo(() => evaluateCsGraduationReadiness(academicCourses), [academicCourses])
  const { sanitizeAdvisorAlert, formatGrade, hideSensitiveAcademic } = usePresentationPrivacy()

  const renderRecommendationCard = useCallback(
    (course: RankedRecommendation, tone: "recommended" | "blocked" = "recommended") => {
      const toneClasses =
        tone === "blocked"
          ? "rounded-md border border-amber-200 bg-amber-50 p-3"
          : "rounded-md border p-3"

      return (
        <div key={course.courseCode} className={toneClasses}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{course.courseCode}</p>
                {course.explanation.requirementCategoryLabel && (
                  <Badge variant="secondary">{course.explanation.requirementCategoryLabel}</Badge>
                )}
                {course.offeredThisTerm ? (
                  <Badge variant="outline">Offered now</Badge>
                ) : (
                  <Badge variant="outline">Not offered now</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{course.title}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline">Score {course.priorityScore}</Badge>
              {tone === "blocked" && <Badge variant="outline">Blocked</Badge>}
            </div>
          </div>

          <div className="mt-3 space-y-3 text-sm">
            {course.explanation.servesRequirementGroups.length > 0 && (
              <div>
                <p className="font-medium">Serves requirement groups</p>
                <p className="text-muted-foreground">
                  {course.explanation.servesRequirementGroups.join(", ")}
                </p>
              </div>
            )}

            {course.explanation.sourcePoolIds.length > 0 && (
              <div>
                <p className="font-medium">Candidate pool</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {course.explanation.sourcePoolIds.map((poolId) => (
                    <Badge key={`${course.courseCode}-${poolId}`} variant="outline">
                      {recommendationSourcePoolLabel(poolId)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {course.explanation.rankingHighlights.length > 0 && (
              <div>
                <p className="font-medium">Why it ranked here</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {course.explanation.rankingHighlights.map((reason) => (
                    <li key={`${course.courseCode}-${reason}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {course.explanation.blockingFactors.length > 0 && (
              <div>
                <p className="font-medium">Why it is blocked</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {course.explanation.blockingFactors.map((reason) => (
                    <li key={`${course.courseCode}-${reason}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )
    },
    []
  )

  const withStudentId = (path: string) => {
    const separator = path.includes("?") ? "&" : "?"
    return `${path}${separator}studentId=${encodeURIComponent(selectedStudentId)}`
  }

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        let effectiveCsMajorKey = DEFAULT_CS_MAJOR_KEY
        const csConfigResponse = await fetch("/data/cs_graduation_requirements.json")
        if (csConfigResponse.ok) {
          const csConfig = await csConfigResponse.json()
          if (csConfig?.majorKey) {
            setCsMajorKey(csConfig.majorKey)
            effectiveCsMajorKey = csConfig.majorKey
          }
          if (csConfig?.reference && csConfig?.recommendedPlan) {
            setCsRequirementsReference({
              ...csConfig.reference,
              roadmap: csConfig.recommendedPlan,
            })
          }
        }

        const requirementsData = await fetchRequirements()
        const csOnlyRequirements = requirementsData[effectiveCsMajorKey]
          ? { [effectiveCsMajorKey]: requirementsData[effectiveCsMajorKey] }
          : requirementsData

        setRequirements(csOnlyRequirements)
        console.log("Requirements loaded:", Object.keys(requirementsData).length, "majors");

        // Extract majors directly from the requirements
        const majorsList = Object.keys(csOnlyRequirements).map((majorName) => ({
          id: majorName,
          name: majorName,
        }));

        setMajors(majorsList)
        setIsDataReady(true)
        
        // Load courses right away
        try {
          const coursesData = await fetchCourses()
          setCourses(coursesData)
          console.log("Courses loaded:", coursesData.length);
          showNotification("Course data loaded successfully", "success")
        } catch (error) {
          console.error("Failed to load courses:", error)
          showNotification("Failed to load courses. Please try again.", "error")
        }
      } catch (error) {
        console.error("Failed to initialize app:", error)
        showNotification("Failed to load majors. Please refresh the page.", "error")
      } finally {
        setIsLoading(false);
      }
    }

    initializeApp()
  }, [])

  const planOptions = useMemo(() => {
    const m = requirements[selectedMajor]
    if (!m) return [] as { value: string; label: string }[]
    return orderedRequirementKeys(m).map((value) => ({
      value,
      label: PLAN_SEMESTER_OPTIONS.find((o) => o.value === value)?.label ?? value,
    }))
  }, [requirements, selectedMajor])

  // CS-only app: major from requirements; planner term from localStorage, then student record, then default.
  useEffect(() => {
    if (!isDataReady || Object.keys(requirements).length === 0) return
    const majorKey =
      requirements[csMajorKey] != null ? csMajorKey : Object.keys(requirements)[0]
    if (majorKey) setSelectedMajor(majorKey)

    const keys = orderedRequirementKeys(requirements[majorKey])
    const defaultTerm = keys[0] ?? "y1f"

    let stored: string | null = null
    try {
      stored = localStorage.getItem(plannerYearStorageKey(selectedStudentId))
    } catch {
      stored = null
    }
    const resolved = normalizePlannerTerm(stored, studentAcademicYear)
    const year = keys.includes(resolved) ? resolved : defaultTerm
    setSelectedYear(year)
  }, [isDataReady, requirements, studentAcademicYear, csMajorKey, selectedStudentId])

  const handlePlannerTermChange = (term: string) => {
    setSelectedYear(term)
    try {
      localStorage.setItem(plannerYearStorageKey(selectedStudentId), term)
    } catch {
      /* ignore quota / private mode */
    }
  }

  // Manual load/save to database (called by buttons when logged in)
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(false)
  const [isSavingToDb, setIsSavingToDb] = useState(false)

  const loadSavedCoursesFromDb = async () => {
    if (!session?.user) {
      showNotification("Please log in to load from database", "error")
      return
    }
    setIsLoadingFromDb(true)
    try {
      const response = await fetch(withStudentId('/api/courses'))
      if (response.ok) {
        const savedCourses = await response.json()
        if (savedCourses && savedCourses.length > 0) {
          const formattedCourses = savedCourses.map((course: any) => ({
            id: course.id,
            Class: course.courseClass,
            Section: course.section,
            Instructor: course.instructor,
            DaysTimes: course.daysTimes,
            Room: course.room
          }))
          setSelectedCourses(formattedCourses)
          const convertedCourses: CourseData[] = formattedCourses.map((course: SelectedCourse) => ({
            course: course.Class,
            title: course.Class,
            grade: course.grade || "IP",
            credits: course.credits || "0",
            term: "Fall 2024",
            catalogGroup: course.requirementGroup || "General",
            requirementGroup: course.requirementGroup || null,
            status: "In Progress"
          }))
          setCourseData(convertedCourses)
          formattedCourses.forEach((course: SelectedCourse) => {
            if (course.requirementGroup && requirementGroups[course.requirementGroup]) {
              if (course.grade !== "WD" && Number.parseFloat(course.credits || "0") > 0) {
                requirementGroups[course.requirementGroup].completed += Number.parseFloat(course.credits || "0")
              }
            }
          })
          showNotification("Loaded your saved courses from database", "success")
        } else {
          setSelectedCourses([])
          setCourseData([])
          showNotification("No saved courses in database", "default")
        }
      } else {
        showNotification("Failed to load courses", "error")
      }
    } catch (error) {
      console.error("Failed to load saved courses:", error)
      showNotification("Failed to load your saved courses", "error")
    } finally {
      setIsLoadingFromDb(false)
    }
  }

  const saveCoursesToDb = async () => {
    if (!session?.user) {
      showNotification("Please log in to save to database", "error")
      return
    }
    if (selectedCourses.length === 0) {
      showNotification("No courses to save", "default")
      return
    }
    setIsSavingToDb(true)
    try {
      const response = await fetch(withStudentId('/api/courses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedCourses)
      })
      if (!response.ok) throw new Error('Failed to save courses')
      showNotification("Courses saved to database", "success")
    } catch (error) {
      console.error("Failed to save courses:", error)
      showNotification("Failed to save your course selection", "error")
    } finally {
      setIsSavingToDb(false)
    }
  }

  // Only generate schedule after major and year selection
  useEffect(() => {
    if (selectedMajor && selectedYear && courses.length > 0) {
      // Automatically generate a schedule when selection changes
      // generateBestSchedule() // Uncomment this if you want auto-generation
    }
  }, [selectedMajor, selectedYear, courses.length])

  const loadCourses = async () => {
    setIsLoading(true)
    try {
      const coursesData = await fetchCourses()
      setCourses(coursesData)
      console.log("Loaded courses:", coursesData.length);
      showNotification("Course data loaded successfully", "success")
    } catch (error) {
      console.error("Failed to load courses:", error)
      showNotification("Failed to load courses. Please try again.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const estimateCourseCredits = (courseCode: string, section?: Course) =>
    estimateSectionCredits(courseCode, section)

  /** PyReason passes explicit codes; CS BS with no codes uses the fixed workload matrix; else degree JSON slots + fillers. */
  const buildScheduleFromCourseCodes = (courseCodes: string[], workload: WorkloadLevel) => {
    if (!selectedMajor || !selectedYear || Object.keys(requirements).length === 0) {
      showNotification("Please confirm selection or wait for data to load.", "error");
      return;
    }

    if (courses.length === 0) {
      showNotification("No courses available. Please try refreshing the page.", "error");
      console.error("Courses array is empty when generating schedule");
      return;
    }

    const majorRequirements = requirements[selectedMajor];
    if (!majorRequirements) {
      showNotification(`No requirements found for major: ${selectedMajor}`, "error");
      return;
    }

    const useCsWorkloadMatrix = usesCsWorkloadMatrix(selectedMajor, selectedYear);
    let termRequirements: string[] | undefined;

    const explicitCodes = Array.isArray(courseCodes)
      ? Array.from(
          new Set(courseCodes.map((code) => normalizeRecommendationCourseCode(code)).filter(Boolean))
        )
      : [];

    if (!useCsWorkloadMatrix) {
      termRequirements = majorRequirements[selectedYear];
      if (explicitCodes.length === 0) {
        if (!termRequirements || termRequirements.length === 0) {
          showNotification(`No suggested courses listed for ${selectedMajor} — ${selectedYear}.`, "warning");
          return;
        }
      }
    }

    setSelectedCourses([]);

    let slots = useCsWorkloadMatrix
      ? []
      : requirementStringsToSlots(termRequirements!);
    if (!useCsWorkloadMatrix) {
      const postponedLow =
        workload === "low" && slots.length > 1 ? applyLowWorkloadPostpone(slots) : null;
      if (postponedLow) slots = postponedLow;
    }

    const sparse = useCsWorkloadMatrix ? false : isSparseSemesterBucket(selectedYear, slots);
    const workloadTarget = workloadTargetCredits(workload);
    const targetCredits = WORKLOAD_TARGETS[workload];

    let coursesAddedCount = 0;
    let totalScheduledCredits = 0;
    const newSelectedCourses: SelectedCourse[] = [];
    const notFoundCourses: string[] = [];
    const skippedForCreditLimit: string[] = [];
    const skippedForSingleDayLecture: string[] = [];
    const collisionNotes: string[] = [];

    const normClass = (c?: string) =>
      String(c || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ");

    const shouldSkipSingleDaySection = (courseCode: string, section: Course): boolean => {
      const normalizedCode = normClass(courseCode);
      if (normalizedCode === "FYS 101") return false;
      if (String(section.Section || "").toUpperCase().includes("LAB")) return false;
      const parsed = parseDaysTimes(String(section.DaysTimes || ""));
      if (!parsed) return false;
      return parsed.days.length <= 1;
    };

    const tryAddCode = (rawCode: string, allowDuplicateClass = false): boolean => {
      const normalizedCode = rawCode.trim();
      const codeWithoutSpace = normalizedCode.replace(/\s+/g, "");
      if (!normalizedCode) return false;

      if (
        !allowDuplicateClass &&
        newSelectedCourses.some((s) => normClass(s.Class) === normClass(normalizedCode))
      ) {
        return true;
      }

      const allMatchingSections = courses
        .filter((c) => {
          if (!c.Class) return false;
          const courseClass = c.Class.trim();
          const courseClassNoSpace = courseClass.replace(/\s+/g, "");
          return (
            courseClass.toLowerCase() === normalizedCode.toLowerCase() ||
            courseClassNoSpace.toLowerCase() === codeWithoutSpace.toLowerCase() ||
            courseClass.toLowerCase().includes(normalizedCode.toLowerCase())
          );
        })
        .filter(
          (c) => !newSelectedCourses.some((s) => s.Class === c.Class && s.Section === c.Section)
        );
      const possibleSections = allMatchingSections.filter(
        (section) => !shouldSkipSingleDaySection(normalizedCode, section)
      );

      const pushSection = (section: Course): boolean => {
        const estimatedCredits = estimateCourseCredits(normalizedCode, section);
        if (totalScheduledCredits + estimatedCredits > MAX_SEMESTER_CREDITS) return false;
        if (hasConflict(section, newSelectedCourses)) return false;
        newSelectedCourses.push({
          ...section,
          id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          credits: estimatedCredits.toString(),
        });
        coursesAddedCount++;
        totalScheduledCredits += estimatedCredits;
        return true;
      };

      if (possibleSections.length === 0) {
        if (allMatchingSections.length > 0) {
          skippedForSingleDayLecture.push(normalizedCode);
          return false;
        }

        const lenientSections = courses.filter(
          (c) =>
            c.Class &&
            c.Class.replace(/\s+/g, "").toLowerCase().includes(codeWithoutSpace.toLowerCase())
        );
        const lenientEligible = lenientSections.filter(
          (section) => !shouldSkipSingleDaySection(normalizedCode, section)
        );
        if (lenientSections.length > 0 && lenientEligible.length === 0) {
          skippedForSingleDayLecture.push(normalizedCode);
          return false;
        }
        for (const section of lenientEligible) {
          if (pushSection(section)) return true;
        }
        notFoundCourses.push(normalizedCode);
        return false;
      }

      let placed = false;
      for (const section of possibleSections) {
        if (pushSection(section)) {
          placed = true;
          break;
        }
      }

      if (!placed) {
        const couldFit = possibleSections.some(
          (section) =>
            totalScheduledCredits + estimateCourseCredits(normalizedCode, section) <= MAX_SEMESTER_CREDITS
        );
        if (!couldFit) {
          skippedForCreditLimit.push(normalizedCode);
        } else {
          const first = possibleSections[0];
          const blocker = findFirstBlockingCourse(first, newSelectedCourses);
          if (useCsWorkloadMatrix) {
            collisionNotes.push(
              `${normalizedCode}: all open sections clash${
                blocker
                  ? ` (e.g. with ${blocker.Class} ${blocker.Section} — ${blocker.DaysTimes || "see calendar"})`
                  : ""
              }`
            );
          } else {
            showNotification(`Could not add "${normalizedCode}": All sections conflict.`, "warning");
          }
        }
      }

      return placed;
    };

    if (explicitCodes.length > 0) {
      for (let i = 0; i < explicitCodes.length; i++) {
        if (totalScheduledCredits >= targetCredits) break;
        const code = explicitCodes[i];
        if (!code) continue;
        tryAddCode(code, false);
      }
    } else if (useCsWorkloadMatrix) {
      const entries = buildCsWorkloadSuggestionList(selectedYear, workload);
      if (!entries.length) {
        showNotification("No suggested course list for this term and workload.", "error");
        return;
      }
      for (const { code, allowDuplicateClass } of entries) {
        if (totalScheduledCredits >= MAX_SEMESTER_CREDITS) break;
        tryAddCode(code, Boolean(allowDuplicateClass));
      }
    } else {
      for (const slot of slots) {
        if (totalScheduledCredits >= MAX_SEMESTER_CREDITS) break;

        if (slot.alternatives.length > 0) {
          let placed = false;
          for (const alt of slot.alternatives) {
            if (tryAddCode(alt)) {
              placed = true;
              break;
            }
          }
          if (!placed) {
            /* tryAddCode recorded not-found / conflict */
          }
        } else if (slot.source.trim()) {
          tryAddCode(slot.source);
        }
      }

      if (workload !== "low") {
        const fillerCap = workload === "high" ? 18 : 15;
        const needFiller =
          workload === "high"
            ? totalScheduledCredits < fillerCap
            : sparse
              ? totalScheduledCredits < fillerCap
              : totalScheduledCredits < MIN_SEMESTER_CREDITS;

        if (needFiller) {
          const queue = buildFillerCourseQueue(courses).filter(
            (code) => !newSelectedCourses.some((s) => normClass(s.Class) === normClass(code))
          );
          for (const code of queue) {
            if (totalScheduledCredits >= fillerCap) break;
            if (totalScheduledCredits >= MAX_SEMESTER_CREDITS) break;
            tryAddCode(code);
          }
        }
      }
    }

    setSelectedCourses([...newSelectedCourses]);

    if (useCsWorkloadMatrix) {
      const overlaps = findScheduleConflicts(newSelectedCourses);
      if (overlaps.length > 0) {
        const detail = overlaps
          .slice(0, 5)
          .map(
            (c) =>
              `${c.courseA.Class} ${c.courseA.Section} vs ${c.courseB.Class} ${c.courseB.Section} (${c.overlapLabel})`
          )
          .join(" · ");
        showNotification(
          `Schedule collisions (overlapping meeting times): ${detail}${overlaps.length > 5 ? " …" : ""}`,
          "warning"
        );
      }
      if (collisionNotes.length > 0) {
        showNotification(
          `Could not place some sections: ${collisionNotes.slice(0, 3).join(" · ")}${
            collisionNotes.length > 3 ? " …" : ""
          }`,
          "warning"
        );
      }
    }

    if (
      !useCsWorkloadMatrix &&
      explicitCodes.length === 0 &&
      workload === "low" &&
      termRequirements &&
      termRequirements.length > 1
    ) {
      showNotification(
        "Low workload: one planned course was left for a later term (see graduation path).",
        "default"
      );
    }

    if (notFoundCourses.length > 0) {
      const message =
        notFoundCourses.length === 1
          ? `Could not find course: ${notFoundCourses[0]}`
          : `Could not find ${notFoundCourses.length} courses: ${notFoundCourses.slice(0, 3).join(", ")}${notFoundCourses.length > 3 ? "…" : ""}`;
      showNotification(message, "warning");
    }

    if (skippedForCreditLimit.length > 0) {
      showNotification(
        `Stopped at ${totalScheduledCredits} credits to stay within the ${MAX_SEMESTER_CREDITS}-credit maximum.`,
        "default"
      );
    }

    if (skippedForSingleDayLecture.length > 0) {
      const uniq = Array.from(new Set(skippedForSingleDayLecture));
      showNotification(
        `Skipped one-day sections for: ${uniq.slice(0, 3).join(", ")}${uniq.length > 3 ? "…" : ""} (labs and FYS 101 are exempt).`,
        "default"
      );
    }

    if (coursesAddedCount > 0) {
      const workloadLabel = workload.charAt(0).toUpperCase() + workload.slice(1);
      // CS workload matrix (no PyReason list): correct catalog credits can yield 11 cr (e.g. y1f low).
      const minCreditsThisRun =
        useCsWorkloadMatrix && explicitCodes.length === 0 ? 11 : MIN_SEMESTER_CREDITS;
      if (totalScheduledCredits < minCreditsThisRun) {
        showNotification(
          `${workloadLabel} workload: ${totalScheduledCredits} credits (below ${minCreditsThisRun} min) — catalog gaps or conflicts.`,
          "warning"
        );
      } else {
        showNotification(
          `${workloadLabel} workload: ${coursesAddedCount} course(s), ${totalScheduledCredits} credits (target ~${workloadTarget}).`,
          "success"
        );
      }
    } else if (notFoundCourses.length === 0) {
      showNotification("No courses could be added to your schedule.", "error");
    }
  };

  // Suggested courses depend on imported academic history. PyReason reasons
  // over completed/in-progress classes plus saved degree requirements and then
  // hands the ordered results to the existing schedule builder above.
  const applyRecommendedCoursesToSchedule = () => {
    if (!pendingRecommendationWorkload || latestRecommendations.length === 0) {
      setIsRecommendationPreviewOpen(false)
      return
    }

    pyReasonRecommendationsAppliedRef.current = true
    buildScheduleFromCourseCodes(
      latestRecommendations.map((course) => course.courseCode),
      pendingRecommendationWorkload
    )
    setIsRecommendationPreviewOpen(false)
    setPendingRecommendationWorkload(null)
  }

  /**
   * Dismiss PyReason preview. If the user did not apply recommendations, fill the schedule from the
   * CS workload matrix (or degree-term slots). Uses a ref for workload because Radix often does not
   * invoke onOpenChange when the parent sets open=false programmatically (e.g. "Not now").
   */
  const closeRecommendationPreviewAndMaybeApplyMatrix = () => {
    const w = pendingWorkloadRef.current
    pendingWorkloadRef.current = null
    const appliedPyReason = pyReasonRecommendationsAppliedRef.current
    pyReasonRecommendationsAppliedRef.current = false
    setPendingRecommendationWorkload(null)
    setIsRecommendationPreviewOpen(false)
    if (w != null && !appliedPyReason) {
      buildScheduleFromCourseCodes([], w)
    }
  }

  const generateBestSchedule = async (workload: WorkloadLevel) => {
    if (!selectedMajor || !selectedYear || Object.keys(requirements).length === 0) {
      showNotification("Please confirm selection or wait for data to load.", "error")
      return
    }

    if (academicCourses.length === 0) {
      setActiveTab("academic")
      showNotification(
        "Import this student's classes from MySlice before generating suggested courses.",
        "warning"
      )
      return
    }

    if (courses.length === 0) {
      showNotification("No courses available. Please try refreshing the page.", "error")
      return
    }

    const majorRequirements = requirements[selectedMajor]
    if (!majorRequirements) {
      showNotification(`No requirements found for major: ${selectedMajor}`, "error")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: selectedStudentId,
          selectedMajor,
          selectedYear,
          term: "Current Catalog",
          requirementsForMajor: majorRequirements,
          catalogCourses: courses,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Failed to generate recommendations")
      }

      const recommendedCourses = Array.isArray(data.recommendedCourses)
        ? dedupeRecommendedCourses(data.recommendedCourses as RankedRecommendation[])
        : []
      const blockedCourses = Array.isArray(data.blockedCourses)
        ? dedupeRecommendedCourses(data.blockedCourses as RankedRecommendation[])
        : []

      setLatestRecommendations(recommendedCourses)
      setLatestBlockedRecommendations(blockedCourses)
      setPendingRecommendationWorkload(workload)

      if (recommendedCourses.length === 0 && blockedCourses.length === 0) {
        showNotification(
          "No course suggestions were generated. This student may be near completion or missing codified remaining requirements.",
          "warning"
        )
        return
      }

      if (recommendedCourses.length === 0) {
        showNotification(
          "No eligible suggested courses were found. Review blocked courses and degree requirements.",
          "warning"
        )
        return
      }

      setIsRecommendationPreviewOpen(true)
    } catch (error) {
      console.error("Failed to generate recommendations:", error)
      showNotification((error as Error).message || "Failed to generate recommendations", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle courses imported from image
  const handleImportFromImage = (importedCourses: SelectedCourse[]) => {
    if (importedCourses.length === 0) {
      showNotification("No courses were found in the image.", "warning")
      return
    }

    // Check for conflicts with existing courses
    const coursesToAdd: SelectedCourse[] = []
    const conflictingCourses: SelectedCourse[] = []

    importedCourses.forEach((course) => {
      if (hasConflict(course, selectedCourses)) {
        conflictingCourses.push(course)
      } else {
        coursesToAdd.push(course)
      }
    })

    // Add non-conflicting courses
    if (coursesToAdd.length > 0) {
      setSelectedCourses((prev) => [...prev, ...coursesToAdd])
      showNotification(`Added ${coursesToAdd.length} courses from image.`, "success")
    }

    // Notify about conflicts
    if (conflictingCourses.length > 0) {
      showNotification(`${conflictingCourses.length} course(s) had time conflicts and were not added.`, "warning")
    }
  }

  // Reset schedule
  const resetSchedule = () => {
    setSelectedCourses([])
    showNotification("Schedule cleared.", "default")
  }

  // Toggle search popup
  const toggleSearchPopup = () => {
    setIsSearchPopupOpen(!isSearchPopupOpen)
    if (!isSearchPopupOpen) {
      setCurrentSearchResults([])
    }
  }

  const handleCriteriaPreview = useCallback(
    (criteria: CourseSearchCriteria) => {
      const query = buildSearchQueryFromCriteria(criteria)
      if (!query.trim()) {
        setCurrentSearchResults([])
        return
      }
      setCurrentSearchResults(filterCoursesByCriteria(courses, criteria))
    },
    [courses]
  )

  // Search courses (explicit submit — shows toast)
  const searchCourses = (criteria: CourseSearchCriteria) => {
    const query = buildSearchQueryFromCriteria(criteria)

    if (!query.trim()) {
      setCurrentSearchResults([])
      return
    }

    const results = filterCoursesByCriteria(courses, criteria)
    setCurrentSearchResults(results)

    if (results.length === 0) {
      showNotification(`No courses found matching "${query}"`, "warning")
    } else {
      showNotification(`Found ${results.length} courses matching "${query}"`, "success")
    }
  }

  // Add course from search
  const addCourseFromSearch = (course: Course) => {
    if (!course.Class || !course.Section) {
      showNotification("Invalid course data", "error")
      return
    }

    // Check for duplicates
    const isDuplicate = selectedCourses.some(
      (c) => c.Class === course.Class && c.Section === course.Section
    )

    if (isDuplicate) {
      showNotification("This course is already in your schedule", "warning")
      return
    }

    // Check for time conflicts
    if (hasConflict(course, selectedCourses)) {
      showNotification("This course conflicts with your schedule", "error")
      return
    }

    const newCourse: SelectedCourse = {
      ...course,
      id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }

    setSelectedCourses((prev) => [...prev, newCourse])
    showNotification(`Added ${course.Class} to your schedule`, "success")
    setIsSearchPopupOpen(false)
  }

  // Remove course
  const removeCourse = (courseId: string) => {
    setSelectedCourses((prev) => prev.filter((c) => c.id !== courseId))
    showNotification("Course removed from schedule", "success")
  }

  const swapCourse = (oldCourseId: string, newCourse: Course) => {
    setSelectedCourses((prev) =>
      prev.map((course) =>
        course.id === oldCourseId
          ? {
              ...newCourse,
              id: oldCourseId,
            }
          : course
      )
    )
    showNotification(`Swapped into ${newCourse.Class}`, "success")
  }

  // Show course details
  const showCourseDetails = (course: Course) => {
    setCurrentCourseDetails(course)
    setIsCourseDetailsModalOpen(true)
  }

  // Open notes modal
  const openNotesModal = (courseId: string) => {
    setCurrentNotesCourseId(courseId)
    setIsNotesModalOpen(true)
  }

  // Save notes
  const saveNotes = (notes: string) => {
    if (currentNotesCourseId) {
      if (notes.trim()) {
        setCourseNotes({
          ...courseNotes,
          [currentNotesCourseId]: notes,
        })
        showNotification("Notes saved successfully", "success")
      } else {
        // Remove notes if empty
        const newNotes = { ...courseNotes }
        delete newNotes[currentNotesCourseId]
        setCourseNotes(newNotes)
      }
    }
    setIsNotesModalOpen(false)
    setCurrentNotesCourseId(null)
  }

  // Toggle view between calendar and list
  const toggleView = () => {
    setCurrentView(currentView === "calendar" ? "list" : "calendar")
  }

  // Show notification
  const showNotification = (
    message: string,
    type: "success" | "warning" | "error" | "default" = "default",
    duration = 3000,
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    
    // Format message - make first letter uppercase if not already
    const formattedMessage = message.charAt(0).toUpperCase() + message.slice(1);
    
    const newNotification: Notification = {
      id,
      message: formattedMessage,
      type,
    }

    // Keep only the 2 most recent notifications to reduce clutter
    setNotifications((prev) => {
      const updatedNotifications = [...prev, newNotification];
      return updatedNotifications.slice(-2);
    })

    // Auto-remove notification after duration
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, duration)
  }

  // Remove notification
  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const applyAssistantSchedule = useCallback(
    (suggestion: SelectedCourse[]) => {
      const norm = (c?: string) =>
        String(c || "")
          .trim()
          .replace(/\s+/g, " ")
          .toUpperCase()
      const suggestedClasses = new Set(suggestion.map((s) => norm(s.Class)))
      setSelectedCourses((prev) => {
        const kept = prev.filter((p) => !suggestedClasses.has(norm(p.Class)))
        const next: SelectedCourse[] = [...kept]
        const skipped: string[] = []
        for (const c of suggestion) {
          const asCourse: Course = { ...c }
          if (hasConflict(asCourse, next)) {
            skipped.push(`${c.Class} ${c.Section || ""}`.trim())
            continue
          }
          next.push(c)
        }
        if (skipped.length > 0) {
          toast({
            title: "Some sections not added",
            description: `Time conflict with your current schedule: ${skipped.join(", ")}`,
            variant: "destructive",
          })
        }
        return next
      })
      showNotification(
        "Assistant sections added; existing sections for those course codes were replaced.",
        "success",
      )
    },
    [toast],
  )

  // Mock data for testing
  const getMockStatusData = () => {
    return {
      status: "completed",
      log: "Starting import...\nProcessing data...\nImport completed successfully",
      result: [
        {
          id: "1",
          code: "CIS 275",
          name: "Systems Analysis and Design",
          term: "Fall 2024",
          grade: "A",
          credits: "3",
          requirementGroup: "CIS Core",
          course: "CIS 275",
          title: "Systems Analysis and Design",
          catalogGroup: "AC10BS",
          isRecommended: false,
          isFuture: false
        },
        {
          id: "2",
          code: "CIS 375",
          name: "Introduction to Computer Security",
          term: "Fall 2024",
          grade: "B+",
          credits: "3",
          requirementGroup: "Upper Division CIS",
          course: "CIS 375",
          title: "Introduction to Computer Security",
          catalogGroup: "AC10BS",
          isRecommended: false,
          isFuture: false
        },
        {
          id: "3",
          code: "CIS 400",
          name: "Senior Design Project I",
          term: "Fall 2024",
          grade: "IP",
          credits: "3",
          requirementGroup: "Upper Division CIS",
          course: "CIS 400",
          title: "Senior Design Project I",
          catalogGroup: "AC10BS",
          isRecommended: false,
          isFuture: false
        }
      ]
    }
  }

  // Load saved calendar courses
  const loadSavedCalendarCourses = async () => {
    if (session?.user) {
      try {
        const response = await fetch(withStudentId('/api/courses'))
        if (response.ok) {
          const savedCourses = await response.json()
          if (savedCourses && savedCourses.length > 0) {
            const formattedCourses = savedCourses.map((course: any) => ({
              id: course.id,
              Class: course.courseClass,
              Section: course.section,
              Instructor: course.instructor,
              DaysTimes: course.daysTimes,
              Room: course.room
            }))
            setCalendarCourses(formattedCourses)
            setSelectedCourses(formattedCourses)
            showNotification("Loaded your saved calendar courses", "success")
          } else {
            setCalendarCourses([])
            setSelectedCourses([])
          }
        }
      } catch (error) {
        console.error("Failed to load saved calendar courses:", error)
        showNotification("Failed to load your saved calendar courses", "error")
        setCalendarCourses([])
      }
    } else {
      setCalendarCourses([])
      setSelectedCourses([])
    }
  }

  // Load saved academic courses
  const loadSavedAcademicCourses = async () => {
    if (session?.user) {
      try {
        const response = await fetch(withStudentId('/api/courses/academic'))
        if (response.ok) {
          const savedCourses = await response.json()
          if (savedCourses && savedCourses.length > 0) {
            const formattedCourses = savedCourses.map((course: any) => ({
              id: course.id,
              code: course.code,
              name: course.name,
              term: course.term,
              grade: course.grade,
              credits: course.credits,
              requirementGroup: course.requirementGroup,
              course: course.course,
              title: course.title,
              catalogGroup: course.catalogGroup,
              isRecommended: course.isRecommended,
              isFuture: course.isFuture
            }))
            setAcademicCourses(dedupeAcademicCourseRows(formattedCourses))
            showNotification("Loaded your saved academic courses", "success")
          } else {
            setAcademicCourses([])
          }
        }
      } catch (error) {
        console.error("Failed to load saved academic courses:", error)
        showNotification("Failed to load your saved academic courses", "error")
        setAcademicCourses([])
      }
    } else {
      setAcademicCourses([])
    }
  }

  // Save calendar courses
  const saveCalendarCourses = async () => {
    if (session?.user && selectedCourses.length > 0) {
      try {
        const response = await fetch(withStudentId('/api/courses'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(selectedCourses)
        })
        
        if (!response.ok) {
          throw new Error('Failed to save calendar courses')
        }
      } catch (error) {
        console.error("Failed to save calendar courses:", error)
        showNotification("Failed to save your calendar courses", "error")
      }
    }
  }

  // Save academic courses
  const saveAcademicCourses = async () => {
    if (session?.user && academicCourses.length > 0) {
      try {
        // Ensure all required fields are present
        const coursesToSave = academicCourses.map(course => ({
          code: course.code,
          name: course.name || course.title,
          term: course.term,
          grade: course.grade,
          credits: course.credits,
          requirementGroup: course.requirementGroup || 'General',
          title: course.title,
          catalogGroup: course.catalogGroup,
          isRecommended: course.isRecommended || false,
          isFuture: course.isFuture || false
        }));

        const response = await fetch(withStudentId('/api/courses/academic'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(coursesToSave)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("Failed to save academic courses:", errorData);
          throw new Error(errorData.message || 'Failed to save academic courses');
        }

        showNotification("Academic courses saved successfully", "success");
      } catch (error) {
        console.error("Failed to save academic courses:", error);
        showNotification("Failed to save your academic courses", "error");
      }
    }
  };

  // Load saved degree requirements
  const loadSavedDegreeRequirements = async () => {
    if (session?.user) {
      try {
        const response = await fetch(withStudentId('/api/courses/degree-requirements'))
        if (response.ok) {
          const savedData = await response.json()
          if (savedData && savedData.length > 0) {
            setDegreeCourses(savedData)
            showNotification("Loaded your saved degree requirements", "success")
          } else {
            setDegreeCourses([])
          }
        }
      } catch (error) {
        console.error("Failed to load saved degree requirements:", error)
        showNotification("Failed to load your saved degree requirements", "error")
        setDegreeCourses([])
      }
    } else {
      setDegreeCourses([])
    }
  }

  // Save degree requirements
  const saveDegreeRequirements = async () => {
    if (!session) {
      console.log("Session not ready yet");
      return;
    }

    if (session?.user && degreeCourses.length > 0) {
      try {
        const response = await fetch(withStudentId('/api/courses/degree-requirements'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(degreeCourses)
        })
        
        if (!response.ok) {
          throw new Error('Failed to save degree requirements')
        }
      } catch (error) {
        console.error("Failed to save degree requirements:", error)
        showNotification("Failed to save your degree requirements", "error")
      }
    }
  }

  // Load both types of courses when component mounts
  useEffect(() => {
    let isActive = true

    const hydrateStudentData = async () => {
      setIsStudentDataHydrating(true)
      setSelectedCourses([])
      setCalendarCourses([])
      setAcademicCourses([])
      setDegreeCourses([])

      try {
        await Promise.all([
          loadSavedCalendarCourses(),
          loadSavedAcademicCourses(),
          loadSavedDegreeRequirements(),
        ])
      } finally {
        if (isActive) {
          setIsStudentDataHydrating(false)
        }
      }
    }

    hydrateStudentData()

    return () => {
      isActive = false
    }
  }, [selectedStudentId, session])

  // Save both types of courses when they change
  useEffect(() => {
    if (isStudentDataHydrating) return
    saveCalendarCourses()
  }, [isStudentDataHydrating, selectedCourses, selectedStudentId, session])

  useEffect(() => {
    if (isStudentDataHydrating) return
    saveAcademicCourses()
  }, [academicCourses, isStudentDataHydrating, selectedStudentId, session])

  useEffect(() => {
    if (isStudentDataHydrating) return
    saveDegreeRequirements()
  }, [degreeCourses, isStudentDataHydrating, selectedStudentId, session])

  const getFriendlyImportError = (message: string) => {
    if (/Failed to fetch/i.test(message)) {
      return "Could not reach the import service. Start backend API on port 3001, or retry to use the built-in /api fallback."
    }
    if (/not authorized to access this component|security authorization|40\s*,\s*20/i.test(message)) {
      return "MySlice logged in, but that account is not authorized to open the Course History component directly. In the same browser window, open Academics or Student Records → Course History in View/Display mode, then retry the import."
    }
    return message || "Import failed. Review the log below for details."
  }

  const persistImportedAcademicCourses = async (coursesToPersist: CourseData[]) => {
    const response = await fetch(withStudentId('/api/courses/academic'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(coursesToPersist),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to save imported academic courses')
    }

    return response.json().catch(() => null)
  }

  const persistImportedDegreeRequirements = async (blocksToPersist: BlockData[]) => {
    const response = await fetch(withStudentId('/api/courses/degree-requirements'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blocksToPersist),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to save imported degree requirements')
    }

    return response.json().catch(() => null)
  }

  const handleImport = async () => {
    setIsLoading(true)
    setImportLogs([])
    setImportStatus("running")
    setImportStatusMessage("A browser window will open for MySlice. Sign in there and keep this page open while import runs.")
    try {
      let response: Response
      let statusBaseUrl = "http://localhost:3001"
      try {
        // Prefer standalone backend API
        response = await fetch("http://localhost:3001/api/scrape-academic-record", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ manualLogin: true }),
        })
      } catch (_primaryErr) {
        // Fallback to Next.js API route if :3001 is not running
        response = await fetch("/api/scrape-academic-record", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ manualLogin: true }),
        })
        statusBaseUrl = ""
      }

      if (!response.ok) {
        let serverMessage = ""
        try {
          const errBody = await response.json()
          serverMessage = errBody?.error || errBody?.message || ""
        } catch (_e) {
          // ignore parse errors
        }
        throw new Error(serverMessage || "Failed to start import process")
      }

      const startData = await response.json()

      // Next.js fallback route can return direct results (no async job id).
      if (!startData?.jobId) {
        const importedCourses = dedupeAcademicCourseRows(
          Array.isArray(startData?.courses) ? startData.courses : []
        )
        const importedBlocks = Array.isArray(startData?.blocks) ? startData.blocks : []

        if (importedCourses.length === 0) {
          throw new Error("Import completed, but MySlice returned no courses. Your previously saved student data was left unchanged.")
        }

        await persistImportedAcademicCourses(importedCourses)
        setAcademicCourses(importedCourses)
        if (importedBlocks.length > 0) {
          await persistImportedDegreeRequirements(importedBlocks)
          setDegreeCourses(importedBlocks)
        }

        setImportStatus("success")
        setImportStatusMessage(`Import successful. ${importedCourses.length} course(s) were imported from MySlice.`)
        showNotification("Successfully imported courses from MySlice", "success")
        setIsLoading(false)
        return
      }

      const { jobId } = startData
      
      // Poll for job status
      const checkStatus = async () => {
        try {
          const statusResponse = await fetch(`${statusBaseUrl}/api/scrape-status/${jobId}`)
          const statusData = await statusResponse.json()

          // Update logs with the detailed log message from the backend
          if (statusData.log) {
            const logLines = statusData.log.split('\n').filter((line: string) => line.trim())
            setImportLogs(logLines)
          }

          if (statusData.status === "completed") {
            const importedCourses = dedupeAcademicCourseRows(
              Array.isArray(statusData.result?.courses) ? statusData.result.courses : []
            )
            const importedBlocks = Array.isArray(statusData.result?.blocks) ? statusData.result.blocks : []

            if (importedCourses.length === 0) {
              throw new Error("Import completed, but MySlice returned no courses. Your previously saved student data was left unchanged.")
            }

            setImportStatus("running")
            setImportStatusMessage("MySlice import completed. Saving imported courses to this student's record...")

            await persistImportedAcademicCourses(importedCourses)
            setAcademicCourses(importedCourses)

            if (importedBlocks.length > 0) {
              await persistImportedDegreeRequirements(importedBlocks)
              setDegreeCourses(importedBlocks)
            }

            const importedCourseCount = importedCourses.length
            setImportStatus("success")
            setImportStatusMessage(`Import successful. ${importedCourseCount} course(s) were imported from MySlice.`)
            showNotification("Successfully imported courses from MySlice", "success")
            setIsLoading(false)
          } else if (statusData.status === "failed") {
            setIsLoading(false)
            setImportStatus("error")
            setImportStatusMessage(statusData.message || "Import failed. Review the log below for details.")
            throw new Error(statusData.message || "Import failed")
          } else {
            // Job is still running, check again in 2 seconds
            setImportStatus("running")
            setImportStatusMessage("Import in progress. Waiting for MySlice to finish responding.")
            setTimeout(checkStatus, 2000)
          }
        } catch (statusError) {
          console.error("Import status/save failed:", statusError)
          const friendly = getFriendlyImportError((statusError as Error).message || "")
          setImportStatus("error")
          setImportStatusMessage(friendly)
          showNotification(friendly || "Failed to import courses", "error")
          setIsLoading(false)
        }
      }

      // Start polling
      checkStatus()
    } catch (error) {
      console.error("Failed to import courses:", error)
      const friendly = getFriendlyImportError((error as Error).message || "")
      setImportStatus("error")
      setImportStatusMessage(friendly)
      showNotification(friendly || "Failed to import courses", "error")
      setIsLoading(false)
    }
  }

  const toggleTerm = (term: string) => {
    setExpandedTerms(prev => ({
      ...prev,
      [term]: !prev[term]
    }));
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
      case 'A-':
        return 'text-green-600';
      case 'B+':
      case 'B':
      case 'B-':
        return 'text-blue-600';
      case 'C+':
      case 'C':
      case 'C-':
        return 'text-yellow-600';
      case 'D+':
      case 'D':
      case 'D-':
        return 'text-orange-600';
      case 'F':
        return 'text-red-600';
      case 'IP':
        return 'text-purple-600';
      case 'WD':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const renderCourseList = (courses: CourseData[]) => {
    // Group courses by term
    const coursesByTerm = courses.reduce((acc: Record<string, CourseData[]>, course) => {
      const term = course.term || 'Unknown Term';
      if (!acc[term]) {
        acc[term] = [];
      }
      acc[term].push(course);
      return acc;
    }, {});

    // Build a fixed 8-semester roadmap (Fall/Spring) starting from the earliest data year.
    const parsedYears = Object.keys(coursesByTerm)
      .map((term) => {
        const match = term.match(/\b(20\d{2})\b/);
        return match ? Number.parseInt(match[1], 10) : NaN;
      })
      .filter((year) => !Number.isNaN(year));

    const startYear = parsedYears.length > 0 ? Math.min(...parsedYears) : new Date().getFullYear();
    const semesterRoadmap: string[] = [];
    let year = startYear;
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        semesterRoadmap.push(`Fall ${year}`);
      } else {
        semesterRoadmap.push(`Spring ${year + 1}`);
        year += 1;
      }
    }

    // Keep non Fall/Spring terms visible after the core 8-semester roadmap.
    const extraTerms = Object.keys(coursesByTerm).filter(
      (term) => !semesterRoadmap.includes(term),
    );
    const allTerms = [...semesterRoadmap, ...extraTerms];

    return (
      <div className="mt-4 space-y-4">
        {allTerms.map(term => {
          const isExpanded = expandedTerms[term] ?? true;
          const termCourses = coursesByTerm[term] || [];
          
          return (
            <div key={term} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <button 
                className="w-full p-4 bg-muted/50 hover:bg-muted flex justify-between items-center transition-colors"
                onClick={() => toggleTerm(term)}
              >
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="text-lg font-medium">{term}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {termCourses.length} courses
                  </span>
                  <svg 
                    className={`h-5 w-5 text-muted-foreground transform transition-transform ${isExpanded ? '' : 'rotate-180'}`}
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {isExpanded && (
                <div className="divide-y">
                  {termCourses.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No courses planned/imported for this semester yet.</div>
                  ) : (
                    termCourses.map((course, index) => (
                      <div key={index} className="grid grid-cols-12 gap-4 items-center text-sm p-3 hover:bg-muted/50 transition-colors">
                        <div className="col-span-2">
                          <span className="font-medium text-foreground">{course.code}</span>
                        </div>
                        <div className="col-span-4">
                          <span className="text-muted-foreground">{course.title}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">{course.credits} credits</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">{course.status || 'N/A'}</span>
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`font-medium ${
                              hideSensitiveAcademic ? "text-muted-foreground" : getGradeColor(course.grade || "")
                            }`}
                          >
                            {formatGrade(course.grade) || "—"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const DegreeRequirements = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

    useEffect(() => {
      // Set initial loading state
      setIsLoading(false);
    }, []);

    const toggleBlock = (blockTitle: string) => {
      setExpandedBlocks(prev => ({
        ...prev,
        [blockTitle]: !prev[blockTitle]
      }));
    };

    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case "complete":
          return "bg-green-100 text-green-800";
        case "incomplete":
          return "bg-yellow-100 text-yellow-800";
        default:
          return "bg-muted text-foreground";
      }
    };

    const calculateProgress = (block: BlockData) => {
      const totalCourses = block.courses.length;
      const completedCourses = block.courses.filter(course => 
        course.grade && course.grade !== "IP" && course.grade !== "WD"
      ).length;
      return (completedCourses / totalCourses) * 100;
    };

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 text-red-600">
          <p>Error: {error}</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {degreeCourses.map((block, index) => {
            const progress = calculateProgress(block);
            return (
              <div key={`progress-${index}`} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h4 className="font-medium mb-2">{block.title}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {block.courses.length} total courses
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Requirements */}
        <div className="space-y-4">
          {degreeCourses.map((block, index) => (
            <Card key={index} className="p-4">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleBlock(block.title)}
              >
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold">{block.title}</h3>
                  <Badge className={getStatusColor(block.status)}>
                    {block.status}
                  </Badge>
                </div>
                <button
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBlock(block.title);
                  }}
                >
                  <svg
                    className={`w-5 h-5 transform transition-transform ${
                      expandedBlocks[block.title] ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
              <div className={`transition-all duration-300 ${
                expandedBlocks[block.title] ? 'max-h-full opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="space-y-2">
                  {block.courses.map((course, courseIndex) => (
                    <div
                      key={courseIndex}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                    >
                      <div>
                        <span className="font-medium">{course.code}</span>
                        <span className="text-muted-foreground ml-2">{course.title}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span
                          className={
                            hideSensitiveAcademic ? "text-muted-foreground" : getGradeColor(course.grade)
                          }
                        >
                          {formatGrade(course.grade)}
                        </span>
                        <span className="text-muted-foreground">{course.credits} credits</span>
                        <span className="text-muted-foreground">{course.term}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container mx-auto max-w-7xl px-0 py-2 md:py-4">
      <Dialog
        open={isRecommendationPreviewOpen}
        onOpenChange={(open) => {
          if (!open) closeRecommendationPreviewAndMaybeApplyMatrix()
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review Suggested Courses</DialogTitle>
            <DialogDescription>
              PyReason built these candidates from the student's completed courses, in-progress courses,
              remaining requirements, and current catalog offerings. Choose whether to add the recommended
              courses to the schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Recommended Courses ({latestRecommendations.length})
              </h3>
              <div className="space-y-2">
                {latestRecommendations.map((course) => renderRecommendationCard(course))}
              </div>
            </div>

            {latestBlockedRecommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Blocked Candidates ({latestBlockedRecommendations.length})
                </h3>
                <div className="space-y-2">
                  {latestBlockedRecommendations.map((course) =>
                    renderRecommendationCard(course, "blocked")
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={closeRecommendationPreviewAndMaybeApplyMatrix}>
              Not Now
            </Button>
            <Button onClick={applyRecommendedCoursesToSchedule}>
              Add Recommended Courses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppHeader
        selectedMajor={selectedMajor}
        selectedYear={selectedYear}
        isLoading={isLoading}
        studentName={selectedStudentName}
        planOptions={planOptions}
        onPlannerTermChange={handlePlannerTermChange}
      />

      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-md">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-0 grid w-full grid-cols-3 gap-0 rounded-none border-b border-border bg-muted/40 p-1.5">
            <TabsTrigger
              value="schedule"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              Course Scheduler
            </TabsTrigger>
            <TabsTrigger
              value="academic"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <GraduationCap className="h-4 w-4" />
              Academic Progress
            </TabsTrigger>
            <TabsTrigger
              value="requirements"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <BookOpen className="h-4 w-4" />
              Degree Requirements
            </TabsTrigger>
          </TabsList>

          <div className="p-6">
            <TabsContent value="schedule" className="space-y-6 mt-0">
              {academicCourses.length === 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader>
                    <CardTitle className="text-amber-900">Import Academic Records First</CardTitle>
                    <CardDescription className="text-amber-800">
                      Suggested courses use PyReason to reason over the student's completed and in-progress classes.
                      Import this student's MySlice record first so recommendations are based on real progress instead
                      of class year alone.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={() => setActiveTab("academic")}>
                      Go To Academic Import
                    </Button>
                  </CardContent>
                </Card>
              )}

              <MainControls
                onGenerateSchedule={generateBestSchedule}
                onToggleSearch={toggleSearchPopup}
                onResetSchedule={resetSchedule}
                onImportFromImage={handleImportFromImage}
                onOpenWhatIf={() => setIsWhatIfOpen(true)}
                disabled={!selectedMajor || !selectedYear || courses.length === 0}
              />

              {session?.user && (
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSavedCoursesFromDb}
                    disabled={isLoadingFromDb}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {isLoadingFromDb ? "Loading…" : "Load from database"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveCoursesToDb}
                    disabled={isSavingToDb || selectedCourses.length === 0}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {isSavingToDb ? "Saving…" : "Save to database"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Logged in — load/save your schedule to MongoDB</span>
                </div>
              )}

              <Dashboard
                selectedCourses={selectedCourses}
                allCourses={courses}
                currentView={currentView}
                onToggleView={toggleView}
                onShowDetails={showCourseDetails}
                onOpenNotes={openNotesModal}
                onRemoveCourse={removeCourse}
                courseNotes={courseNotes}
                onSwapCourse={swapCourse}
                scheduledRecommendations={latestRecommendations}
              />
            </TabsContent>

            <TabsContent value="academic" className="mt-0">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Import Academic Record</CardTitle>
                    <CardDescription>
                      Import academic history for {selectedStudentName || "the selected student"} from MySlice to track progress.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-2">
                        <p className="font-medium">Manual MySlice sign-in</p>
                        <p>When you start import, the scraper will open its own Chrome window.</p>
                        <p>Sign in to MySlice in that opened window, including 2FA.</p>
                        <p>After login, MySlice may stay on its home page. That is expected.</p>
                        <p>
                          In that same window, manually open <span className="font-medium">Academics -&gt; Course History</span> or{" "}
                          <span className="font-medium">Student Records -&gt; Course History</span>, then leave that page open while import continues.
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your MySlice credentials stay in the browser sign-in flow and are not entered into this app.
                      </p>
                      <Button
                        className="w-full"
                        onClick={handleImport}
                        disabled={isLoading}
                      >
                        {isLoading ? "Importing..." : "Import from MySlice"}
                      </Button>
                      {importStatus !== "idle" && (
                        <div
                          className={`rounded-md border p-4 text-sm ${
                            importStatus === "success"
                              ? "border-green-200 bg-green-50 text-green-900"
                              : importStatus === "error"
                              ? "border-red-200 bg-red-50 text-red-900"
                              : "border-amber-200 bg-amber-50 text-amber-900"
                          }`}
                        >
                          <p className="font-medium">
                            {importStatus === "success"
                              ? "Import Successful"
                              : importStatus === "error"
                              ? "Import Failed"
                              : "Import In Progress"}
                          </p>
                          <p className="mt-1">{importStatusMessage}</p>
                          {importStatus === "running" && (
                            <p className="mt-2 text-xs">
                              If the Chrome window is sitting on the MySlice landing page, manually open{" "}
                              <span className="font-medium">Academics -&gt; Course History</span> in that same window. The scraper resumes after the course table appears.
                            </p>
                          )}
                        </div>
                      )}
                      {importLogs.length > 0 && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-md">
                          <h4 className="text-sm font-medium mb-2">Import Log:</h4>
                          {importLogs.map((log, index) => (
                            <p key={index} className="text-sm text-muted-foreground">{log}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="mt-6">
                  {renderCourseList(academicCourses)}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="mt-0">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Advisor Alerts: Graduation Readiness Checker</CardTitle>
                    <CardDescription>
                      Automatic checks for CS graduation risks, policy compliance, and next-step advising actions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {advisorAlerts.map((raw) => {
                        const alert = sanitizeAdvisorAlert(raw)
                        const tone =
                          alert.level === "critical"
                            ? "border-red-200 bg-red-50 text-red-900"
                            : alert.level === "warning"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-emerald-200 bg-emerald-50 text-emerald-900"

                        const label =
                          alert.level === "critical"
                            ? "Critical"
                            : alert.level === "warning"
                              ? "Warning"
                              : "On Track"

                        return (
                          <div key={alert.id} className={`rounded-md border p-4 ${tone}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold">{alert.title}</p>
                              <Badge variant="outline">{label}</Badge>
                            </div>
                            <p className="mt-2 text-sm">{alert.detail}</p>
                            <p className="mt-1 text-xs opacity-90">
                              <span className="font-medium">Advisor action:</span> {alert.nextAction}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <GraduationPathTimeline courses={academicCourses} />

                <Card>
                  <CardHeader>
                    <CardTitle>Computer Science BS Graduation Requirements</CardTitle>
                    <CardDescription>
                      Advisor reference (Syracuse University): core/distribution requirements and recommended sequence.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 text-sm">
                    {!csRequirementsReference ? (
                      <p className="text-muted-foreground">CS requirements reference file is not available.</p>
                    ) : (
                      <>
                    <div>
                      <p className="font-medium">Minimum Credits</p>
                      <p className="text-muted-foreground">{csRequirementsReference.minimumCredits} credits required for BS in Computer Science.</p>
                    </div>

                    <div>
                      <p className="font-medium mb-2">General Education</p>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        {csRequirementsReference.generalEducation.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium mb-2">Mathematics Section</p>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        {csRequirementsReference.mathematics.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium mb-2">Major/Core Section</p>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        {csRequirementsReference.core.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium mb-2">Academic Standards</p>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        {csRequirementsReference.standards.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium mb-2">Recommended Sequence (Advisor Guide)</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(csRequirementsReference.roadmap).map(([year, items]) => (
                          <div key={year} className="border rounded-md p-3 bg-muted/30">
                            <p className="font-medium mb-1">{year}</p>
                            <p className="text-muted-foreground">{items.join(", ")}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Degree Requirements</CardTitle>
                    <CardDescription>
                      Track your progress towards degree completion
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">

                      {/* Degree Requirements Progress */}
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-4">Degree Requirements Progress</h3>
                        <div className="space-y-4">
                          <DegreeRequirements />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <WhatIfPlanner
        open={isWhatIfOpen}
        onOpenChange={setIsWhatIfOpen}
        selectedCourses={selectedCourses}
        catalogCourses={courses}
        onApply={(next) => {
          setSelectedCourses(next);
          showNotification("Applied what-if plan to your schedule.", "success");
        }}
      />

      {isSearchPopupOpen && (
        <SearchPopup
          onClose={toggleSearchPopup}
          onSearch={searchCourses}
          onCriteriaPreview={handleCriteriaPreview}
          catalogCourses={courses}
          searchResults={currentSearchResults}
          onAddCourse={addCourseFromSearch}
        />
      )}

      {isCourseDetailsModalOpen && currentCourseDetails && (
        <CourseDetailsModal course={currentCourseDetails} onClose={() => setIsCourseDetailsModalOpen(false)} />
      )}

      {isNotesModalOpen && currentNotesCourseId && (
        <CourseNotesModal
          courseId={currentNotesCourseId}
          initialNotes={courseNotes[currentNotesCourseId] || ""}
          onSave={saveNotes}
          onClose={() => setIsNotesModalOpen(false)}
          course={selectedCourses.find((c) => c.id === currentNotesCourseId) || null}
        />
      )}

      <ScheduleAssistantChat onApplySchedule={applyAssistantSchedule} />

      <NotificationArea notifications={notifications} onRemove={removeNotification} />
    </div>
  )
}

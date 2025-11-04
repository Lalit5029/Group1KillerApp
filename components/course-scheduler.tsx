"use client"

import { useState, useEffect } from "react"
import { AppHeader } from "./app-header"
import { MainControls } from "./main-controls"
import { Dashboard } from "./dashboard"
import { SearchPopup } from "./search-popup"
import { CourseDetailsModal } from "./course-details-modal"
import { CourseNotesModal } from "./course-notes-modal"
import { InitialSelectionModal } from "./initial-selection-modal"
import { NotificationArea } from "./notification-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AcademicDataVisualizer } from "./academic-data-visualizer"
import { DegreeRequirementsView } from "./degree-requirements-view"
import { Calendar, GraduationCap, BookOpen } from "lucide-react"
import type { Course, SelectedCourse, Notification, Major, Requirements, CourseData } from "@/lib/types"
import { fetchCourses, fetchRequirements } from "@/lib/data-utils"
import { hasConflict } from "@/lib/schedule-utils"
import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

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

export default function CourseScheduler() {
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
  const [isInitialModalOpen, setIsInitialModalOpen] = useState<boolean>(true)
  const [currentCourseDetails, setCurrentCourseDetails] = useState<Course | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [isDataReady, setIsDataReady] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState("schedule")
  const { data: session } = useSession()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [importLogs, setImportLogs] = useState<string[]>([])
  const { toast } = useToast()
  const [courseData, setCourseData] = useState<CourseData[]>([])
  const [calendarCourses, setCalendarCourses] = useState<SelectedCourse[]>([])
  const [academicCourses, setAcademicCourses] = useState<CourseData[]>([])
  const [degreeCourses, setDegreeCourses] = useState<BlockData[]>([])
  const [blocks, setBlocks] = useState<BlockData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({})
  const [expandedTerms, setExpandedTerms] = useState<Record<string, boolean>>({});

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        const requirementsData = await fetchRequirements()
        setRequirements(requirementsData)
        console.log("Requirements loaded:", Object.keys(requirementsData).length, "majors");

        // Extract majors directly from the requirements
        const majorsList = Object.keys(requirementsData).map((majorName) => ({
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

  // Load saved courses when user is logged in
  useEffect(() => {
    const loadSavedCourses = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/courses')
          if (response.ok) {
            const savedCourses = await response.json()
            if (savedCourses && savedCourses.length > 0) {
            // Convert saved courses to the correct format
            const formattedCourses = savedCourses.map((course: any) => ({
              id: course.id,
              Class: course.courseClass,
              Section: course.section,
              Instructor: course.instructor,
              DaysTimes: course.daysTimes,
              Room: course.room
            }))
            setSelectedCourses(formattedCourses)
            showNotification("Loaded your saved courses", "success")
              
              // Convert SelectedCourse to CourseData
              const convertedCourses: CourseData[] = formattedCourses.map((course: SelectedCourse) => ({
                course: course.Class,
                title: course.Class, // Using Class as title for now
                grade: course.grade || "IP",
                credits: course.credits || "0",
                term: "Fall 2024", // Default term
                catalogGroup: course.requirementGroup || "General", // Default catalog group
                requirementGroup: course.requirementGroup || null,
                status: "In Progress"
              }))
              
              setCourseData(convertedCourses)
              
              // Update requirement groups completion
              formattedCourses.forEach((course: SelectedCourse) => {
                if (course.requirementGroup && requirementGroups[course.requirementGroup]) {
                  if (course.grade !== "WD" && Number.parseFloat(course.credits || "0") > 0) {
                    requirementGroups[course.requirementGroup].completed += Number.parseFloat(course.credits || "0")
                  }
                }
              })
            } else {
              // If no saved courses, ensure the list is empty
              setSelectedCourses([])
              setCourseData([])
            }
          }
        } catch (error) {
          console.error("Failed to load saved courses:", error)
          showNotification("Failed to load your saved courses", "error")
          // Ensure the list is empty if there's an error
          setSelectedCourses([])
          setCourseData([])
        }
      } else {
        // If user is not logged in, ensure the list is empty
        setSelectedCourses([])
        setCourseData([])
      }
    }

    loadSavedCourses()
  }, [session])

  // Save courses when they change
  useEffect(() => {
    const saveCourses = async () => {
      if (session?.user && selectedCourses.length > 0) {
        try {
          const response = await fetch('/api/courses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(selectedCourses)
          })
          
          if (!response.ok) {
            throw new Error('Failed to save courses')
          }
        } catch (error) {
          console.error("Failed to save courses:", error)
          showNotification("Failed to save your course selection", "error")
        }
      }
    }

    saveCourses()
  }, [selectedCourses, session])

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

  // Generate best schedule based on major and year
  const generateBestSchedule = () => {
    if (!selectedMajor || !selectedYear || Object.keys(requirements).length === 0) {
      showNotification("Please confirm selection or wait for data to load.", "error");
      return;
    }

    if (courses.length === 0) {
      showNotification("No courses available. Please try refreshing the page.", "error");
      console.error("Courses array is empty when generating schedule");
      return;
    }

    console.log("Generating schedule for major:", selectedMajor, "year:", selectedYear);
    console.log("Available courses:", courses.length);
    console.log("Requirements keys:", Object.keys(requirements));

    // Reset current schedule
    setSelectedCourses([]);

    // Get suggested courses for the selected major and year
    const majorRequirements = requirements[selectedMajor];
    if (!majorRequirements) {
      showNotification(`No requirements found for major: ${selectedMajor}`, "error");
      console.error("Could not find requirements for major:", selectedMajor);
      return;
    }

    const yearRequirements = majorRequirements[selectedYear];
    if (!yearRequirements || !Array.isArray(yearRequirements) || yearRequirements.length === 0) {
      showNotification(`No suggested courses listed for ${selectedMajor} - ${selectedYear}.`, "warning");
      console.error("Year requirements missing or empty for:", selectedMajor, selectedYear);
      return;
    }

    console.log("Required courses for", selectedMajor, selectedYear, ":", yearRequirements);

    // Print first few courses for debugging
    console.log("Sample available courses:");
    courses.slice(0, 5).forEach(course => {
      console.log(`- ${course.id}: Class=${course.Class}, Section=${course.Section}`);
    });

    let coursesAddedCount = 0;
    const newSelectedCourses: SelectedCourse[] = [];
    const notFoundCourses: string[] = [];

    // Loop through each course code
    for (let i = 0; i < yearRequirements.length; i++) {
      const code = yearRequirements[i];
      if (!code) continue;

      // Handle both formats - with or without spaces
      const normalizedCode = code.trim();
      const codeWithoutSpace = normalizedCode.replace(/\s+/g, '');
      
      // Find all possible sections of this course - more flexible matching
      const possibleSections = courses.filter((c) => {
        if (!c.Class) return false;
        
        const courseClass = c.Class.trim();
        const courseClassNoSpace = courseClass.replace(/\s+/g, '');
        
        // Try multiple matching strategies
        return (
          courseClass.toLowerCase() === normalizedCode.toLowerCase() || // Exact match with spaces
          courseClassNoSpace.toLowerCase() === codeWithoutSpace.toLowerCase() || // Match without spaces
          courseClass.toLowerCase().includes(normalizedCode.toLowerCase()) // Partial match
        );
      });

      console.log(`Looking for course ${code}: found ${possibleSections.length} possible sections`);
      
      if (possibleSections.length === 0) {
        // Try a more lenient search if no matches found
        const lenientSections = courses.filter(c => 
          c.Class && c.Class.replace(/\s+/g, '').toLowerCase().includes(codeWithoutSpace.toLowerCase())
        );
        
        if (lenientSections.length > 0) {
          console.log(`Found ${lenientSections.length} sections with lenient matching for ${code}`);
          
          let added = false;
          for (const section of lenientSections) {
            if (!hasConflict(section, newSelectedCourses)) {
              newSelectedCourses.push({
                ...section,
                id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              });
              added = true;
              coursesAddedCount++;
              break;
            }
          }
          
          if (!added) {
            showNotification(`Could not add "${code}": All sections conflict.`, "warning");
          }
        } else {
          notFoundCourses.push(code);
        }
        continue;
      }

      let added = false;
      for (const section of possibleSections) {
        if (!hasConflict(section, newSelectedCourses)) {
          // Create a new SelectedCourse with a unique ID
          const newCourse: SelectedCourse = {
            ...section,
            id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };
          
          newSelectedCourses.push(newCourse);
          added = true;
          coursesAddedCount++;
          break;
        }
      }

      if (!added && possibleSections.length > 0) {
        showNotification(`Could not add "${code}": All sections conflict.`, "warning");
      }
    }

    // Force a re-render by creating a new array
    setSelectedCourses([...newSelectedCourses]);
    console.log(`Added ${coursesAddedCount} courses to schedule. Schedule now has ${newSelectedCourses.length} courses.`);

    if (notFoundCourses.length > 0) {
      const message = notFoundCourses.length === 1 
        ? `Could not find course: ${notFoundCourses[0]}`
        : `Could not find ${notFoundCourses.length} courses: ${notFoundCourses.slice(0, 3).join(", ")}${notFoundCourses.length > 3 ? '...' : ''}`;
      
      showNotification(message, "warning");
      console.warn("Courses not found:", notFoundCourses);
    }

    if (coursesAddedCount > 0) {
      showNotification(`Added ${coursesAddedCount} course(s) to your schedule.`, "success");
    } else if (coursesAddedCount === 0 && notFoundCourses.length === 0) {
      showNotification("No courses could be added to your schedule.", "error");
    }
  };

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

  // Search courses
  const searchCourses = (query: string) => {
    if (!query.trim()) {
      setCurrentSearchResults([])
      return
    }

    const queryLower = query.toLowerCase()

    // Improved search logic to match on multiple fields
    const results = courses.filter((c) => {
      // Search in course code
      if (c.Class?.toLowerCase().includes(queryLower)) {
        return true
      }

      // Search in instructor name
      if (c.Instructor?.toLowerCase().includes(queryLower)) {
        return true
      }

      // Search in section
      if (c.Section?.toLowerCase().includes(queryLower)) {
        return true
      }

      // Search in days/times
      if (c.DaysTimes?.toLowerCase().includes(queryLower)) {
        return true
      }

      // Search in room
      if (c.Room?.toLowerCase().includes(queryLower)) {
        return true
      }

      return false
    })

    // Sort results to prioritize exact matches
    results.sort((a, b) => {
      const aClassMatch = a.Class?.toLowerCase() === queryLower ? 0 : 1
      const bClassMatch = b.Class?.toLowerCase() === queryLower ? 0 : 1
      return aClassMatch - bClassMatch
    })

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

  // Handle major and year selection
  const handleSelectionConfirm = (major: string, year: string) => {
    setSelectedMajor(major)
    setSelectedYear(year)
    setIsInitialModalOpen(false)
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
        const response = await fetch('/api/courses/calendar')
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
            showNotification("Loaded your saved calendar courses", "success")
          } else {
            setCalendarCourses([])
          }
        }
      } catch (error) {
        console.error("Failed to load saved calendar courses:", error)
        showNotification("Failed to load your saved calendar courses", "error")
        setCalendarCourses([])
      }
    } else {
      setCalendarCourses([])
    }
  }

  // Load saved academic courses
  const loadSavedAcademicCourses = async () => {
    if (session?.user) {
      try {
        const response = await fetch('/api/courses/academic')
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
            setAcademicCourses(formattedCourses)
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
    if (session?.user && calendarCourses.length > 0) {
      try {
        const response = await fetch('/api/courses/calendar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(calendarCourses)
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

        const response = await fetch('/api/courses/academic', {
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
        const response = await fetch('/api/courses/degree-requirements')
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
        const response = await fetch('/api/courses/degree-requirements', {
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
    loadSavedCalendarCourses()
    loadSavedAcademicCourses()
    loadSavedDegreeRequirements()
  }, [session])

  // Save both types of courses when they change
  useEffect(() => {
    saveCalendarCourses()
  }, [calendarCourses, session])

  useEffect(() => {
    saveAcademicCourses()
  }, [academicCourses, session])

  useEffect(() => {
    saveDegreeRequirements()
  }, [degreeCourses, session])

  const handleImport = async () => {
    if (!username || !password) {
      showNotification("Please fill in all fields", "error")
      return
    }

    setIsLoading(true)
    setImportLogs([])
    try {
      // Make the actual API call to start import
      const response = await fetch("http://localhost:3001/api/scrape-academic-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        throw new Error("Failed to start import process")
      }

      const { jobId } = await response.json()
      
      // Poll for job status
      const checkStatus = async () => {
        const statusResponse = await fetch(`http://localhost:3001/api/scrape-status/${jobId}`)
        const statusData = await statusResponse.json()

        // Update logs with the detailed log message from the backend
        if (statusData.log) {
          const logLines = statusData.log.split('\n').filter((line: string) => line.trim())
          setImportLogs(logLines)
        }

        if (statusData.status === "completed") {
          // Set imported course data to academic courses
          if (statusData.result) {
            setAcademicCourses(statusData.result.courses)
            // Set degree requirements data
            if (statusData.result.blocks) {
              setDegreeCourses(statusData.result.blocks)
              // Save degree requirements after import
              await saveDegreeRequirements()
            }
          }
          showNotification("Successfully imported courses from MySlice", "success")
          setUsername("")
          setPassword("")
          setIsLoading(false)
        } else if (statusData.status === "failed") {
          setIsLoading(false)
          throw new Error(statusData.message || "Import failed")
        } else {
          // Job is still running, check again in 2 seconds
          setTimeout(checkStatus, 2000)
        }
      }

      // Start polling
      checkStatus()
    } catch (error) {
      console.error("Failed to import courses:", error)
      showNotification((error as Error).message || "Failed to import courses", "error")
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
        return 'text-gray-600';
      default:
        return 'text-gray-500';
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

    // Sort terms chronologically
    const sortedTerms = Object.keys(coursesByTerm).sort((a, b) => {
      const [aSeason, aYear] = a.split(' ');
      const [bSeason, bYear] = b.split(' ');
      
      if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
      
      const sessionOrder: Record<string, number> = {
        'Fall': 3,
        'Summer': 2,
        'Spring': 1,
        'Winter': 0
      };
      
      return (sessionOrder[aSeason] || 0) - (sessionOrder[bSeason] || 0);
    });

    return (
      <div className="mt-4 space-y-4">
        {sortedTerms.map(term => {
          const isExpanded = expandedTerms[term] ?? true;
          const termCourses = coursesByTerm[term];
          
          return (
            <div key={term} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <button 
                className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center transition-colors"
                onClick={() => toggleTerm(term)}
              >
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  <span className="text-lg font-medium">{term}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {termCourses.length} courses
                  </span>
                  <svg 
                    className={`h-5 w-5 text-gray-500 transform transition-transform ${isExpanded ? '' : 'rotate-180'}`}
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
                  {termCourses.map((course, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 items-center text-sm p-3 hover:bg-gray-50 transition-colors">
                      <div className="col-span-2">
                        <span className="font-medium text-gray-900">{course.code}</span>
                      </div>
                      <div className="col-span-4">
                        <span className="text-gray-600">{course.title}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">{course.credits} credits</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">{course.status || 'N/A'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className={`font-medium ${getGradeColor(course.grade || '')}`}>
                          {course.grade || 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
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
          return "bg-gray-100 text-gray-800";
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
              <div key={`progress-${index}`} className="bg-white p-4 rounded-lg shadow">
                <h4 className="font-medium mb-2">{block.title}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress:</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-500">
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
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
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
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div>
                        <span className="font-medium">{course.code}</span>
                        <span className="text-gray-600 ml-2">{course.title}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={getGradeColor(course.grade)}>
                          {course.grade}
                        </span>
                        <span className="text-gray-600">{course.credits} credits</span>
                        <span className="text-gray-600">{course.term}</span>
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
    <div className="app-container max-w-7xl mx-auto p-4 md:p-6">
      <AppHeader selectedMajor={selectedMajor} selectedYear={selectedYear} isLoading={isLoading} />

      <div className="mb-6 bg-white rounded-xl shadow-soft">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 p-1 bg-primary-50 rounded-t-xl">
            <TabsTrigger
              value="schedule"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-soft"
            >
              <Calendar className="h-4 w-4" />
              Course Scheduler
            </TabsTrigger>
            <TabsTrigger
              value="academic"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-soft"
            >
              <GraduationCap className="h-4 w-4" />
              Academic Progress
            </TabsTrigger>
            <TabsTrigger
              value="requirements"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-soft"
            >
              <BookOpen className="h-4 w-4" />
              Degree Requirements
            </TabsTrigger>
          </TabsList>

          <div className="p-6">
            <TabsContent value="schedule" className="space-y-6 mt-0">
              <MainControls
                onGenerateSchedule={generateBestSchedule}
                onToggleSearch={toggleSearchPopup}
                onResetSchedule={resetSchedule}
                onImportFromImage={handleImportFromImage}
                disabled={!selectedMajor || !selectedYear || courses.length === 0}
              />

              <Dashboard
                selectedCourses={selectedCourses}
                currentView={currentView}
                onToggleView={toggleView}
                onShowDetails={showCourseDetails}
                onOpenNotes={openNotesModal}
                onRemoveCourse={removeCourse}
                courseNotes={courseNotes}
              />
            </TabsContent>

            <TabsContent value="academic" className="mt-0">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Import Academic Record</CardTitle>
                    <CardDescription>
                      Import your academic record from MySlice to track your progress.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid w-full items-center gap-4">
                        <div className="flex flex-col space-y-1.5">
                          <Label htmlFor="username">MySlice Username (NetID)</Label>
                          <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                          <Label htmlFor="password">MySlice Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        Your credentials will only be used to access your MySlice account and will not be stored.
                      </p>
                      <Button
                        className="w-full"
                        onClick={handleImport}
                        disabled={isLoading}
                      >
                        {isLoading ? "Importing..." : "Import from MySlice"}
                      </Button>
                      {importLogs.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-md">
                          <h4 className="text-sm font-medium mb-2">Import Log:</h4>
                          {importLogs.map((log, index) => (
                            <p key={index} className="text-sm text-gray-600">{log}</p>
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

      {isSearchPopupOpen && (
        <SearchPopup
          onClose={toggleSearchPopup}
          onSearch={searchCourses}
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

      {isInitialModalOpen && (
        <InitialSelectionModal requirements={requirements} isDataReady={isDataReady} onConfirm={handleSelectionConfirm} />
      )}

      <NotificationArea notifications={notifications} onRemove={removeNotification} />
    </div>
  )
}


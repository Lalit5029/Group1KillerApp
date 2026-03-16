# Sprint EC: Course Conflict Advisor Sidebar — Work Done by Me

This document describes the extra credit sprint feature added: a **Course Conflict Advisor** sidebar that continuously evaluates schedule conflicts and suggests alternative sections.

---

## 1. Detect all time conflicts in the current schedule

Extended the existing scheduling utilities so we can list every pair of conflicting courses, not just block new ones.

- **File:** `lib/schedule-utils.ts`
- **What was added:**
  - `ScheduleConflict` interface to describe a conflict:
    - `id` – stable identifier for the pair.
    - `courseA` / `courseB` – the two conflicting `SelectedCourse` entries.
    - `overlapLabel` – human-readable description (e.g. `"MoWe 10:00AM - 11:20AM"`).
  - `findScheduleConflicts(selectedCourses: SelectedCourse[])`:
    - Uses the existing `parseDaysTimes` logic to:
      - Parse days (Mo/Tu/We/Th/Fr) and start/end times.
      - Detect day overlap and time overlap between every pair of selected courses.
    - Skips courses where `DaysTimes` is missing or cannot be parsed.
    - Returns a list of all conflicts so the UI can display them in one place.

---

## 2. Course Conflict Advisor sidebar in the dashboard

Added a right-hand panel in the Weekly Schedule card that surfaces conflicts and suggests alternatives.

- **File:** `components/dashboard.tsx`
- **Props extended:**
  - `allCourses: Course[]` – full catalog used to search for alternative sections.
  - `onSwapCourse(oldCourseId: string, newCourse: Course)` – callback to perform a one-click swap.
- **Behavior:**
  - Computes `conflicts = findScheduleConflicts(filteredCourses)` where `filteredCourses` respect the existing department and time filters.
  - Renders a **Course Conflict Advisor** sidebar:
    - When there are **no conflicts**, shows a green check-style message: “No time conflicts detected in your current schedule.”
    - When conflicts exist:
      - For each conflict, shows:
        - A line like: **“Conflict: CIS 252 M001 and MAT 295 M002”**.
        - A small description of the overlap, e.g. **“Overlap around MoWe 10:00AM - 11:20AM”**.
      - Looks up alternative sections for `courseA`:
        - Filters `allCourses` to other sections of the same `Class`.
        - Uses `hasConflict(candidate, otherSelected)` to keep only **conflict-free** sections.
      - Displays up to three **Swap** buttons:
        - Example: **“Swap to M002 (TuTh 2:00PM - 3:20PM)”**.
        - Clicking a button calls `onSwapCourse` with the current course id and the selected alternative.

The main schedule (calendar or list) and the advisor sidebar are rendered side by side on large screens in a 2:1 grid, but still stacked nicely on smaller screens.

---

## 3. Wiring swaps into the scheduler

The Course Scheduler now knows how to apply a swap requested by the advisor.

- **File:** `components/course-scheduler.tsx`
- **What was added:**
  - `handleSwapCourse(oldCourseId: string, newCourse: Course)`:
    - Removes the existing `SelectedCourse` with the matching `id` from `selectedCourses`.
    - Creates a new `SelectedCourse` from the catalog `Course` (`Class`, `Section`, `DaysTimes`, `Room`, `Instructor`, `MeetingDates`) with a fresh `id`.
    - Appends this new entry to `selectedCourses`.
    - Shows a toast notification: **“Swapped to a conflict-free section”**.
  - Passes the new props into `Dashboard`:
    - `allCourses={courses}`
    - `onSwapCourse={handleSwapCourse}`

---

## 4. Requirements UX polish

As part of the extra credit work, I also polished the requirements UX so it’s clearer what major/year is selected and why requirements may appear empty.

- **File:** `components/app-header.tsx`
  - When a major/year is selected, the header now displays it more cleanly as:
    - **Major** • **Year**
  - When no selection is made, the header guidance now explicitly tells the user to use the **Major & Year** button.

- **File:** `app/academic-progress/page.jsx`
  - Improved the empty state for requirements progress:
    - If structured requirements aren’t available for the selected major, a styled message explains this is likely due to missing scraper data and that the planner can still be used.

---

## Summary

| What | Where |
|------|-------|
| Detect all pairwise schedule conflicts | `lib/schedule-utils.ts` (`findScheduleConflicts`) |
| Course Conflict Advisor sidebar UI + suggestions | `components/dashboard.tsx` |
| One-click swap handling from advisor into schedule | `components/course-scheduler.tsx` |
| Requirements UX clarity (header + empty state) | `components/app-header.tsx`, `app/academic-progress/page.jsx` |


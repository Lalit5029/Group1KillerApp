# Sprint 3: Error Handling, Empty States, and Tests — Work Done by Me

This document describes everything done in Sprint 3

---

## 1. Error handling for Load and Save to database

Improved what happens when **Load from database** or **Save to database** fails so the user always sees a clear message.

- **Clear toast/notification messages**
  - **Load fails:** “Couldn’t load schedule from database. Check your connection and try again.” (or “Couldn’t load schedule. Please try again.” if the request itself errors).
  - **Save fails:** “Couldn’t save schedule to database. Check your connection and try again.”
  - These messages are shown via the existing notification system (toast-style) so the user sees them right away.

- **Inline error message**
  - I added state for load and save errors (`dbLoadError`, `dbSaveError`) in the course scheduler.
  - When either Load or Save fails, a short error line appears **below** the Load/Save buttons (in red/destructive styling) with the same message. It stays visible until the user tries Load or Save again, so they don’t have to rely only on the toast.

- **Where:** `components/course-scheduler.tsx` — new state, updated `loadSavedCoursesFromDb` and `saveCoursesToDb`, and a small inline block that renders when there’s a load or save error.

---

## 2. Empty state when the schedule has no courses

Made the empty schedule state consistent and clearer.

- **Before:** The calendar view said something like “No courses have been added to your schedule yet” and the list view said “No courses added yet.”
- **After:** Both places now show: **“No courses yet — add some above.”** so it’s obvious the user should add courses from the controls above.

- **Where:**
  - `components/weekly-calendar.tsx` — empty state text when there are no courses in the calendar view.
  - `components/course-list-view.tsx` — empty state text in the table when there are no courses in the list view.

---

## 3. Tests for the demo-progress API route

Added tests for the **GET /api/demo-progress** route so we have a safety net for that endpoint.

- **File:** `app/api/demo-progress/route.test.ts`
- **What the tests do:**
  - **404 when demo user is missing:** Asserts that when the database has no demo user, the API returns status 404 and a JSON error message that mentions “Demo user not found” and “db:seed”.
  - **200 with correct shape when user exists:** Asserts that when the demo user exists (with academic courses and degree requirements), the response is 200 and the body has `user`, `totalCredits`, `academicCourses`, and `degreeRequirements` with the expected structure.
  - **totalCredits calculation:** Asserts that `totalCredits` is the sum of credits from `academicCourses` (e.g. 4 + 3 = 7).

- The tests **mock** `@/lib/prisma` so they don’t need a real database. They only test the route handler logic.

- **How to run:** From the project root, run:
  - `npm run test -- --testPathPattern=demo-progress`
  - Or run the full suite with `npm run test`.
  - Note: The project uses Jest with ESM. If you see `require is not defined` or similar, the Jest/setup configuration may need to be adjusted for ESM; the test file itself is written to work once the environment runs.

---

## Summary

| What | Where |
|------|--------|
| Load/Save error messages (toast + inline) | `components/course-scheduler.tsx` |
| Empty schedule message | `components/weekly-calendar.tsx`, `components/course-list-view.tsx` |
| GET /api/demo-progress tests | `app/api/demo-progress/route.test.ts` |


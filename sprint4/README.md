# Sprint 4: Requirements API + Major/Year UX — Work Done

This document describes the work completed in Sprint 4.

---

## What files were changed (Sprint 4 scope)

The Sprint 4 work documented here corresponds to changes made in these files:

- `app/api/requirements/route.js`
- `lib/data-utils.ts`
- `components/course-scheduler.tsx`
- `components/main-controls.tsx`

---

## 1. Requirements API: serve scraper-backed requirements in scheduler format

Added/updated a requirements endpoint so the UI can load real course codes from the scraper output when available.

- **API route**: `app/api/requirements/route.js`
  - Reads `backend/data/ecs_requirements_cleaned.json`
  - Transforms scraper output into scheduler format:
    - `{ "Major Name, BS": { Freshman: ["CIS 252", ...], Sophomore: [...], Junior: [...], Senior: [...] }, ... }`
  - Maps category names like “First Year …” / “Second Year …” into `Freshman` / `Sophomore` / `Junior` / `Senior`
  - Deduplicates course codes per year and drops majors that would otherwise be empty
  - Returns **404** with a helpful error message if the scraper output file is missing

---

## 2. Client requirements fetch: prefer API, fall back to static JSON

We updated the requirements loader so the app keeps working even if the API (or scraper file) isn’t available.

- **Where**: `lib/data-utils.ts` (`fetchRequirements()`)
  - First tries `GET /api/requirements`
  - If that fails (non-OK), falls back to `GET /data/engineering_majors_requirements.json`

---

## 3. Scheduler UX: don’t auto-open modal, add “Major & Year” button

We changed the scheduler so users land on the app immediately without being blocked by the major/year modal, while still keeping the modal easily accessible.

- **Modal no longer opens on initial load**
  - `isInitialModalOpen` now initializes to `false` in `components/course-scheduler.tsx`, so the “Select Your Major and Year” modal does not pop up automatically on `localhost`.

- **Added a “Major & Year” button to open the modal**
  - `components/course-scheduler.tsx` passes `onOpenMajorYear={() => setIsInitialModalOpen(true)}` into `MainControls`.
  - `components/main-controls.tsx` renders a **Major & Year** button (GraduationCap icon) that triggers `onOpenMajorYear`.
  - Confirming selection sets `selectedMajor`/`selectedYear` and closes the modal (`setIsInitialModalOpen(false)`).
  - The control strip shows a helper message when actions are disabled until major/year is selected.

---

## Summary

| What | Where |
|------|------|
| Requirements API route + transform to scheduler format | `app/api/requirements/route.js` |
| Requirements fetch prefers API with static fallback | `lib/data-utils.ts` |
| Modal open behavior + wiring to controls | `components/course-scheduler.tsx` |
| “Major & Year” button + disabled-state helper text | `components/main-controls.tsx` |


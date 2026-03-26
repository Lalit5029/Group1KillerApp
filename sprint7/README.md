# Sprint 7: CS-First Planner + Graduation Path Timeline

This document summarizes all current Git changes for Sprint 7.

## Scope at a glance

- CS-only advising workflow simplification (major selection modal removed)
- New Path-to-Graduation timeline (Gantt-style term roadmap + prerequisite chains)
- New what-if schedule planning utilities and panel
- Search + schedule utility extraction into reusable lib modules
- UI refresh across auth + advisor pages (new sticky header + theme toggle + styling)

## Current unpushed file set

Git status snapshot for this sprint:

- Modified: `app/api/students/[studentId]/route.ts`
- Modified: `app/globals.css`
- Modified: `app/layout.tsx`
- Modified: `app/login/page.tsx`
- Modified: `app/page.tsx`
- Modified: `app/providers.tsx`
- Modified: `app/register/page.tsx`
- Modified: `app/students/page.tsx`
- Modified: `components/app-header.tsx`
- Modified: `components/course-scheduler.tsx`
- Deleted: `components/initial-selection-modal.tsx`
- Modified: `components/main-controls.tsx`
- Modified: `components/search-popup.tsx`
- Modified: `lib/types.ts`
- New: `components/graduation-path-timeline.tsx`
- New: `components/site-header.tsx`
- New: `components/theme-toggle.tsx`
- New: `components/what-if-planner.tsx`
- New: `lib/class-year.ts`
- New: `lib/course-search.ts`
- New: `lib/cs-graduation-path.ts`
- New: `lib/schedule-credits.ts`
- New: `lib/what-if-schedule.ts`

## Feature and architecture changes

### 1) Path to graduation (CS roadmap)

- Added `lib/cs-graduation-path.ts` with:
  - 8-term CS graduation roadmap (`CS_GRADUATION_SEMESTERS`)
  - completion normalization + pass-grade checks
  - row-level completion states (`done`, `remaining`, `advisory`)
  - prerequisite chain definitions for advising context
  - progress summary helpers for completed vs remaining checklist rows
- Added `components/graduation-path-timeline.tsx`:
  - timeline progress strip across suggested terms
  - per-term visual rows for completed/remaining courses
  - summary progress %, remaining requirements list
  - prerequisite-chain display
- Integrated timeline into Degree Requirements flow via `components/course-scheduler.tsx`.

### 2) CS-only onboarding simplification

- Removed blocking startup selection modal:
  - deleted `components/initial-selection-modal.tsx`
- Scheduler now derives class-year context without modal:
  - `lib/class-year.ts` adds year normalization helpers
  - `components/course-scheduler.tsx` uses student metadata + per-student local storage fallback
  - `components/app-header.tsx` now supports in-header class-year selection
- Default student creation major set to CS:
  - `app/students/page.tsx` default form major is `Computer Science, BS`

### 3) What-if planning enhancements

- Added `components/what-if-planner.tsx`:
  - scratch planning workspace
  - term-scoped or full-schedule what-if editing
  - add/remove comparisons against baseline
  - conflict checks + credit summaries before apply
- Added `lib/what-if-schedule.ts`:
  - term slicing
  - cloning and keying helpers
  - baseline-vs-scratch diff helpers
  - safe merge/apply helpers
- Added `lib/schedule-credits.ts`:
  - section credit estimation utilities
  - selected schedule credit totals
- Updated controls in `components/main-controls.tsx` and scheduler wiring to expose what-if action.

### 4) Search flow cleanup

- Added `lib/course-search.ts` to centralize:
  - criteria-to-query builder
  - course filtering + lightweight ranking
- Updated `components/search-popup.tsx` and `components/course-scheduler.tsx` to consume shared search logic.

### 5) Workspace and visual refresh

- Added global reusable header shell:
  - `components/site-header.tsx`
- Added dark/light toggle component:
  - `components/theme-toggle.tsx`
- Updated providers/layout for theme support:
  - `app/providers.tsx` wraps app with `ThemeProvider`
  - `app/layout.tsx` adds hydration-safe html/body flags
- Expanded design tokens and component utility styles:
  - `app/globals.css`
- Refreshed major pages with new shell/header patterns:
  - `app/page.tsx`
  - `app/students/page.tsx`
  - `app/login/page.tsx`
  - `app/register/page.tsx`

### 6) Student API and typing updates

- `app/api/students/[studentId]/route.ts`
  - added authenticated `DELETE` endpoint for student removal
  - standardized error status mapping for auth/not-found/server failures
- `lib/types.ts`
  - updated shared client types for new features (e.g., schedule term metadata and search criteria)

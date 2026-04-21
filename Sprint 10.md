# Sprint 10

## Purpose
- Deliver two visible product improvements:
  - Live schedule conflict radar
  - Low-vision accessibility controls (zoom + high contrast)

## Branches
- `TM01-130-Live-schedule-conflict-radar`
- `TM01-131-Low-vision-zoom`

## What Was Added

### 1) Live Schedule Conflict Radar (`TM01-130-Live-schedule-conflict-radar`)
- Added a persistent radar card in the Course Scheduler tab.
- Detects schedule overlaps in real time as courses are added/removed.
- Shows:
  - Safe state (no conflicts)
  - Alert state (active conflicts)
  - Up to 3 conflict details plus a remaining-count indicator
- Reuses existing conflict engine (`findScheduleConflicts`) for consistency.

### 2) Low-Vision Zoom + High Contrast (`TM01-131-Low-vision-zoom`)
- Added global floating accessibility controls:
  - Zoom out (`A-`)
  - Zoom in (`A+`)
  - Reset (`100%`)
  - High contrast toggle (On/Off)
- Added keyboard shortcuts:
  - `Ctrl/Cmd +` zoom in
  - `Ctrl/Cmd -` zoom out
  - `Ctrl/Cmd 0` reset zoom
- Preferences persist in `localStorage`.
- High-contrast mode applies globally using CSS token overrides.

## Files Touched

### Conflict Radar
- `components/course-scheduler.tsx`

### Low-Vision Accessibility
- `components/low-vision-zoom-controls.tsx` (new)
- `app/layout.tsx`
- `app/globals.css`

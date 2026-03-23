# Sprint 6: CS Graduation Requirements + Advisor Readiness Alerts — Work Done by Me

This document summarizes the two Sprint 6 features completed.

---

## 1. Computer Science graduation requirements feature (CS-only focus)

Implemented a Computer Science-focused graduation requirements experience using the Syracuse BS CS structure and recommended roadmap.

- **API change**
  - **File:** `app/api/requirements/route.js`
  - Enforced a canonical `Computer Science, BS` plan in the requirements API output:
    - Freshman: ECS 101, CIS 151, MAT 295, WRT 105, FYS 101, CIS 252, MAT 296, PHI 251, PHY 211, PHY 221
    - Sophomore: CIS 375, CIS 351, MAT 397, PHY 212, PHY 222, CIS 321, CIS 341, CIS 352, CSE 384, WRT 205
    - Junior: CIS 453, CIS 477, CSE 486, CIS 473, CIS 454
    - Senior: ECS 392

- **Scheduler focus**
  - **File:** `components/course-scheduler.tsx`
  - During initialization, requirements are filtered to CS-only when available.
  - Major defaults to `Computer Science, BS` and year is initialized for planning flow.

- **Advisor reference panel**
  - **File:** `components/course-scheduler.tsx`
  - Added a dedicated “Computer Science BS Graduation Requirements” card under the Degree Requirements tab.
  - Includes:
    - 120-credit minimum
    - General education breakdown
    - Mathematics section
    - CS major/core section
    - Academic standards (minimum C- areas, B- core GPA target)
    - Year-by-year recommended sequence summary

---

## 2. Graduation Readiness Checker (Advisor Alerts panel)

Added a new feature that automatically evaluates a student’s imported academic courses and surfaces advising alerts.

- **Rule engine**
  - **File:** `lib/graduation-readiness.ts`
  - Added `evaluateCsGraduationReadiness(courses)` to generate structured alerts with:
    - `title`
    - `level` (`critical`, `warning`, `on_track`)
    - `detail`
    - `nextAction`
  - Checks implemented:
    1. CS core coverage gaps
    2. Writing requirement completion (`WRT 105`, `WRT 205`)
    3. Presentational skills completion (`CRS 225`/`CRS 325`/`IST 344`)
    4. Math section chain progress (`MAT 295`, `MAT 296`, `MAT 397 or MAT 331`, `CIS 321`)
    5. Natural science sequence progress (base + second sequence option)
    6. Grade policy violations (required courses below C-)
    7. CS core GPA check against B- threshold

- **UI integration**
  - **File:** `components/course-scheduler.tsx`
  - Added an “Advisor Alerts: Graduation Readiness Checker” card in the Degree Requirements tab.
  - Alerts are color-coded:
    - Red = Critical
    - Amber = Warning
    - Green = On Track
  - Each alert includes a concrete advisor next-step recommendation.

---

## Summary

| What | Where |
|------|-------|
| CS-only graduation requirements roadmap in API | `app/api/requirements/route.js` |
| CS requirements reference panel in UI | `components/course-scheduler.tsx` |
| Graduation readiness rule engine | `lib/graduation-readiness.ts` |
| Advisor alerts panel (risk + action guidance) | `components/course-scheduler.tsx` |


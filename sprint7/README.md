# Sprint 7 — CS-first advising planner

Sprint 7 focused on streamlining the advisor experience around the Computer Science program: clearer graduation visibility, lighter onboarding, stronger planning tools, a refreshed UI, and more reliable course schedule data for the planner.

## Summary of deliverables

- **Graduation path timeline** — Gantt-style, term-oriented roadmap of remaining CS requirements with prerequisite context, integrated into degree requirements.
- **CS-only workflow** — Removed the blocking major/year modal; class year follows the student record with an in-header selector and per-student persistence; new students default to Computer Science, BS.
- **What-if scheduling** — Scratch schedules, term-level editing, comparison to the baseline, conflict awareness, and credit summaries before applying changes.
- **Course search** — Shared filtering, query building, and ranking logic reused by the scheduler and search UI.
- **Design system polish** — Site-wide header, light/dark theme, updated tokens and layout patterns across login, registration, students, and the main workspace.
- **Student management API** — Authenticated delete for student records and consistent error handling for common failure cases.
- **Course catalog data** — Pipeline from saved MySlice Class Search responses (exported XML) to normalized offerings and the planner’s `courses.json` format; refreshed undergraduate **CIS** and **ECS** sections (multiple terms, e.g. Spring and Fall 2026) for scheduling and search.

## Technical highlights

| Area | Description |
|------|-------------|
| CS roadmap | Eight-term model, completion rules against imported academic history, pass-grade handling, and prerequisite chains for advising copy. |
| What-if engine | Schedule cloning, diffing, merge/apply helpers, and credit utilities aligned with section selection. |
| Class Search exports | Node scripts parse PeopleSoft-style saved responses with Cheerio and convert rows to the existing UI shape (class, section, days/times, room, instructor, meeting dates). Coverage matches whatever appeared in each saved search (e.g. open sections only if that was the filter). |
| Configuration | Syracuse class-search helper config aligned with current term and subject field usage for any scripted workflows. |

## Outcomes for users

Advisors see **where a CS student stands toward graduation**, can **experiment with schedules without losing the real plan**, and work in a **consistent, modern UI** backed by **schedule data** that matches what was exported from Class Search for CIS and ECS offerings.

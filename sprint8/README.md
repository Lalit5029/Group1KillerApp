# Sprint 8 — Advisor assistant, presentation privacy, and catalog readiness

Sprint 8 adds an in-app **Schedule assistant** (catalog-backed answers plus optional cloud models), a **presentation / demo privacy** mode for grades and GPA-sensitive alerts, tighter alignment of **CS graduation checks and roadmap** with the reference track, and a **broader refresh of planner course data** from saved Class Search exports (including multi-subject XML inputs and parser ergonomics).

## Summary of deliverables

- **Schedule assistant** — Floating entry point (sheet UI) calling `POST /api/assistant/chat` (advisor-authenticated). Handles **catalog lookups** (rooms, times, instructors), **term-style questions** by overlapping `MeetingDates` with Fall/Spring/Summer/Winter (or a calendar year), **natural-language schedule solving** (course codes + optional “no Friday” / “end by 6 PM” rules) with conflict-free section picking and **Add to schedule** (replaces same course codes, skips conflicts with toast).
- **Optional generative answers** — **Gemini** when `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` is set (default model `gemini-2.5-flash`, overridable via `GEMINI_MODEL`); otherwise **Hugging Face** when `HUGGINGFACE_API_KEY` / `HF_TOKEN` is set. **Canned help** for common “how do I…” questions without any API key.
- **Presentation privacy** — **Hide grades** toggle in the site header; grades and term GPAs shown as neutral labels (e.g. “Completed”, “Hidden”); selected **advisor readiness alerts** (grade/GPA-related) are sanitized while checks still run. Wired through **Academic** views, **Degree requirements** tables, import summary, and **Course scheduler** academic surfaces via `PresentationPrivacyProvider` in `app/providers.tsx`.
- **CS advising logic** — **Natural sciences** readiness simplified to **PHY 211 + CHE 106** (8 cr track); **ECS / Math / Science GPA (2.0)** alert from a defined course subset; expanded **minimum C−** policy course list; **graduation path timeline** labels updated (e.g. CHE 106, IST 344, clearer MAT choice and upper-division note).
- **Course catalog pipeline** — `parse-saved-class-search-responses.cjs` gains **`--inputs-dir`** to batch all `.xml` files in a folder; new **subject export XMLs** under `scripts/` (e.g. ANT, CHE, CSE, FYS, HST, IST, MAT, PHI, PHY, PSY, SOC, WRT) feed refreshed **`public/data/courses.json`**, offerings JSON/JSONL, and aligned **`courses.from_saved_responses.json`** / **`cs_graduation_requirements.json`** updates.

## Technical highlights

| Area | Description |
|------|-------------|
| Assistant routing | Ordered handling: catalog Q&A (lookup + semester) → schedule engine → `matchHelpAnswer` → Gemini → Hugging Face → capability fallback message. |
| Schedule engine | Regex extraction of dept/course numbers, optional Friday and 6 PM end constraints, DFS with `hasConflict` / `parseDaysTimes` from `lib/schedule-utils.ts`. |
| Gemini integration | `@google/generative-ai`, chat history mapped to Gemini roles, system primer tuned for planner focus **and** brief off-topic factual replies (e.g. simple arithmetic). |
| Privacy | `lib/presentation-privacy.ts` centralizes grade/GPA formatting and alert sanitization; React context persists preference in `localStorage`. |
| Data refresh | Large diffs in `public/data/*` from reconciled scraper/saved-response pipeline; keeps planner search aligned with latest exported offerings snapshot. |

## Key paths (unpushed / new)

| Path | Role |
|------|------|
| `app/api/assistant/chat/route.ts` | Assistant API entry. |
| `components/schedule-assistant-chat.tsx` | Sheet UI + apply suggestion. |
| `lib/assistant-schedule-engine.ts` | Constraints + `solveSchedule`. |
| `lib/assistant-catalog-lookup.ts` | Room/time/instructor + term overlap answers. |
| `lib/assistant-gemini.ts` | Gemini client helper. |
| `lib/assistant-help.ts` | Canned help + shared LLM system primer. |
| `components/presentation-privacy-provider.tsx`, `presentation-privacy-toggle.tsx`, `lib/presentation-privacy.ts` | Demo mode. |
| `lib/graduation-readiness.ts`, `lib/cs-graduation-path.ts` | CS checks + roadmap copy. |
| `scripts/parse-saved-class-search-responses.cjs`, `scripts/*-20*-all.xml` | Catalog ingestion inputs and tooling. |

## Outcomes for users

Advisors can **ask the assistant** for catalog facts, **sanity-check a term** against meeting dates (with MySlice called out as authoritative), **sketch schedules from plain language**, and optionally get **short generative answers** when API keys are configured. **Presentation mode** reduces accidental exposure of letter grades and numeric GPA on screen during demos, while **graduation messaging** and **course data** better match the CS reference path and current offerings snapshot.

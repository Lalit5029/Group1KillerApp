# Sprint 5: Tests for Requirements API and Requirements Loader — Work Done by Me

This document describes the tests added in Sprint 5.

---

## 1. Tests for the Requirements API route

I added Jest tests for the **GET `/api/requirements`** route so we can safely evolve the scraper output and transformation logic.

- **File:** `app/api/requirements/route.test.ts`
- **What is tested:**
  - **Valid file → transformed scheduler format**
    - Mocks `fs.existsSync` + `fs.readFileSync` to pretend `backend/data/ecs_requirements_cleaned.json` exists with a small sample array:
      - `program: "Computer Science"` with categories like `"First Year, Fall Semester"` and a non-year (e.g. `"Upper Division Elective"`).
    - Calls `GET()` and asserts:
      - Status is **200**.
      - Response is keyed by `"Computer Science, BS"`.
      - The value for that key has `Freshman`, `Sophomore`, `Junior`, `Senior` arrays.
      - The “First Year …” category maps into `Freshman`, and non-year categories (like electives) are added to all years.
  - **Missing file → 404 with scraper hint**
    - Mocks `fs.existsSync` to return `false`.
    - Asserts response status is **404** and the `error` string:
      - Mentions `Requirements data file not found`.
      - Includes the hint to run the scraper (`Run the scraper: cd backend && python3 src/scrapers/ecs_requirements_scraper.py`).
  - **Bad JSON/shape → 500 with clear error**
    - Mocks `fs.existsSync` to return `true` but returns a non-array JSON root.
    - Asserts status **500** and `error` contains `Invalid requirements data format`.

---

## 2. Tests for the requirements loader helper (`fetchRequirements`)

I added unit tests for the **client-side requirements loader** so we don’t accidentally break the API + fallback behavior.

- **File:** `lib/data-utils.test.ts`
- **What is tested:**
  - **Happy path: `/api/requirements` succeeds**
    - Mocks `global.fetch` so the **first call** to `/api/requirements` returns `ok: true` with example data.
    - Asserts:
      - `fetch` is called once with `"/api/requirements"`.
      - `fetchRequirements()` returns exactly the API JSON.
  - **Fallback: `/api/requirements` fails, static JSON succeeds**
    - First mocked call: `/api/requirements` with `ok: false`.
    - Second mocked call: `/data/engineering_majors_requirements.json` with `ok: true` and example data.
    - Asserts:
      - `fetch` is called twice, in order:
        1. `"/api/requirements"`
        2. `"/data/engineering_majors_requirements.json"`
      - The returned value matches the static JSON.
  - **Both API and static JSON fail → empty object**
    - First mocked call: `/api/requirements` `ok: false`.
    - Second mocked call: static JSON `ok: false`.
    - Asserts `fetchRequirements()` returns `{}` so the UI code has a safe default.

---

## Summary

| What | Where |
|------|-------|
| Requirements API route tests (valid file, missing file, bad shape) | `app/api/requirements/route.test.ts` |
| Client requirements loader tests (API, fallback, both fail) | `lib/data-utils.test.ts` |


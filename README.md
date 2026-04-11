# Group1KillerApp

Advisor-focused course planning application built with Next.js, Prisma, MongoDB Atlas, and a deterministic recommendation layer.

The app supports:
- advisor login
- advisor-owned student records
- student-specific academic data and schedules
- MySlice academic record import
- rule-based course recommendation
- schedule generation from the live course catalog

## What The App Does

The intended workflow is:
1. advisor logs in
2. advisor selects a student
3. the app loads that student's saved academic history, degree data, and planned schedule
4. the advisor can:
   - import academic records from MySlice
   - review degree requirements
   - search and add courses manually
   - generate suggested courses
   - build a schedule from recommended courses

Important:
- schedules, academic courses, and degree requirements are stored under the selected `Student`
- the logged-in `User` is the advisor account
- data is associated by references in MongoDB, not embedded nested documents

## Current Architecture

High-level flow:

1. `User` logs in with NextAuth
2. advisor selects a `Student`
3. transcript + degree data + catalog + requirements are loaded
4. a deterministic recommender evaluates next-course options
5. ranked recommendations are passed into the existing schedule generator
6. the schedule generator still handles:
   - section selection
   - conflict detection
   - credit limits
   - room/time placement

The recommender does not replace schedule generation. It improves which courses are recommended first.

## Main Features

- Advisor/student workflow
- Student picker after login
- Student-scoped schedule persistence
- Student-scoped academic record persistence
- Degree requirement tracking
- MySlice academic import
- Course search and add
- Suggested courses with workload selection
- Weekly calendar schedule view
- Image import for schedules
- Deterministic recommendation reasoning

## Tech Stack

- Frontend: Next.js, React, TypeScript
- UI: Tailwind CSS, shadcn/ui
- Authentication: NextAuth.js
- Database: Prisma + MongoDB Atlas
- Browser automation: Puppeteer
- HTML parsing: Cheerio
- OCR: Tesseract.js
- Recommendation layer: TypeScript deterministic rules

## Project Data Model

The app is modeled like this:

```text
User (advisor)
  -> Student
      -> SelectedCourse
      -> AcademicCourse
      -> DegreeRequirement
```

Meaning:
- `User` is the advisor account
- `Student` belongs to a `User`
- each `Student` owns their own imported academic data, degree data, and planned courses

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

Required values:

```env
DATABASE_URL="mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/group1killerapp?retryWrites=true&w=majority"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret"
```

Optional:

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

Generate a secret with:

```bash
openssl rand -base64 32
```

### 3. Prepare the database

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Start the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Seeded Demo Account

If the seed succeeds, use:

```text
Email: demo@group1.local
Password: demo123
```

## Common Commands

Run app:

```bash
npm run dev
```

Run academic scraper API:

```bash
npm run api
```

Generate Prisma client:

```bash
npm run db:generate
```

Push schema:

```bash
npm run db:push
```

Seed demo data:

```bash
npm run db:seed
```

Run recommendation tests:

```bash
npm test -- --runTestsByPath lib/recommendation/build-recommendation-payload.test.ts lib/recommendation/rank-recommendations.test.ts
```

## Authentication Notes

- the app now defaults to `/login`
- unauthenticated users should be redirected to login before using protected pages
- authenticated advisors are expected to choose a student before using the scheduler

## Student Workflow Notes

Good to know:
- each student has isolated data
- switching students should switch context, not merge data
- imported academic records and degree requirements are saved under the student
- suggested courses should be based on the selected student only

## MySlice Import Notes

The MySlice flow is manual-login friendly.

Important behavior:
- the user should log into real `https://myslice.ps.syr.edu`
- do not manually open copied Microsoft SSO links
- raw Microsoft login links can fail with SAML errors like `AADSTS750054`

Recommended flow:
1. click import
2. if prompted, open MySlice directly
3. complete login and any 2FA there
4. return to the app
5. let the scraper continue

Known caveats:
- PeopleSoft/MySlice can reject deep-linked components depending on account permissions
- some accounts may see authorization errors like:
  - `You are not authorized to access this component (40,20)`
- when that happens, the issue is usually MySlice authorization, not MongoDB or NextAuth

## Course Recommendation Flow

Current recommendation pipeline:

1. load selected student transcript
2. load saved degree requirement blocks
3. load major requirement plan
4. load course catalog
5. build a recommendation payload
6. run the deterministic reasoner
7. rank recommendations
8. pass recommended courses into the existing scheduler

The recommendation output includes:
- recommended courses
- blocked courses
- reasons
- missing prerequisites
- priority score

## Recommendation Notes

The app now uses a deterministic recommendation layer built from:
- structured CS program rules
- transcript-aware degree-progress evaluation
- explicit candidate pools
- prerequisite / offering checks

Important:
- the recommender is not the scheduler
- it chooses and ranks candidate courses before timetable generation

### Recommendation logic priorities

The recommender is now more focused on closest path to graduation than simple academic year.

It prioritizes:
- unfinished degree requirements
- courses the student is eligible to take now
- courses offered this term
- bottleneck courses
- courses that unlock future required courses

Academic year is only a secondary hint, not the main driver.

## Current Recommendation Debugging Tips

If `/api/recommendations` returns:

```json
{
  "recommendedCourses": [],
  "blockedCourses": [],
  "debug": {
    "engine": "fallback",
    "candidateCount": 0
  }
}
```

that means:
- the deterministic recommender ran
- but there were no candidate courses to reason over

Possible reasons:
- the student may already be near completion
- remaining requirements may not map to concrete course codes
- remaining work may be electives or buckets not yet represented in the data

The deterministic TypeScript reasoner is the active recommendation engine.

## Troubleshooting

### NextAuth configuration error

If you see:
- `NO_SECRET`
- `NEXTAUTH_URL` warnings

make sure `.env` includes:

```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret"
```

### MongoDB connection issues

If Prisma cannot connect:
- verify `DATABASE_URL`
- make sure your Atlas database user is correct
- make sure your Atlas network access allows your IP
- for development, `0.0.0.0/0` can be used temporarily

### Login fails even with correct password

Possible causes:
- user was never created
- seed failed
- database connection is pointed at the wrong cluster/database

Try:

```bash
npm run db:seed
```

### Suggested courses look wrong

Check:
- selected student
- imported transcript data
- degree requirements for that student
- whether the active student data and requirement mappings are accurate

### MySlice import seems stuck

Check:
- `npm run api` is running if you rely on the separate scraper API
- you completed login in the real MySlice flow
- PeopleSoft did not block the requested component

## Testing Notes

Focused tests currently exist for the recommendation layer:
- ranking behavior
- candidate filtering
- completed/in-progress exclusion
- degree requirement prioritization

Run:

```bash
npm test -- --runTestsByPath lib/recommendation/build-recommendation-payload.test.ts lib/recommendation/rank-recommendations.test.ts
```

## Good Things To Know Before Editing

- recommendation and schedule generation are intentionally separate
- student data is scoped by `studentId`
- advisor context is scoped by authenticated `user`
- recommendation output is converted into ranked TypeScript objects before scheduling
- recommendation and scheduling are intentionally separate so ranking changes do not rewrite timetable construction

## Suggested Next Improvements

- improve requirement modeling for electives and one-of groups
- improve graph export styling for easier visualization
- expose recommendation engine/debug info directly in the UI for advisors
- add more major-specific prerequisite data to the dependency catalog

# Sprint 2: MongoDB Database Setup — Report

This document reports everything we did in Sprint 2 to get the MongoDB database running and to make it clear for our team and for testing. 

---

## 1. Deciding on MongoDB Atlas

We chose **MongoDB Atlas** (cloud) so that everyone on the team can run the app without installing MongoDB locally. The database lives in the cloud and we connect to it with a connection string.

---

## 2. Setting up MongoDB Atlas

We did the following in [MongoDB Atlas](https://www.mongodb.com/cloud/atlas):

- Created an account and signed in.
- Created a **cluster** (we used the free M0 tier).
- Created a **database user** (username and password) and noted them down.
- In **Network Access**, we allowed access (e.g. “Allow Access from Anywhere” for development).
- We got the **connection string** from the cluster’s “Connect” → “Connect your application.”
- We made sure the connection string included a **database name** (e.g. `group1killerapp`) after the host, before any `?` (e.g. `...mongodb.net/group1killerapp?retryWrites=...`). Without this, Prisma gives an error.

---

## 3. Configuring the project to use MongoDB

- We updated the **Prisma schema** (`prisma/schema.prisma`) to use MongoDB:
  - Set `provider = "mongodb"` and `url = env("DATABASE_URL")`.
  - Changed all model IDs to use `@id @default(auto()) @map("_id") @db.ObjectId`.
  - Added `@db.ObjectId` to all relation fields (e.g. `userId`).
- We created a **`.env`** file in the project root (the app reads `.env`, not `.env.example`).
- We set **`DATABASE_URL`** in `.env` to our full Atlas connection string, including the database name.
- We set **`NEXTAUTH_SECRET`** in `.env` (we generated a random string, e.g. with `openssl rand -base64 32`).
- We added **`.env.example`** so the group could copy it and fill in their own values.

---

## 4. Fixing dependency and install issues

- We removed **`@tensorflow/tfjs-node`** from `package.json` because it conflicted with other packages during `npm install`.
- We updated **`vaul`** to `^1.1.0` so it works with React 19.
- We added a **`.npmrc`** file in the project root with `legacy-peer-deps=true` so `npm install` completes without peer dependency errors on this older project.

---

## 5. Database and seed setup

- We added **`prisma/seed.js`** to create a demo user and sample academic courses and degree requirements when we run the seed.
- We added scripts to **`package.json`**:
  - `db:generate` – generates the Prisma client
  - `db:push` – creates/updates the database and collections in Atlas
  - `db:seed` – runs the seed script
  - and we configured the Prisma seed command so `npx prisma db seed` works.
- We fixed the **degree-requirements API** to use `prisma.degreeRequirement` (camelCase) so it works with the generated client.

---

## 6. Commands we run to get the database ready

We run these from the project root, in order:

1. **`npx prisma generate`** – generates the Prisma client for MongoDB.
2. **`npx prisma db push`** – creates the database and all collections in Atlas (we make sure `DATABASE_URL` in `.env` includes the database name).
3. **`npm run db:seed`** – inserts the demo user and sample data (optional but useful for testing).

After that, we start the app with **`npm run dev`** and can test the database.

---

## 7. Testing that the database works

- We added a **`GET /api/demo-progress`** route that returns the demo user’s courses and degree requirements from MongoDB (no login required).
- We added a **`/dashboard`** page that calls that API and shows total credits, courses, and requirement categories so we can confirm data is coming from MongoDB.
- We can log in with the demo user (**demo@group1.local** / **demo123**) and use the app; we also added a clear way to load and save schedule data (see below).

---

## 8. Manual Load and Save to database

We decided to use **manual** “Load from database” and “Save to database” buttons instead of automatic load on login and automatic save when courses change. That way:

- Teammates can clearly see when data is loaded from or saved to MongoDB.
- We avoid accidental overwrites and duplicate loads when switching tabs.
- The database flow is explicit for demos and reports.

What we implemented:

- We **removed** the automatic load of saved courses on login and the automatic save whenever the schedule changed.
- We added two buttons in the **Course Scheduler** tab (only visible when logged in):
  - **Load from database** – fetches the user’s saved courses from the API and updates the schedule. Shows “Loading…” while running and a toast when done.
  - **Save to database** – sends the current schedule to the API and saves it to MongoDB. Disabled when there are no courses. Shows “Saving…” and a success or error toast.
- We added a short note next to the buttons: “Logged in — load/save your schedule to MongoDB.”

So for testing: we log in (e.g. demo@group1.local / demo123), then we click **Load from database** to load our saved schedule, and **Save to database** to save the current schedule. No automatic load or save.

---

## 9. Fixes we made while using the app

- **Tab switch duplicating courses:** When we switched browser tabs and came back, courses were loading again and appearing twice. We fixed this by setting **`refetchOnWindowFocus={false}`** on the NextAuth `SessionProvider` in `app/providers.tsx`. After we moved to manual Load/Save buttons, we no longer depend on automatic load on session change, so this issue is also addressed by the new flow.
- **Hydration warning in the console:** We added **`suppressHydrationWarning`** to the `<body>` in `app/layout.tsx` because browser extensions were changing the HTML and causing a React hydration mismatch.

---

## 10. Helping teammates and future deployment

- We added **`docs/ENV_AND_TEAM_AND_PRODUCTION.md`** to explain:
  - How teammates get `.env` (we don’t push it; they copy `.env.example` to `.env` and either use a shared Atlas connection string we send out of band, or each person creates their own Atlas cluster).
  - How production will work (we set `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` as environment variables on the hosting platform; the app reads them the same way).
- We added a short **banner on the home page** that tells users how to test the database: open **Dashboard** (data from MongoDB, no login) or log in with **demo@group1.local** / **demo123**, and to run **`npm run db:seed`** first if they see no data.

---

## 11. Resetting the database when we want to start fresh

We can do either of the following:

- **Option A:** In the Atlas UI, we go to our cluster, find the database (e.g. `group1killerapp`), and **Drop Database**. Then we run **`npx prisma db push`** and optionally **`npm run db:seed`** again.
- **Option B:** We run a script that uses Prisma to delete all records from every collection (in the correct order), then run **`npm run db:seed`** again if we want demo data.

---

## 12. Documentation we added or updated

- **`docs/MONGODB_SETUP.md`** – step-by-step MongoDB Atlas setup (account, cluster, user, connection string, `.env`, and the commands above).
- **`docs/ENV_AND_TEAM_AND_PRODUCTION.md`** – how teammates get `.env` and how production environment variables work.
- **`README.md`** (project root) – we updated the database section to say we use MongoDB Atlas and pointed to the setup doc and the need for `DATABASE_URL` and the three commands (generate, push, seed).

---

## Summary checklist (Sprint 2)

- [ ] MongoDB Atlas account and cluster created  
- [ ] Database user and network access configured  
- [ ] Connection string includes the database name (e.g. `/group1killerapp?...`)  
- [ ] `.env` has `DATABASE_URL` and `NEXTAUTH_SECRET`  
- [ ] `npx prisma generate` and `npx prisma db push` run without errors  
- [ ] `npm run db:seed` run (if we want demo data)  
- [ ] **Load from database** and **Save to database** buttons used when logged in to test read/write  
- [ ] `/dashboard` or login with demo user confirms data from MongoDB  

Once the above are done, our MongoDB database is set up and we can run and test the app against it. This document reflects everything we did in Sprint 2 for our report.

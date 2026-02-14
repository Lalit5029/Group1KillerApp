# MongoDB Atlas Setup

This app uses **MongoDB Atlas** (cloud) so anyone can run it without installing MongoDB locally.

---

## 1. Create an Atlas account and cluster

1. Go to **[mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)** and sign up (free).
2. Click **“Build a Database”**.
3. Choose **M0 (FREE)** and a region near you → **Create**.
4. Wait for the cluster to finish provisioning.

---

## 2. Create a database user

1. In the left sidebar: **Security** → **Database Access** → **Add New Database User**.
2. **Authentication:** Password.
3. Set a **username** and **password**. Store them somewhere safe (you’ll need them for the connection string).
4. **Database User Privileges:** “Atlas admin” or “Read and write to any database”.
5. Click **Add User**.

---

## 3. Allow network access

1. **Security** → **Network Access** → **Add IP Address**.
2. For an app others will run: use **“Allow Access from Anywhere”** (`0.0.0.0/0`).  
   (For production you’d restrict to specific IPs.)
3. Confirm.

---

## 4. Get the connection string

1. Go to **Database** → your cluster → **Connect**.
2. Choose **“Connect your application”**.
3. Copy the connection string. It looks like:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace **`<username>`** and **`<password>`** with your database user.  
   If the password contains **`@`**, **`#`**, or **`%`**, URL-encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `%` → `%25`
5. Add the **database name** before the `?`: use **`group1killerapp`** (or any name you like).  
   Final form:
   ```text
   mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/group1killerapp?retryWrites=true&w=majority
   ```

---

## 5. Configure the app

The app loads **`.env`** only — it does **not** read `.env.example`. So you must have a real **`.env`** file with your values.

In the **project root** (same folder as `package.json`):

1. Copy the template and then edit the **copy** (not the template):
   ```bash
   cp .env.example .env
   ```
2. Open **`.env`** and set **`DATABASE_URL`** to your full connection string:
   ```env
   DATABASE_URL="mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/group1killerapp?retryWrites=true&w=majority"
   ```
   Use your real username, password, and cluster host. No spaces around `=`.

---

## 6. Generate Prisma client and create collections

From the **project root**:

```bash
npx prisma generate
npx prisma db push
```

- **generate** – builds the Prisma client for MongoDB.
- **db push** – creates the database and collections in Atlas from `prisma/schema.prisma`.

---

## 7. (Optional) Seed demo data

```bash
npm run db:seed
```

This creates a demo user and sample courses/requirements. Demo login: **demo@group1.local** / **demo123**.

---

## 8. Run the app

```bash
npm run dev
```

Open **http://localhost:3000**. For demo data, open **http://localhost:3000/dashboard**.

---

## For others using this app

Each person (or deployment) needs their own **Atlas cluster** (or shared cluster + database user) and their own **`.env`** with **`DATABASE_URL`**. They should:

1. Follow steps 1–5 to get a connection string and set `DATABASE_URL` in `.env`.
2. Run `npx prisma generate`, `npx prisma db push`, and optionally `npm run db:seed`.
3. Run `npm run dev`.

No local MongoDB install is required; everything uses Atlas.

---

## Checklist: “Will it run? Is the database done?”

- [ ] **`.env` exists** in the project root (copy of `.env.example` with real values). The app does **not** read `.env.example`.
- [ ] **`DATABASE_URL`** in `.env` is your full Atlas connection string (with real username, password, and cluster host).
- [ ] **`NEXTAUTH_SECRET`** is set in `.env` (any long random string; e.g. `openssl rand -base64 32`).
- [ ] You ran **`npx prisma generate`** (generates the client for MongoDB).
- [ ] You ran **`npx prisma db push`** (creates the database and collections in Atlas).
- [ ] Optional: **`npm run db:seed`** (adds demo user and sample data).

Then **`npm run dev`** should run without database errors, and the MongoDB part is done.

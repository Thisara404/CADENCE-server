# Cadence Server — Backend REST API & Supabase Setup Guide

Cadence Server is an enterprise REST backend built with **NestJS 10**, **Prisma ORM 5**, **Supabase PostgreSQL**, **JWT Authentication**, and **Google Gemini GenAI**, deployed to **Vercel** with full local development support.

---

## Architecture Overview

* **Backend Framework**: NestJS 10 (TypeScript)
* **Database**: **Supabase PostgreSQL** via direct connection URI (No Docker needed)
* **ORM & Query Engine**: Prisma 5 with automated client generation
* **Deployment**: **Vercel Cloud** (`https://cadence-server-j78w.vercel.app`) or Local Node.js runtime (`http://localhost:5000`)
* **Frontend Integration**: Next.js client deployed on Vercel or running locally

---

## Prerequisites

* **Node.js**: v18.18.0 or newer (v20+ recommended)
* **Package Manager**: `npm` (v9+)
* **Supabase Project**: Free or paid Supabase account with an active PostgreSQL project

---

## 1. Installing Dependencies

From the `server` directory:

```bash
cd server
npm install
```

> [!NOTE]
> `npm install` automatically executes the `postinstall` script (`prisma generate`), compiling the Prisma Client with both local and production Linux query engines (`rhel-openssl-3.0.x`).

---

## 2. Running Database (Supabase PostgreSQL Direct URL)

No Docker installation or local database container is needed. Cadence connects directly to **Supabase PostgreSQL**:

### A. Get Your Supabase Direct Connection URL
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project, go to **Project Settings → Database**.
3. Under **Connection String**, select **URI**:
   * Use the **Direct connection** string (port `5432`):
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```
   *(Replace `[YOUR-PASSWORD]` with your Supabase database password and `[PROJECT-REF]` with your project reference ID).*

### B. Configure Environment Variables
Create or update your `.env` file in the `server` directory:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
JWT_SECRET="cadence-super-secret-jwt-key-2026"
JWT_EXPIRATION="7d"
GEMINI_API_KEY="your-google-gemini-api-key"
CLIENT_URL="http://localhost:3000"
```

---

## 3. Database Migration, Seeding & Inspection

Once your `DATABASE_URL` is set in `.env`, run the following commands from the `server` folder:

### Push Schema Directly to Supabase
```bash
npx prisma db push
```
This syncs your Prisma schema ([`prisma/schema.prisma`](./prisma/schema.prisma)) with your Supabase PostgreSQL database, creating all tables (`users`, `reports`, `report_versions`, `task_items`, `projects`, `review_comments`), enums, indexes, and relations.

### Seed Demo Accounts & Reports
```bash
npm run seed
```
This initializes your Supabase database with:
* **Root Administrator**: `admin@cadence.com`
* **Engineering Manager**: `manager@company.com`
* **3 Team Members**: `alex@company.com`, `dana@company.com`, `marcus@company.com`
* **4 Work Categories**: Strategic tracks & client projects
* **7 Historical Weekly Reports**: Filled with tasks, blockers, achievements, and review feedback.

### Visual Database GUI (Prisma Studio)
Inspect and manage your Supabase database visually:
```bash
npx prisma studio
```
Opens Prisma Studio on **[http://localhost:5555](http://localhost:5555)**, connected directly to your live Supabase database.

---

## 4. Running Backend

### Local Development Mode (with Live Reload)
```bash
npm run start:dev
```
The NestJS API starts on: **[http://localhost:5000/api](http://localhost:5000/api)**.

### Production Build & Local Preview
```bash
npm run build
npm run start:prod
```

---

## 5. Deploying Server to Vercel / Cloud

The backend is configured for cloud hosting on Vercel or any Node.js hosting platform:
1. Push your `server` repository to GitHub (`https://github.com/Thisara404/CADENCE-server.git`).
2. In the **Vercel Dashboard**, open your project (`cadence-server-j78w`).
3. In **Settings → Environment Variables**, add the following:
   * **`DATABASE_URL`**: Your Supabase direct PostgreSQL URL (`postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)
   * **`JWT_SECRET`**: A secure random secret key
   * **`GEMINI_API_KEY`**: Google Gemini API key for AI assistant features
   * **`CLIENT_URL`**: Your deployed frontend URL (e.g. `https://cadence-beta-thisara.vercel.app` or `http://localhost:3000`)
4. Click **Redeploy** (or push a commit to `main`).
   * *Prisma Client automatically generates during build via `postinstall` and `build` scripts.*

---

## 6. Connecting with the Frontend & Health Checks

### CORS Configuration
Configured in [`src/main.ts`](./src/main.ts) to automatically accept cross-origin requests from:
* Local development: `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`
* Any Vercel deployment ending with **`*.vercel.app`** (both production domain and pull request previews)
* The custom domain specified in `CLIENT_URL`

### Global API Namespace
All functional routes are prefixed with `/api`:
* Auth: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
* Reports: `/api/reports`, `/api/reports/history`, `/api/reports/draft`, `/api/reports/:id/submit`
* Projects: `/api/projects`
* Users: `/api/users`, `/api/users/me/profile`, `/api/users/me/change-password`
* Dashboard: `/api/dashboard/summary`, `/api/dashboard/charts`, `/api/dashboard/blockers-and-achievements`
* AI: `/api/ai/chat`

### Health Check & Diagnostic Endpoints
Available for uptime monitors and browser inspection:

| URL Path | Response | Description |
| :--- | :--- | :--- |
| `GET /` | `200 OK` | Service metadata & active routes directory |
| `GET /api` | `200 OK` | API namespace metadata |
| `GET /health` | `200 OK` | Supabase DB connectivity test (`SELECT 1`) & uptime |
| `GET /api/health` | `200 OK` | Health endpoint under standard `/api` route |

---

## Default Seeded Accounts

All seeded Supabase accounts are configured with default password: **`password123`**:

| Role | Name | Email | Password | Primary Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Root Admin** | Cadence Admin | `admin@cadence.com` | `password123` | Full governance, all password resets, role assignment |
| **Manager** | Sarah Kim | `manager@company.com` | `password123` | Team oversight, report approvals/feedback, blockers triage |
| **Team Member** | Alex Chen | `alex@company.com` | `password123` | Report drafting & submission (restricted from review) |
| **Team Member** | Dana Lee | `dana@company.com` | `password123` | Report drafting & submission (restricted from review) |
| **Team Member** | Marcus Vance | `marcus@company.com` | `password123` | Report drafting & submission (restricted from review) |

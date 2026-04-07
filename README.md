# Discussions

`Where ideas become insight`

Discussions is a topic-based anonymous discussion platform where live conversations run in timed phases, lock when the timer ends, and become reusable insight summaries that can be revived later.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL on Supabase
- Hosting: Vercel for the frontend, Render for the backend
- AI: placeholder summary service with a clean upgrade path for an LLM later

## What The App Does

- Create topic-based discussions with tags and an intent
- Let people join anonymously with generated identities
- Run each conversation inside a timed phase
- Lock the phase when time expires
- Preserve the discussion as an insight summary
- Reopen the same discussion as Phase 2, Phase 3, and beyond

## Prerequisites

- Node.js 22+
- npm
- Optional for persistence: a Supabase Postgres database

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

### 3. Choose how you want to run locally

Option A: full local setup with Postgres persistence

1. Put your Supabase Postgres connection string in `DATABASE_URL`.
2. `SUPABASE_DB_URL` is also supported as a fallback, but `DATABASE_URL` is preferred.
3. Apply the schema:

```bash
npm run db:setup
```

Option B: quick UI preview with no database

- Leave `DATABASE_URL` empty.
- The app will run in memory mode.
- Data will reset whenever the server restarts.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` starts the Express server in development mode and serves the Vite frontend through middleware
- `npm run build` builds the client to `dist/client` and the backend to `dist/server`
- `npm run start` runs the production build
- `npm run check` runs TypeScript checks
- `npm run db:setup` applies `server/db/schema.sql` to your configured Postgres database

## Free Hosting Plan

This project is set up to deploy for free with:

- [Supabase Free](https://supabase.com/pricing) for PostgreSQL
- [Render Free Web Service](https://render.com/free) for the Express backend
- [Vercel Hobby](https://vercel.com/docs/accounts/plans) for the React frontend

## Recommended Deployment Order

1. Push this project to GitHub.
2. Create the Supabase database.
3. Deploy the backend on Render.
4. Deploy the frontend on Vercel.
5. Update the backend CORS settings with the final Vercel URL.
6. Run a quick smoke test.

## Step-By-Step Free Deployment

### 1. Push the repo to GitHub

Vercel and Render are easiest to configure from a GitHub repository.

### 2. Create a free Supabase project

1. Create a project in Supabase.
2. Open `Project Settings -> Database`.
3. Copy the Postgres connection string.
4. Make sure it includes SSL, for example:

```text
postgresql://postgres:password@host:5432/postgres?sslmode=require
```

5. Apply the schema using one of these options:

```bash
npm run db:setup
```

or paste [`server/db/schema.sql`](server/db/schema.sql) into the Supabase SQL editor.

### 3. Deploy the backend on Render

This repo already includes [`render.yaml`](render.yaml), so you can use either:

- Blueprint deploy
- Manual web service setup

Blueprint deploy:

1. In Render, click `New -> Blueprint`.
2. Connect your GitHub repo.
3. Confirm the service settings from `render.yaml`.

Manual setup:

- Service type: `Web Service`
- Runtime: `Node`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`
- Instance Type: `Free`

Set these environment variables on Render:

- `NODE_ENV=production`
- `DATABASE_URL=<your-supabase-postgres-url>`
- `FRONTEND_URL=<your-vercel-url>`
- `CORS_ORIGINS=<your-vercel-url>`

Notes:

- You can leave `FRONTEND_URL` and `CORS_ORIGINS` blank for the first deploy, then update them after Vercel gives you the final frontend URL.
- The backend health check will be available at `https://your-service.onrender.com/api/health`.

### 4. Deploy the frontend on Vercel

This repo already includes [`vercel.json`](vercel.json).

1. Import the GitHub repo into Vercel.
2. If Vercel asks for project settings, use:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist/client`

3. Add this environment variable:

- `VITE_API_BASE_URL=https://your-service.onrender.com`

4. Deploy the project.

Your frontend will be hosted at a URL like:

```text
https://your-project.vercel.app
```

### 5. Reconnect the backend to the final frontend URL

After Vercel finishes deploying:

1. Open your Render service settings.
2. Set:

- `FRONTEND_URL=https://your-project.vercel.app`
- `CORS_ORIGINS=https://your-project.vercel.app`

3. Redeploy the backend.

### 6. Smoke test the live app

Check all of these before you share the link:

- the Vercel frontend loads
- `https://your-service.onrender.com/api/health` returns `ok: true`
- anonymous user bootstrap works
- creating a discussion works
- opening a discussion works
- completed discussions appear in the Insights Library
- reviving a discussion creates a new phase

## Free Tier Notes

- Render says free web services spin down after 15 minutes of inactivity, so the first request after idle can take a little longer. See [Render Free](https://render.com/free).
- Vercel documents the Hobby plan as a free plan for personal projects and developers. See [Vercel account plans](https://vercel.com/docs/accounts/plans).
- Supabase documents a free plan suitable for small demos and MVPs, with current limits and project counts listed on their pricing pages. See [Supabase Pricing](https://supabase.com/pricing) and [Supabase billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase).

## Important Files

- App shell: [`client/App.tsx`](client/App.tsx)
- Home page: [`client/pages/ExplorePage.tsx`](client/pages/ExplorePage.tsx)
- Discussion page: [`client/pages/DiscussionPage.tsx`](client/pages/DiscussionPage.tsx)
- Insights page: [`client/pages/InsightsPage.tsx`](client/pages/InsightsPage.tsx)
- Backend entry: [`server/index.ts`](server/index.ts)
- Database schema: [`server/db/schema.sql`](server/db/schema.sql)
- Deployment config: [`render.yaml`](render.yaml)
- Frontend rewrite config: [`vercel.json`](vercel.json)

## More Product Detail

For the full architecture, schema design, API contract, lifecycle notes, and implementation handoff, see [`SUBMISSION.md`](SUBMISSION.md).

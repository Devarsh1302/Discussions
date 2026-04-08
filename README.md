# Discussions

`Where ideas become insight`

Discussions is a topic-based anonymous discussion platform where timed conversations turn into reusable insight summaries and can be revived in later phases.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL (Supabase)
- Free hosting (recommended): Render web service for full app + Supabase for DB

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

3. For persistent local data, set `DATABASE_URL` in `.env` to your Supabase Postgres URL.

4. Apply schema:

```bash
npm run db:setup
```

5. Start app:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run check`
- `npm run db:setup`

## Deploy Free (No Vercel Needed)

This app already serves the built frontend from Express in production, so one Render service is enough.

### 1. Push repo to GitHub

Render will deploy from your repo branch.

### 2. Create Supabase Postgres project

1. Create a project on Supabase.
2. Copy the Postgres URL from `Project Settings -> Database`.
3. Include SSL in the URL, for example:

```text
postgresql://postgres:password@host:5432/postgres?sslmode=require
```

4. Apply schema with either:

```bash
npm run db:setup
```

or run [`server/db/schema.sql`](server/db/schema.sql) in Supabase SQL Editor.

### 3. Deploy on Render (single service)

This repo includes [`render.yaml`](render.yaml). Use Blueprint deploy:

1. In Render, click `New -> Blueprint`.
2. Connect this GitHub repo.
3. Render auto-loads service config.

If you prefer manual setup:

- Type: `Web Service`
- Runtime: `Node`
- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm run start`
- Instance Type: `Free`

Set environment variables in Render:

- `NODE_ENV=production`
- `DATABASE_URL=<your-supabase-postgres-url>`

Optional hardening after first deploy:

- `CORS_ORIGINS=https://your-render-service.onrender.com`
- `FRONTEND_URL=https://your-render-service.onrender.com`

### 4. Verify deploy

After deploy completes:

1. Open your Render URL, for example `https://discussions.onrender.com`.
2. Check health endpoint:

```text
https://discussions.onrender.com/api/health
```

3. Test key flows:

- create topic
- join discussion
- post message
- finish/lock phase
- open insights page
- revive discussion

## Free Tier Notes

- Render free web services spin down after inactivity, so first request can be slower: [Render Free](https://render.com/free)
- Supabase Free is suitable for MVP/demo traffic and has plan limits: [Supabase Pricing](https://supabase.com/pricing)

## Optional: Split Frontend + Backend Later

If you want separate hosting later, you can move frontend to Vercel and keep backend on Render, but it is not required for this project.

## Important Files

- App shell: [`client/App.tsx`](client/App.tsx)
- Home page: [`client/pages/ExplorePage.tsx`](client/pages/ExplorePage.tsx)
- Discussion page: [`client/pages/DiscussionPage.tsx`](client/pages/DiscussionPage.tsx)
- Insights page: [`client/pages/InsightsPage.tsx`](client/pages/InsightsPage.tsx)
- Backend entry: [`server/index.ts`](server/index.ts)
- Schema: [`server/db/schema.sql`](server/db/schema.sql)
- Render config: [`render.yaml`](render.yaml)

## Detailed Product Notes

For architecture, schema, API, lifecycle, and implementation handoff details, see [`SUBMISSION.md`](SUBMISSION.md).

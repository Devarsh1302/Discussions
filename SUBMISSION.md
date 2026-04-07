# Insight Discussions

## 1. System Architecture

### High-level architecture

```text
┌──────────────────────────┐
│        Vercel SPA        │
│ React + Vite + Tailwind  │
│ Explore / Discussion /   │
│ Insights pages           │
└────────────┬─────────────┘
             │ HTTPS REST
             ▼
┌──────────────────────────┐
│      Render API          │
│ Node.js + Express        │
│ - discussion routes      │
│ - service layer          │
│ - phase finalizer        │
│ - summary placeholder    │
└────────────┬─────────────┘
             │ SQL
             ▼
┌──────────────────────────┐
│   Supabase PostgreSQL    │
│ - discussions            │
│ - phases                 │
│ - messages               │
│ - users                  │
│ - votes / bookmarks      │
│ - phase participants     │
└──────────────────────────┘
```

### Data flow

1. The frontend bootstraps an anonymous user and stores the returned `deviceKey` in `localStorage`.
2. Creating a discussion inserts a `discussions` row plus an initial `phases` row.
3. Joining a discussion writes to `phase_participants`, which powers participant counts.
4. Posting a reply inserts a `messages` row tied to both the discussion and current phase.
5. Voting and bookmarking update `votes`, `bookmarks`, and cached counters on `messages`/`discussions`.
6. A periodic backend finalizer scans for expired active phases, closes them, and writes structured JSON summaries.
7. A completed discussion is surfaced in the Insights Library.
8. Reviving the discussion inserts a new `phases` row, sets it as `current_phase_number`, and reopens the topic without deleting old phases.

## 2. Database Design

The SQL implementation lives in [`server/db/schema.sql`](/C:/Users/devarsh/OneDrive/Documents/Playground/server/db/schema.sql).

### `anonymous_users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `handle` | `varchar(64)` | Auto-generated anonymous display name |
| `device_key` | `uuid` | Stable anonymous session key, unique |
| `metadata` | `jsonb` | Future-safe for profile or moderation metadata |
| `created_at` | `timestamptz` | Creation timestamp |
| `last_seen_at` | `timestamptz` | Activity tracking |

Indexes:
- `anonymous_users_last_seen_idx`
- `anonymous_users_handle_idx`

### `discussions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `slug` | `varchar(160)` | Human-friendly unique identifier |
| `title` | `varchar(180)` | Topic title |
| `prompt` | `text` | Discussion starter / framing |
| `intent` | `discussion_intent` | `debate`, `help`, `opinion`, `fun` |
| `tags` | `text[]` | Searchable tag list |
| `created_by_user_id` | `uuid` | FK -> `anonymous_users.id` |
| `current_phase_number` | `integer` | Pointer to the active/latest phase |
| `status` | `discussion_status` | `active` or `completed` |
| `total_messages` | `integer` | Cached cross-phase message count |
| `bookmark_count` | `integer` | Cached bookmark count |
| `revive_count` | `integer` | Number of revivals |
| `final_summary` | `jsonb` | Discussion-level insight summary |
| `last_activity_at` | `timestamptz` | Used for trending sorts |
| `completed_at` | `timestamptz` | When latest phase closed |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Mutation timestamp |

Indexes:
- `discussions_status_activity_idx`
- `discussions_created_at_idx`
- `discussions_tags_gin_idx`

### `phases`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `discussion_id` | `uuid` | FK -> `discussions.id` |
| `phase_number` | `integer` | Starts at 1, increments per revive |
| `duration_minutes` | `integer` | Validated between 15 and 60 |
| `status` | `phase_status` | `active` or `completed` |
| `participant_count` | `integer` | Cached participant count for the phase |
| `message_count` | `integer` | Cached message count for the phase |
| `started_at` | `timestamptz` | Phase start |
| `ends_at` | `timestamptz` | Countdown target |
| `completed_at` | `timestamptz` | Lock timestamp |
| `summary_state` | `summary_state` | `pending`, `ready`, `failed` |
| `summary_payload` | `jsonb` | Phase-level insight summary |
| `revived_from_phase_id` | `uuid` | Self-reference to previous phase |
| `created_by_user_id` | `uuid` | FK -> `anonymous_users.id` |
| `created_at` | `timestamptz` | Creation timestamp |

Constraints and indexes:
- unique `(discussion_id, phase_number)`
- partial unique index `phases_active_discussion_idx` to enforce one active phase per discussion
- `phases_discussion_order_idx`
- `phases_expiry_idx`

### `phase_participants`

| Column | Type | Notes |
| --- | --- | --- |
| `phase_id` | `uuid` | FK -> `phases.id` |
| `user_id` | `uuid` | FK -> `anonymous_users.id` |
| `joined_at` | `timestamptz` | First join timestamp for that phase |

Primary key:
- `(phase_id, user_id)`

Purpose:
- tracks participation without requiring accounts
- powers participant counts per phase
- prevents double-counting during refreshes

### `messages`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `discussion_id` | `uuid` | FK -> `discussions.id` |
| `phase_id` | `uuid` | FK -> `phases.id` |
| `author_user_id` | `uuid` | FK -> `anonymous_users.id` |
| `parent_message_id` | `uuid` | Nullable self-reference for reply context |
| `body` | `text` | 1..2000 chars |
| `upvote_count` | `integer` | Cached upvotes |
| `is_highlighted` | `boolean` | True for insight-worthy replies |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Mutation timestamp |

Indexes:
- `messages_discussion_created_idx`
- `messages_phase_created_idx`
- `messages_parent_idx`

### `votes`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `message_id` | `uuid` | FK -> `messages.id` |
| `user_id` | `uuid` | FK -> `anonymous_users.id` |
| `value` | `smallint` | Fixed to `1` for MVP upvotes |
| `created_at` | `timestamptz` | Vote timestamp |

Constraints:
- unique `(message_id, user_id)`

### `bookmarks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `discussion_id` | `uuid` | FK -> `discussions.id` |
| `user_id` | `uuid` | FK -> `anonymous_users.id` |
| `created_at` | `timestamptz` | Bookmark timestamp |

Constraints:
- unique `(discussion_id, user_id)`

### Relationships summary

- One `anonymous_user` can create many `discussions`
- One `discussion` has many `phases`
- One `phase` has many `messages`
- One `phase` has many `phase_participants`
- One `message` can have many child replies via `parent_message_id`
- One `message` has many `votes`
- One `discussion` has many `bookmarks`

### Why the phase model matters

- `discussions` stores the long-lived topic and latest aggregate insight
- `phases` stores each timed round
- reviving creates a new phase instead of mutating history
- the insights library reads from completed discussions, not deleted chat history

## 3. API Design

### `POST /api/users/bootstrap`

Request:

```json
{
  "input": {
    "deviceKey": "optional-uuid"
  }
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "handle": "Curious Otter 314",
    "deviceKey": "uuid",
    "createdAt": "2026-04-07T10:00:00.000Z",
    "lastSeenAt": "2026-04-07T10:00:00.000Z"
  }
}
```

### `POST /api/discussions`

Creates a new topic and Phase 1.

Request:

```json
{
  "input": {
    "userId": "uuid",
    "title": "Should colleges grade AI-assisted work differently?",
    "prompt": "Assume the work is honest and disclosed. What policy makes sense?",
    "intent": "debate",
    "tags": ["AI", "College", "Policy"],
    "durationMinutes": 30
  }
}
```

Response:
- `{ discussion: DiscussionDetail }`

### `GET /api/discussions`

Query params:
- `status=active|completed|all`
- `sort=trending|latest|insightful`
- `intent=debate|help|opinion|fun`
- `tag=AI`
- `q=college`
- `userId=<uuid>`
- `limit`
- `offset`

Response:
- `{ items: DiscussionCard[], meta: { limit, offset, total } }`

### `GET /api/discussions/:discussionId`

Query params:
- `userId=<uuid>` to return bookmark/upvote viewer flags

Response:
- `{ discussion: DiscussionDetail }`

### `POST /api/discussions/:discussionId/join`

Registers a viewer inside the active phase without forcing them to post first.

Request:

```json
{
  "input": {
    "userId": "uuid"
  }
}
```

Response:
- `{ discussion: DiscussionDetail }`

### `POST /api/discussions/:discussionId/messages`

Request:

```json
{
  "input": {
    "userId": "uuid",
    "body": "Colleges should reward transparent AI usage instead of banning it.",
    "parentMessageId": "optional-parent-message-uuid"
  }
}
```

Response:
- `{ discussion: DiscussionDetail }`

### `POST /api/messages/:messageId/votes`

Request:

```json
{
  "input": {
    "userId": "uuid"
  }
}
```

Response:

```json
{
  "messageId": "uuid",
  "upvoteCount": 7,
  "hasUpvoted": true
}
```

### `DELETE /api/messages/:messageId/votes?userId=<uuid>`

Removes the user upvote.

Response:
- same shape as vote creation

### `POST /api/discussions/:discussionId/bookmark`

Request:

```json
{
  "input": {
    "userId": "uuid"
  }
}
```

Response:

```json
{
  "discussionId": "uuid",
  "bookmarked": true,
  "bookmarkCount": 12
}
```

### `DELETE /api/discussions/:discussionId/bookmark?userId=<uuid>`

Response:
- same bookmark payload with `bookmarked: false`

### `POST /api/discussions/:discussionId/revive`

Request:

```json
{
  "input": {
    "userId": "uuid",
    "durationMinutes": 30
  }
}
```

Response:
- `{ discussion: DiscussionDetail }`

### `GET /api/discussions/insights/library`

Query params:
- `sort`
- `intent`
- `tag`
- `q`
- `userId`

Response:
- `{ items: DiscussionCard[], meta: { limit, offset, total } }`

## 4. Backend Structure

Actual backend folders:

```text
server/
  config/
    env.ts
  db/
    pool.ts
    schema.sql
  lib/
    http.ts
  repositories/
    discussionRepository.ts
  routes/
    discussions.ts
    users.ts
  scripts/
    runSchema.ts
  services/
    discussionService.ts
    phaseFinalizer.ts
    summaryService.ts
  index.ts
```

### Controller logic

- `routes/users.ts`
  - bootstraps or resumes an anonymous user
- `routes/discussions.ts`
  - create discussion
  - list discussions
  - fetch discussion detail
  - join phase
  - post message
  - bookmark/unbookmark
  - revive discussion
  - list completed insights
- `createMessagesRouter`
  - upvote and remove upvote

### Service layer

- `DiscussionService`
  - orchestrates validation, finalizer sync, repository access, and live summary generation
- `PhaseFinalizer`
  - scans for expired active phases every 30 seconds
  - writes phase and discussion summaries
  - flips discussions into completed mode
- `summaryService`
  - placeholder `generateSummary(messages)` implementation

### Timer handling logic

The timer is durable because expiry is stored in Postgres as `phases.ends_at`.

Implementation pattern:
- every read/write path calls `finalizer.flushExpired()`
- a background interval also scans every 30 seconds
- when a phase expires:
  - `phases.status` becomes `completed`
  - `phases.completed_at` is written
  - `phases.summary_payload` is generated
  - `discussions.status` becomes `completed`
  - `discussions.final_summary` is updated

This avoids fragile in-memory `setTimeout` logic that would break on restarts.

### Revive logic

Reviving a discussion:

1. confirms the current phase is already completed
2. inserts a new `phases` row with `phase_number + 1`
3. links it back to the prior phase via `revived_from_phase_id`
4. inserts the reviver into `phase_participants`
5. updates `discussions.current_phase_number`
6. flips `discussions.status` back to `active`

## 5. Frontend Structure

Actual frontend folders:

```text
client/
  components/
    Card.tsx
    CreateDiscussionForm.tsx
    IntentBadge.tsx
    MessageList.tsx
    PhaseTimeline.tsx
    SummaryPanel.tsx
    Timer.tsx
    TopicCard.tsx
  lib/
    api.ts
    format.ts
    router.ts
    session.ts
  pages/
    DiscussionPage.tsx
    ExplorePage.tsx
    InsightsPage.tsx
  App.tsx
  main.tsx
  styles.css
```

### Pages

- `ExplorePage`
  - active discussions feed
  - search/sort/filter controls
  - create discussion form
- `DiscussionPage`
  - topic detail
  - live timer
  - reply stream
  - bookmark / vote actions
  - summary panel
  - revive entrypoint
- `InsightsPage`
  - completed discussions library
  - latest/trending/insightful sort

### Reusable components

- `TopicCard`
  - list card for explore and insights views
- `MessageList`
  - linear reply feed with reply context and upvote control
- `SummaryPanel`
  - live summary or final insight summary
- `Timer`
  - countdown for active phases
- `PhaseTimeline`
  - cross-phase lifecycle view
- `CreateDiscussionForm`
  - topic creation UI

### State management approach

The frontend intentionally stays lightweight:

- React local state per page for forms and async status
- shared anonymous user session persisted in `localStorage`
- a small custom router in `client/lib/router.ts`
- no heavy client state library required for the MVP

## 6. Discussion Lifecycle Logic

### Active -> completed -> revived

1. A discussion is created with Phase 1 and `status = active`
2. Users join the active phase and post replies
3. When `ends_at <= now()`, the backend finalizer:
   - marks the phase completed
   - locks writes
   - writes summary JSON
   - marks the discussion completed
4. The completed discussion appears in the Insights Library
5. A user clicks revive
6. The backend creates Phase 2, Phase 3, and so on
7. Old phases remain visible in the timeline and message history

### How phases are stored

- every phase gets its own row in `phases`
- every message stores both `discussion_id` and `phase_id`
- `discussion.current_phase_number` points at the latest phase
- `revived_from_phase_id` preserves lineage

## 7. AI Summary Design

### Function shape

Implemented in [`server/services/summaryService.ts`](/C:/Users/devarsh/OneDrive/Documents/Playground/server/services/summaryService.ts):

```ts
generateSummary(messages, source)
```

### Current output format

```json
{
  "keyPoints": ["string"],
  "opinionSplit": {
    "agree": 40,
    "disagree": 35,
    "neutral": 25
  },
  "topInsights": [
    {
      "messageId": "uuid",
      "authorHandle": "Quiet Echo 412",
      "excerpt": "short message excerpt",
      "upvoteCount": 9,
      "phaseNumber": 2
    }
  ],
  "narrative": "human-readable summary",
  "generatedAt": "ISO timestamp",
  "source": "live | phase | discussion"
}
```

### Placeholder behaviour

The current implementation is deterministic and free:

- repeated-topic detection via token frequency
- opinion split via simple agreement/disagreement signals
- top insights from most-upvoted replies
- narrative sentence generation from those signals

### Future LLM upgrade path

The clean seam is already in place:

- keep the service signature the same
- replace the internals of `generateSummary`
- persist the same JSON payload shape
- optionally add `summary_state = failed` retry logic if the LLM call fails

## 8. Deployment Guide

### Supabase setup

1. Create a new Supabase project.
2. Copy the Postgres connection string from Supabase.
3. Add it to `.env` as `DATABASE_URL`.
4. Run `npm install`.
5. Run `npm run db:setup`.
6. Verify the tables exist in the Supabase SQL editor.

### Render backend deploy

1. Push the repo to GitHub.
2. Create a new Render Blueprint or Web Service.
3. Point it at [`render.yaml`](/C:/Users/devarsh/OneDrive/Documents/Playground/render.yaml).
4. Set:
   - `DATABASE_URL`
   - `FRONTEND_URL`
   - `CORS_ORIGINS`
5. Deploy the service.
6. Confirm `GET /api/health` returns `{ "ok": true }`.

### Vercel frontend deploy

1. Import the same repo into Vercel.
2. Set `VITE_API_BASE_URL` to the Render backend URL.
3. Deploy the app.
4. Keep [`vercel.json`](/C:/Users/devarsh/OneDrive/Documents/Playground/vercel.json) so direct SPA routes resolve to `index.html`.
5. Open the frontend and verify:
   - anonymous session bootstrap works
   - creating a discussion works
   - discussion detail can load directly
   - completed discussions appear in Insights Library

## MVP Notes

- The backend is structured for a real database-backed deploy, not an in-memory demo.
- The summariser is intentionally a placeholder but already isolated for future LLM replacement.
- The main remaining production step is wiring a real Supabase database and running `npm install` so the new `pg` dependency and lockfile match the rewritten codebase.

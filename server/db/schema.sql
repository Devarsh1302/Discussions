CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discussion_intent') THEN
    CREATE TYPE discussion_intent AS ENUM ('debate', 'help', 'opinion', 'fun');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discussion_status') THEN
    CREATE TYPE discussion_status AS ENUM ('active', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phase_status') THEN
    CREATE TYPE phase_status AS ENUM ('active', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'summary_state') THEN
    CREATE TYPE summary_state AS ENUM ('pending', 'ready', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS anonymous_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle VARCHAR(64) NOT NULL,
  device_key UUID NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS anonymous_users_last_seen_idx
  ON anonymous_users (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS anonymous_users_handle_idx
  ON anonymous_users (handle);

CREATE TABLE IF NOT EXISTS discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(160) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  prompt TEXT NOT NULL,
  intent discussion_intent NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_by_user_id UUID NOT NULL REFERENCES anonymous_users(id) ON DELETE RESTRICT,
  current_phase_number INTEGER NOT NULL DEFAULT 1,
  status discussion_status NOT NULL DEFAULT 'active',
  total_messages INTEGER NOT NULL DEFAULT 0,
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  revive_count INTEGER NOT NULL DEFAULT 0,
  final_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discussions_status_activity_idx
  ON discussions (status, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS discussions_created_at_idx
  ON discussions (created_at DESC);

CREATE INDEX IF NOT EXISTS discussions_tags_gin_idx
  ON discussions USING GIN (tags);

CREATE TABLE IF NOT EXISTS phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 60),
  status phase_status NOT NULL DEFAULT 'active',
  participant_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL,
  summary_state summary_state NOT NULL DEFAULT 'pending',
  summary_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  revived_from_phase_id UUID NULL REFERENCES phases(id) ON DELETE SET NULL,
  created_by_user_id UUID NOT NULL REFERENCES anonymous_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discussion_id, phase_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS phases_active_discussion_idx
  ON phases (discussion_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS phases_discussion_order_idx
  ON phases (discussion_id, phase_number DESC);

CREATE INDEX IF NOT EXISTS phases_expiry_idx
  ON phases (status, ends_at);

CREATE TABLE IF NOT EXISTS phase_participants (
  phase_id UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (phase_id, user_id)
);

CREATE INDEX IF NOT EXISTS phase_participants_user_idx
  ON phase_participants (user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES anonymous_users(id) ON DELETE RESTRICT,
  parent_message_id UUID NULL REFERENCES messages(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 2000),
  upvote_count INTEGER NOT NULL DEFAULT 0,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_discussion_created_idx
  ON messages (discussion_id, created_at ASC);

CREATE INDEX IF NOT EXISTS messages_phase_created_idx
  ON messages (phase_id, created_at ASC);

CREATE INDEX IF NOT EXISTS messages_parent_idx
  ON messages (parent_message_id);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL DEFAULT 1 CHECK (value = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS votes_user_idx
  ON votes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discussion_id, user_id)
);

CREATE INDEX IF NOT EXISTS bookmarks_user_idx
  ON bookmarks (user_id, created_at DESC);

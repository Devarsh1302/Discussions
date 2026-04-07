import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  AnonymousUser,
  DiscussionCard,
  DiscussionDetail,
  DiscussionFilters,
  DiscussionIntent,
  DiscussionMessage,
  DiscussionPhase,
  InsightSummary
} from "../../shared/types";
import { query, withTransaction } from "../db/pool";
import { HttpError } from "../lib/http";
import type {
  DiscussionDetailParts,
  DiscussionRepositoryLike,
  ExpiredPhase,
  SummaryMessage
} from "./repositoryContract";

type DiscussionRow = QueryResultRow & {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  intent: DiscussionIntent;
  tags: string[];
  status: "active" | "completed";
  current_phase_number: number;
  revive_count: number;
  total_messages: number;
  bookmark_count: number;
  created_at: string;
  last_activity_at: string;
  completed_at: string | null;
  final_summary: InsightSummary | Record<string, never>;
  created_by_user_id: string;
  created_by_handle: string;
  bookmarked: boolean;
  joined_current_phase: boolean;
  phase_id: string;
  phase_number: number;
  phase_duration_minutes: number;
  phase_status: "active" | "completed";
  phase_participant_count: number;
  phase_message_count: number;
  phase_started_at: string;
  phase_ends_at: string;
  phase_completed_at: string | null;
  phase_summary_payload: InsightSummary | Record<string, never>;
};

type PhaseRow = QueryResultRow & {
  id: string;
  discussion_id: string;
  phase_number: number;
  duration_minutes: number;
  status: "active" | "completed";
  participant_count: number;
  message_count: number;
  started_at: string;
  ends_at: string;
  completed_at: string | null;
  summary_payload: InsightSummary | Record<string, never>;
  revived_from_phase_id: string | null;
};

type MessageRow = QueryResultRow & {
  id: string;
  discussion_id: string;
  phase_id: string;
  phase_number: number;
  parent_message_id: string | null;
  author_id: string;
  author_handle: string;
  body: string;
  upvote_count: number;
  has_upvoted: boolean;
  is_highlighted: boolean;
  created_at: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function createSlug(title: string) {
  return `${slugify(title) || "discussion"}-${randomUUID().slice(0, 8)}`;
}

function isSummary(value: unknown): value is InsightSummary {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as InsightSummary).keyPoints) &&
      Array.isArray((value as InsightSummary).topInsights)
  );
}

function readSummary(value: unknown) {
  return isSummary(value) ? value : null;
}

function mapDiscussionCard(row: DiscussionRow): DiscussionCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    prompt: row.prompt,
    intent: row.intent,
    tags: row.tags ?? [],
    status: row.status,
    currentPhaseNumber: row.current_phase_number,
    reviveCount: row.revive_count,
    participantCount: row.phase_participant_count,
    messageCount: row.total_messages,
    bookmarkCount: row.bookmark_count,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    completedAt: row.completed_at,
    endsAt: row.phase_ends_at,
    summary:
      row.status === "completed"
        ? readSummary(row.final_summary)
        : readSummary(row.phase_summary_payload),
    bookmarked: row.bookmarked
  };
}

function mapPhase(row: PhaseRow): DiscussionPhase {
  return {
    id: row.id,
    discussionId: row.discussion_id,
    phaseNumber: row.phase_number,
    durationMinutes: row.duration_minutes,
    status: row.status,
    participantCount: row.participant_count,
    messageCount: row.message_count,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    completedAt: row.completed_at,
    summary: readSummary(row.summary_payload),
    revivedFromPhaseId: row.revived_from_phase_id
  };
}

function mapMessage(row: MessageRow): DiscussionMessage {
  return {
    id: row.id,
    discussionId: row.discussion_id,
    phaseId: row.phase_id,
    phaseNumber: row.phase_number,
    parentMessageId: row.parent_message_id,
    author: {
      id: row.author_id,
      handle: row.author_handle
    },
    body: row.body,
    upvoteCount: row.upvote_count,
    hasUpvoted: row.has_upvoted,
    isHighlighted: row.is_highlighted,
    createdAt: row.created_at
  };
}

function buildDiscussionBaseSelect(viewerUserId?: string) {
  const viewer = viewerUserId?.trim() ? viewerUserId.trim() : null;

  return {
    sql: `
      SELECT
        d.id,
        d.slug,
        d.title,
        d.prompt,
        d.intent,
        d.tags,
        d.status,
        d.current_phase_number,
        d.revive_count,
        d.total_messages,
        d.bookmark_count,
        d.created_at,
        d.last_activity_at,
        d.completed_at,
        d.final_summary,
        creator.id AS created_by_user_id,
        creator.handle AS created_by_handle,
        p.id AS phase_id,
        p.phase_number,
        p.duration_minutes AS phase_duration_minutes,
        p.status AS phase_status,
        p.participant_count AS phase_participant_count,
        p.message_count AS phase_message_count,
        p.started_at AS phase_started_at,
        p.ends_at AS phase_ends_at,
        p.completed_at AS phase_completed_at,
        p.summary_payload AS phase_summary_payload,
        CASE
          WHEN $1::uuid IS NULL THEN FALSE
          ELSE EXISTS (
            SELECT 1
            FROM bookmarks b
            WHERE b.discussion_id = d.id
              AND b.user_id = $1::uuid
          )
        END AS bookmarked,
        CASE
          WHEN $1::uuid IS NULL THEN FALSE
          ELSE EXISTS (
            SELECT 1
            FROM phase_participants participants
            WHERE participants.phase_id = p.id
              AND participants.user_id = $1::uuid
          )
        END AS joined_current_phase
      FROM discussions d
      JOIN anonymous_users creator ON creator.id = d.created_by_user_id
      JOIN phases p
        ON p.discussion_id = d.id
       AND p.phase_number = d.current_phase_number
    `,
    values: [viewer]
  };
}

function buildListConditions(filters: DiscussionFilters, startingIndex: number) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let index = startingIndex;

  if (filters.status && filters.status !== "all") {
    clauses.push(`d.status = $${index}`);
    values.push(filters.status);
    index += 1;
  }

  if (filters.intent) {
    clauses.push(`d.intent = $${index}`);
    values.push(filters.intent);
    index += 1;
  }

  if (filters.tag) {
    clauses.push(`$${index} = ANY(d.tags)`);
    values.push(filters.tag);
    index += 1;
  }

  if (filters.query) {
    clauses.push(`(
      d.title ILIKE $${index}
      OR d.prompt ILIKE $${index}
      OR EXISTS (
        SELECT 1
        FROM unnest(d.tags) AS tag
        WHERE tag ILIKE $${index}
      )
    )`);
    values.push(`%${filters.query}%`);
    index += 1;
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
    nextIndex: index
  };
}

function resolveSort(sort: DiscussionFilters["sort"] = "trending") {
  switch (sort) {
    case "latest":
      return "d.created_at DESC";
    case "insightful":
      return "d.bookmark_count DESC, d.total_messages DESC, d.revive_count DESC, d.completed_at DESC NULLS LAST, d.created_at DESC";
    case "trending":
    default:
      return "((p.participant_count * 5) + (p.message_count * 3) + (d.bookmark_count * 4) + (d.revive_count * 2)) DESC, d.last_activity_at DESC";
  }
}

function toDetail(parts: DiscussionDetailParts, liveSummary: InsightSummary | null): DiscussionDetail {
  return {
    ...parts.base,
    createdBy: parts.base.createdBy,
    phases: parts.phases,
    messages: parts.messages,
    liveSummary,
    joinedCurrentPhase: parts.base.joinedCurrentPhase
  };
}

export class DiscussionRepository implements DiscussionRepositoryLike {
  async bootstrapUser(deviceKey?: string) {
    if (deviceKey?.trim()) {
      const existing = await query<{
        id: string;
        handle: string;
        device_key: string;
        created_at: string;
        last_seen_at: string;
      }>(
        `
          UPDATE anonymous_users
          SET last_seen_at = NOW()
          WHERE device_key = $1::uuid
          RETURNING id, handle, device_key, created_at, last_seen_at
        `,
        [deviceKey.trim()]
      );

      if (existing.rows[0]) {
        const row = existing.rows[0];

        return {
          id: row.id,
          handle: row.handle,
          deviceKey: row.device_key,
          createdAt: row.created_at,
          lastSeenAt: row.last_seen_at
        } satisfies AnonymousUser;
      }
    }

    const deviceKeyValue = randomUUID();
    const handle = generateAnonymousHandle();

    const created = await query<{
      id: string;
      handle: string;
      device_key: string;
      created_at: string;
      last_seen_at: string;
    }>(
      `
        INSERT INTO anonymous_users (handle, device_key)
        VALUES ($1, $2::uuid)
        RETURNING id, handle, device_key, created_at, last_seen_at
      `,
      [handle, deviceKeyValue]
    );

    const row = created.rows[0];

    return {
      id: row.id,
      handle: row.handle,
      deviceKey: row.device_key,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at
    } satisfies AnonymousUser;
  }

  async createDiscussion(input: {
    userId: string;
    title: string;
    prompt: string;
    intent: DiscussionIntent;
    tags: string[];
    durationMinutes: number;
  }) {
    return withTransaction(async (client) => {
      await this.assertUserExists(input.userId, client);

      const discussionInsert = await query<{ id: string }>(
        `
          INSERT INTO discussions (
            slug,
            title,
            prompt,
            intent,
            tags,
            created_by_user_id,
            current_phase_number
          )
          VALUES ($1, $2, $3, $4, $5::text[], $6::uuid, 1)
          RETURNING id
        `,
        [
          createSlug(input.title),
          input.title,
          input.prompt,
          input.intent,
          input.tags,
          input.userId
        ],
        client
      );

      const discussionId = discussionInsert.rows[0].id;

      const phaseInsert = await query<{ id: string }>(
        `
          INSERT INTO phases (
            discussion_id,
            phase_number,
            duration_minutes,
            started_at,
            ends_at,
            created_by_user_id,
            participant_count
          )
          VALUES (
            $1::uuid,
            1,
            $2,
            NOW(),
            NOW() + make_interval(mins => $2),
            $3::uuid,
            1
          )
          RETURNING id
        `,
        [discussionId, input.durationMinutes, input.userId],
        client
      );

      await query(
        `
          INSERT INTO phase_participants (phase_id, user_id)
          VALUES ($1::uuid, $2::uuid)
        `,
        [phaseInsert.rows[0].id, input.userId],
        client
      );

      return discussionId;
    });
  }

  async joinCurrentPhase(discussionId: string, userId: string) {
    return withTransaction(async (client) => {
      const current = await this.getDiscussionPhaseLock(discussionId, client);

      if (!current) {
        throw new HttpError(404, "Discussion not found.");
      }

      if (current.status !== "active") {
        return false;
      }

      const inserted = await query(
        `
          INSERT INTO phase_participants (phase_id, user_id)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT (phase_id, user_id) DO NOTHING
          RETURNING phase_id
        `,
        [current.id, userId],
        client
      );

      if ((inserted.rowCount ?? 0) > 0) {
        await query(
          `
            UPDATE phases
            SET participant_count = participant_count + 1
            WHERE id = $1::uuid
          `,
          [current.id],
          client
        );
      }

      await query(
        `
          UPDATE anonymous_users
          SET last_seen_at = NOW()
          WHERE id = $1::uuid
        `,
        [userId],
        client
      );

      return (inserted.rowCount ?? 0) > 0;
    });
  }

  async addMessage(input: {
    discussionId: string;
    userId: string;
    body: string;
    parentMessageId?: string | null;
  }) {
    return withTransaction(async (client) => {
      const current = await this.getDiscussionPhaseLock(input.discussionId, client);

      if (!current) {
        throw new HttpError(404, "Discussion not found.");
      }

      if (current.status !== "active") {
        throw new HttpError(409, "This discussion phase has already ended.");
      }

      const participant = await query(
        `
          INSERT INTO phase_participants (phase_id, user_id)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT (phase_id, user_id) DO NOTHING
          RETURNING phase_id
        `,
        [current.id, input.userId],
        client
      );

      if ((participant.rowCount ?? 0) > 0) {
        await query(
          `
            UPDATE phases
            SET participant_count = participant_count + 1
            WHERE id = $1::uuid
          `,
          [current.id],
          client
        );
      }

      if (input.parentMessageId) {
        const parentLookup = await query<{ id: string }>(
          `
            SELECT id
            FROM messages
            WHERE id = $1::uuid
              AND phase_id = $2::uuid
          `,
          [input.parentMessageId, current.id],
          client
        );

        if (!parentLookup.rows[0]) {
          throw new HttpError(400, "Replies must target a message from the active phase.");
        }
      }

      await query(
        `
          INSERT INTO messages (
            discussion_id,
            phase_id,
            author_user_id,
            parent_message_id,
            body
          )
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)
        `,
        [input.discussionId, current.id, input.userId, input.parentMessageId ?? null, input.body],
        client
      );

      await query(
        `
          UPDATE phases
          SET message_count = message_count + 1
          WHERE id = $1::uuid
        `,
        [current.id],
        client
      );

      await query(
        `
          UPDATE discussions
          SET
            total_messages = total_messages + 1,
            last_activity_at = NOW(),
            updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [input.discussionId],
        client
      );
    });
  }

  async addVote(messageId: string, userId: string) {
    return withTransaction(async (client) => {
      const inserted = await query(
        `
          INSERT INTO votes (message_id, user_id)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT (message_id, user_id) DO NOTHING
          RETURNING message_id
        `,
        [messageId, userId],
        client
      );

      if ((inserted.rowCount ?? 0) > 0) {
        await query(
          `
            UPDATE messages
            SET
              upvote_count = upvote_count + 1,
              is_highlighted = (upvote_count + 1) >= 3,
              updated_at = NOW()
            WHERE id = $1::uuid
          `,
          [messageId],
          client
        );
      }

      return this.readVoteState(messageId, userId, client);
    });
  }

  async removeVote(messageId: string, userId: string) {
    return withTransaction(async (client) => {
      const removed = await query(
        `
          DELETE FROM votes
          WHERE message_id = $1::uuid
            AND user_id = $2::uuid
          RETURNING message_id
        `,
        [messageId, userId],
        client
      );

      if ((removed.rowCount ?? 0) > 0) {
        await query(
          `
            UPDATE messages
            SET
              upvote_count = GREATEST(upvote_count - 1, 0),
              is_highlighted = GREATEST(upvote_count - 1, 0) >= 3,
              updated_at = NOW()
            WHERE id = $1::uuid
          `,
          [messageId],
          client
        );
      }

      return this.readVoteState(messageId, userId, client);
    });
  }

  async addBookmark(discussionId: string, userId: string) {
    return withTransaction(async (client) => {
      const inserted = await query(
        `
          INSERT INTO bookmarks (discussion_id, user_id)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT (discussion_id, user_id) DO NOTHING
          RETURNING discussion_id
        `,
        [discussionId, userId],
        client
      );

      if ((inserted.rowCount ?? 0) > 0) {
        await query(
          `
            UPDATE discussions
            SET
              bookmark_count = bookmark_count + 1,
              updated_at = NOW()
            WHERE id = $1::uuid
          `,
          [discussionId],
          client
        );
      }

      return this.readBookmarkState(discussionId, userId, client);
    });
  }

  async removeBookmark(discussionId: string, userId: string) {
    return withTransaction(async (client) => {
      const removed = await query(
        `
          DELETE FROM bookmarks
          WHERE discussion_id = $1::uuid
            AND user_id = $2::uuid
          RETURNING discussion_id
        `,
        [discussionId, userId],
        client
      );

      if ((removed.rowCount ?? 0) > 0) {
        await query(
          `
            UPDATE discussions
            SET
              bookmark_count = GREATEST(bookmark_count - 1, 0),
              updated_at = NOW()
            WHERE id = $1::uuid
          `,
          [discussionId],
          client
        );
      }

      return this.readBookmarkState(discussionId, userId, client);
    });
  }

  async reviveDiscussion(input: { discussionId: string; userId: string; durationMinutes: number }) {
    return withTransaction(async (client) => {
      const current = await this.getDiscussionPhaseLock(input.discussionId, client);

      if (!current) {
        throw new HttpError(404, "Discussion not found.");
      }

      if (current.status === "active") {
        throw new HttpError(409, "This discussion is still active and does not need a revive.");
      }

      const nextPhase = await query<{ id: string; phase_number: number }>(
        `
          INSERT INTO phases (
            discussion_id,
            phase_number,
            duration_minutes,
            started_at,
            ends_at,
            status,
            participant_count,
            revived_from_phase_id,
            created_by_user_id
          )
          VALUES (
            $1::uuid,
            $2,
            $3,
            NOW(),
            NOW() + make_interval(mins => $3),
            'active',
            1,
            $4::uuid,
            $5::uuid
          )
          RETURNING id, phase_number
        `,
        [
          input.discussionId,
          current.phase_number + 1,
          input.durationMinutes,
          current.id,
          input.userId
        ],
        client
      );

      await query(
        `
          INSERT INTO phase_participants (phase_id, user_id)
          VALUES ($1::uuid, $2::uuid)
        `,
        [nextPhase.rows[0].id, input.userId],
        client
      );

      await query(
        `
          UPDATE discussions
          SET
            current_phase_number = $2,
            status = 'active',
            revive_count = revive_count + 1,
            last_activity_at = NOW(),
            completed_at = NULL,
            updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [input.discussionId, nextPhase.rows[0].phase_number],
        client
      );
    });
  }

  async listDiscussions(filters: DiscussionFilters) {
    const base = buildDiscussionBaseSelect(filters.userId);
    const conditions = buildListConditions(filters, 2);
    const totalConditions = buildListConditions(filters, 1);
    const orderBy = resolveSort(filters.sort);
    const limit = filters.limit ?? 12;
    const offset = filters.offset ?? 0;

    const listQuery = `
      ${base.sql}
      ${conditions.where}
      ORDER BY ${orderBy}
      LIMIT $${conditions.nextIndex}
      OFFSET $${conditions.nextIndex + 1}
    `;

    const totalQuery = `
      SELECT COUNT(*)::int AS total
      FROM discussions d
      JOIN phases p
        ON p.discussion_id = d.id
       AND p.phase_number = d.current_phase_number
      ${totalConditions.where}
    `;

    const [items, total] = await Promise.all([
      query<DiscussionRow>(listQuery, [...base.values, ...conditions.values, limit, offset]),
      query<{ total: number }>(totalQuery, totalConditions.values)
    ]);

    return {
      items: items.rows.map(mapDiscussionCard),
      meta: {
        limit,
        offset,
        total: total.rows[0]?.total ?? 0
      }
    };
  }

  async getDiscussionDetail(discussionId: string, viewerUserId?: string) {
    const base = buildDiscussionBaseSelect(viewerUserId);
    const detailResult = await query<DiscussionRow>(
      `
        ${base.sql}
        WHERE d.id::text = $2 OR d.slug = $2
        LIMIT 1
      `,
      [...base.values, discussionId]
    );

    const row = detailResult.rows[0];

    if (!row) {
      return null;
    }

    const [phases, messages] = await Promise.all([
      query<PhaseRow>(
        `
          SELECT
            id,
            discussion_id,
            phase_number,
            duration_minutes,
            status,
            participant_count,
            message_count,
            started_at,
            ends_at,
            completed_at,
            summary_payload,
            revived_from_phase_id
          FROM phases
          WHERE discussion_id = $1::uuid
          ORDER BY phase_number ASC
        `,
        [row.id]
      ),
      query<MessageRow>(
        `
          SELECT
            m.id,
            m.discussion_id,
            m.phase_id,
            p.phase_number,
            m.parent_message_id,
            author.id AS author_id,
            author.handle AS author_handle,
            m.body,
            m.upvote_count,
            CASE
              WHEN $2::uuid IS NULL THEN FALSE
              ELSE EXISTS (
                SELECT 1
                FROM votes v
                WHERE v.message_id = m.id
                  AND v.user_id = $2::uuid
              )
            END AS has_upvoted,
            m.is_highlighted,
            m.created_at
          FROM messages m
          JOIN phases p ON p.id = m.phase_id
          JOIN anonymous_users author ON author.id = m.author_user_id
          WHERE m.discussion_id = $1::uuid
          ORDER BY p.phase_number ASC, m.created_at ASC
        `,
        [row.id, viewerUserId?.trim() || null]
      )
    ]);

    return {
      base: {
        ...mapDiscussionCard(row),
        createdBy: {
          id: row.created_by_user_id,
          handle: row.created_by_handle
        },
        joinedCurrentPhase: row.joined_current_phase
      },
      phases: phases.rows.map(mapPhase),
      messages: messages.rows.map(mapMessage)
    } satisfies DiscussionDetailParts;
  }

  async listSummaryMessagesForPhase(phaseId: string) {
    const result = await query<{
      id: string;
      phase_number: number;
      author_handle: string;
      body: string;
      upvote_count: number;
      created_at: string;
    }>(
      `
        SELECT
          m.id,
          p.phase_number,
          author.handle AS author_handle,
          m.body,
          m.upvote_count,
          m.created_at
        FROM messages m
        JOIN phases p ON p.id = m.phase_id
        JOIN anonymous_users author ON author.id = m.author_user_id
        WHERE m.phase_id = $1::uuid
        ORDER BY m.created_at ASC
      `,
      [phaseId]
    );

    return result.rows.map(
      (row) =>
        ({
          id: row.id,
          phaseNumber: row.phase_number,
          authorHandle: row.author_handle,
          body: row.body,
          upvoteCount: row.upvote_count,
          createdAt: row.created_at
        }) satisfies SummaryMessage
    );
  }

  async listSummaryMessagesForDiscussion(discussionId: string) {
    const result = await query<{
      id: string;
      phase_number: number;
      author_handle: string;
      body: string;
      upvote_count: number;
      created_at: string;
    }>(
      `
        SELECT
          m.id,
          p.phase_number,
          author.handle AS author_handle,
          m.body,
          m.upvote_count,
          m.created_at
        FROM messages m
        JOIN phases p ON p.id = m.phase_id
        JOIN anonymous_users author ON author.id = m.author_user_id
        WHERE m.discussion_id = $1::uuid
        ORDER BY p.phase_number ASC, m.created_at ASC
      `,
      [discussionId]
    );

    return result.rows.map(
      (row) =>
        ({
          id: row.id,
          phaseNumber: row.phase_number,
          authorHandle: row.author_handle,
          body: row.body,
          upvoteCount: row.upvote_count,
          createdAt: row.created_at
        }) satisfies SummaryMessage
    );
  }

  async findExpiredActivePhases(limit = 20) {
    const result = await query<ExpiredPhase>(
      `
        SELECT id, discussion_id, phase_number
        FROM phases
        WHERE status = 'active'
          AND ends_at <= NOW()
        ORDER BY ends_at ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows;
  }

  async completeExpiredPhase(input: {
    phaseId: string;
    discussionId: string;
    phaseSummary: InsightSummary;
    discussionSummary: InsightSummary;
    highlightedMessageIds: string[];
  }) {
    return withTransaction(async (client) => {
      const phaseUpdate = await query(
        `
          UPDATE phases
          SET
            status = 'completed',
            completed_at = NOW(),
            summary_state = 'ready',
            summary_payload = $2::jsonb
          WHERE id = $1::uuid
            AND status = 'active'
          RETURNING id
        `,
        [input.phaseId, JSON.stringify(input.phaseSummary)],
        client
      );

      if (phaseUpdate.rowCount === 0) {
        return false;
      }

      await query(
        `
          UPDATE messages
          SET is_highlighted = id = ANY($2::uuid[])
          WHERE phase_id = $1::uuid
        `,
        [input.phaseId, input.highlightedMessageIds],
        client
      );

      await query(
        `
          UPDATE discussions
          SET
            status = 'completed',
            completed_at = NOW(),
            final_summary = $2::jsonb,
            updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [input.discussionId, JSON.stringify(input.discussionSummary)],
        client
      );

      return true;
    });
  }

  async assertUserExists(userId: string, client?: PoolClient) {
    const result = await query<{ id: string }>(
      `
        SELECT id
        FROM anonymous_users
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [userId],
      client
    );

    if (!result.rows[0]) {
      throw new HttpError(400, "Anonymous user session is missing. Refresh and try again.");
    }
  }

  toDetail(parts: DiscussionDetailParts, liveSummary: InsightSummary | null) {
    return toDetail(parts, liveSummary);
  }

  private async getDiscussionPhaseLock(discussionId: string, client: PoolClient) {
    const result = await query<{
      id: string;
      phase_number: number;
      status: "active" | "completed";
    }>(
      `
        SELECT p.id, p.phase_number, p.status
        FROM discussions d
        JOIN phases p
          ON p.discussion_id = d.id
         AND p.phase_number = d.current_phase_number
        WHERE d.id::text = $1 OR d.slug = $1
        FOR UPDATE OF d, p
      `,
      [discussionId],
      client
    );

    return result.rows[0] ?? null;
  }

  private async readVoteState(messageId: string, userId: string, client: PoolClient) {
    const result = await query<{
      id: string;
      upvote_count: number;
      has_upvoted: boolean;
    }>(
      `
        SELECT
          m.id,
          m.upvote_count,
          EXISTS (
            SELECT 1
            FROM votes v
            WHERE v.message_id = m.id
              AND v.user_id = $2::uuid
          ) AS has_upvoted
        FROM messages m
        WHERE m.id = $1::uuid
      `,
      [messageId, userId],
      client
    );

    const row = result.rows[0];

    if (!row) {
      throw new HttpError(404, "Message not found.");
    }

    return {
      messageId: row.id,
      upvoteCount: row.upvote_count,
      hasUpvoted: row.has_upvoted
    };
  }

  private async readBookmarkState(discussionId: string, userId: string, client: PoolClient) {
    const result = await query<{
      id: string;
      bookmark_count: number;
      bookmarked: boolean;
    }>(
      `
        SELECT
          d.id,
          d.bookmark_count,
          EXISTS (
            SELECT 1
            FROM bookmarks b
            WHERE b.discussion_id = d.id
              AND b.user_id = $2::uuid
          ) AS bookmarked
        FROM discussions d
        WHERE d.id = $1::uuid
      `,
      [discussionId, userId],
      client
    );

    const row = result.rows[0];

    if (!row) {
      throw new HttpError(404, "Discussion not found.");
    }

    return {
      discussionId: row.id,
      bookmarked: row.bookmarked,
      bookmarkCount: row.bookmark_count
    };
  }
}

function generateAnonymousHandle() {
  const adjectives = [
    "Curious",
    "Quiet",
    "Thoughtful",
    "Bright",
    "Candid",
    "Steady",
    "Bold",
    "Patient",
    "Sharp",
    "Calm"
  ];
  const nouns = [
    "Otter",
    "Falcon",
    "Nova",
    "Maple",
    "Harbor",
    "Comet",
    "Sparrow",
    "Signal",
    "Summit",
    "Echo"
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const suffix = Math.floor(100 + Math.random() * 900);

  return `${adjective} ${noun} ${suffix}`;
}

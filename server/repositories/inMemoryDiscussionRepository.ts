import { randomUUID } from "node:crypto";
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
import { HttpError } from "../lib/http";
import type {
  DiscussionDetailParts,
  DiscussionRepositoryLike,
  ExpiredPhase,
  SummaryMessage
} from "./repositoryContract";

type UserRecord = AnonymousUser;

type DiscussionRecord = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  intent: DiscussionIntent;
  tags: string[];
  status: "active" | "completed";
  currentPhaseNumber: number;
  reviveCount: number;
  totalMessages: number;
  bookmarkCount: number;
  createdAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  finalSummary: InsightSummary | null;
  createdByUserId: string;
};

type PhaseRecord = DiscussionPhase & {
  createdByUserId: string;
};

type MessageRecord = Omit<DiscussionMessage, "hasUpvoted" | "author"> & {
  authorId: string;
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

function toIso(date = new Date()) {
  return date.toISOString();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function compareIsoDescending(left: string | null, right: string | null) {
  const leftValue = left ? new Date(left).getTime() : Number.NEGATIVE_INFINITY;
  const rightValue = right ? new Date(right).getTime() : Number.NEGATIVE_INFINITY;
  return rightValue - leftValue;
}

function sortByCreatedAsc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function createDiscussionBase(parts: DiscussionDetailParts, liveSummary: InsightSummary | null): DiscussionDetail {
  return {
    ...parts.base,
    createdBy: parts.base.createdBy,
    phases: parts.phases,
    messages: parts.messages,
    liveSummary,
    joinedCurrentPhase: parts.base.joinedCurrentPhase
  };
}

export class InMemoryDiscussionRepository implements DiscussionRepositoryLike {
  private readonly users = new Map<string, UserRecord>();
  private readonly discussions = new Map<string, DiscussionRecord>();
  private readonly phases = new Map<string, PhaseRecord>();
  private readonly messages = new Map<string, MessageRecord>();
  private readonly participants = new Map<string, Set<string>>();
  private readonly bookmarks = new Map<string, Set<string>>();
  private readonly votes = new Map<string, Set<string>>();

  async bootstrapUser(deviceKey?: string) {
    const normalizedDeviceKey = deviceKey?.trim();

    if (normalizedDeviceKey) {
      const existing = [...this.users.values()].find((user) => user.deviceKey === normalizedDeviceKey);

      if (existing) {
        const updated = {
          ...existing,
          lastSeenAt: toIso()
        };

        this.users.set(updated.id, updated);
        return updated;
      }
    }

    const created: AnonymousUser = {
      id: randomUUID(),
      handle: generateAnonymousHandle(),
      deviceKey: normalizedDeviceKey ?? randomUUID(),
      createdAt: toIso(),
      lastSeenAt: toIso()
    };

    this.users.set(created.id, created);
    return created;
  }

  async createDiscussion(input: {
    userId: string;
    title: string;
    prompt: string;
    intent: DiscussionIntent;
    tags: string[];
    durationMinutes: number;
  }) {
    await this.assertUserExists(input.userId);

    const now = new Date();
    const discussionId = randomUUID();
    const phaseId = randomUUID();
    const discussion: DiscussionRecord = {
      id: discussionId,
      slug: this.createUniqueSlug(input.title),
      title: input.title,
      prompt: input.prompt,
      intent: input.intent,
      tags: input.tags,
      status: "active",
      currentPhaseNumber: 1,
      reviveCount: 0,
      totalMessages: 0,
      bookmarkCount: 0,
      createdAt: toIso(now),
      lastActivityAt: toIso(now),
      completedAt: null,
      finalSummary: null,
      createdByUserId: input.userId
    };
    const phase: PhaseRecord = {
      id: phaseId,
      discussionId,
      phaseNumber: 1,
      durationMinutes: input.durationMinutes,
      status: "active",
      participantCount: 1,
      messageCount: 0,
      startedAt: toIso(now),
      endsAt: toIso(addMinutes(now, input.durationMinutes)),
      completedAt: null,
      summary: null,
      revivedFromPhaseId: null,
      createdByUserId: input.userId
    };

    this.discussions.set(discussionId, discussion);
    this.phases.set(phaseId, phase);
    this.participants.set(phaseId, new Set([input.userId]));
    this.touchUser(input.userId);

    return discussionId;
  }

  async joinCurrentPhase(discussionId: string, userId: string) {
    const current = this.getCurrentPhaseByDiscussion(discussionId);

    if (!current) {
      throw new HttpError(404, "Discussion not found.");
    }

    if (current.status !== "active") {
      return false;
    }

    const members = this.ensureParticipantSet(current.id);
    const joinedBefore = members.has(userId);
    members.add(userId);

    if (!joinedBefore) {
      current.participantCount = members.size;
      this.phases.set(current.id, current);
    }

    this.touchUser(userId);
    return !joinedBefore;
  }

  async addMessage(input: {
    discussionId: string;
    userId: string;
    body: string;
    parentMessageId?: string | null;
  }) {
    const current = this.getCurrentPhaseByDiscussion(input.discussionId);

    if (!current) {
      throw new HttpError(404, "Discussion not found.");
    }

    if (current.status !== "active") {
      throw new HttpError(409, "This discussion phase has already ended.");
    }

    const members = this.ensureParticipantSet(current.id);
    if (!members.has(input.userId)) {
      members.add(input.userId);
      current.participantCount = members.size;
    }

    if (input.parentMessageId) {
      const parent = this.messages.get(input.parentMessageId);

      if (!parent || parent.phaseId !== current.id) {
        throw new HttpError(400, "Replies must target a message from the active phase.");
      }
    }

    const createdAt = toIso();
    const message: MessageRecord = {
      id: randomUUID(),
      discussionId: current.discussionId,
      phaseId: current.id,
      phaseNumber: current.phaseNumber,
      parentMessageId: input.parentMessageId ?? null,
      authorId: input.userId,
      body: input.body,
      upvoteCount: 0,
      isHighlighted: false,
      createdAt
    };

    this.messages.set(message.id, message);
    current.messageCount += 1;
    this.phases.set(current.id, current);

    const discussion = this.mustFindDiscussion(current.discussionId);
    discussion.totalMessages += 1;
    discussion.lastActivityAt = createdAt;
    this.discussions.set(discussion.id, discussion);
    this.touchUser(input.userId);
  }

  async addVote(messageId: string, userId: string) {
    const message = this.mustFindMessage(messageId);
    const voters = this.ensureVoteSet(messageId);
    const added = !voters.has(userId);

    if (added) {
      voters.add(userId);
      message.upvoteCount += 1;
      message.isHighlighted = message.upvoteCount >= 3;
      this.messages.set(message.id, message);
    }

    return this.readVoteState(message, userId);
  }

  async removeVote(messageId: string, userId: string) {
    const message = this.mustFindMessage(messageId);
    const voters = this.ensureVoteSet(messageId);

    if (voters.delete(userId)) {
      message.upvoteCount = Math.max(message.upvoteCount - 1, 0);
      message.isHighlighted = message.upvoteCount >= 3;
      this.messages.set(message.id, message);
    }

    return this.readVoteState(message, userId);
  }

  async addBookmark(discussionId: string, userId: string) {
    const discussion = this.mustFindDiscussionByRef(discussionId);
    const bookmarks = this.ensureBookmarkSet(discussion.id);
    const added = !bookmarks.has(userId);

    if (added) {
      bookmarks.add(userId);
      discussion.bookmarkCount = bookmarks.size;
      this.discussions.set(discussion.id, discussion);
    }

    return this.readBookmarkState(discussion, userId);
  }

  async removeBookmark(discussionId: string, userId: string) {
    const discussion = this.mustFindDiscussionByRef(discussionId);
    const bookmarks = this.ensureBookmarkSet(discussion.id);

    if (bookmarks.delete(userId)) {
      discussion.bookmarkCount = bookmarks.size;
      this.discussions.set(discussion.id, discussion);
    }

    return this.readBookmarkState(discussion, userId);
  }

  async reviveDiscussion(input: { discussionId: string; userId: string; durationMinutes: number }) {
    const current = this.getCurrentPhaseByDiscussion(input.discussionId);

    if (!current) {
      throw new HttpError(404, "Discussion not found.");
    }

    if (current.status === "active") {
      throw new HttpError(409, "This discussion is still active and does not need a revive.");
    }

    const discussion = this.mustFindDiscussion(current.discussionId);
    const now = new Date();
    const nextPhase: PhaseRecord = {
      id: randomUUID(),
      discussionId: discussion.id,
      phaseNumber: current.phaseNumber + 1,
      durationMinutes: input.durationMinutes,
      status: "active",
      participantCount: 1,
      messageCount: 0,
      startedAt: toIso(now),
      endsAt: toIso(addMinutes(now, input.durationMinutes)),
      completedAt: null,
      summary: null,
      revivedFromPhaseId: current.id,
      createdByUserId: input.userId
    };

    this.phases.set(nextPhase.id, nextPhase);
    this.participants.set(nextPhase.id, new Set([input.userId]));

    discussion.currentPhaseNumber = nextPhase.phaseNumber;
    discussion.status = "active";
    discussion.reviveCount += 1;
    discussion.lastActivityAt = nextPhase.startedAt;
    discussion.completedAt = null;
    this.discussions.set(discussion.id, discussion);
    this.touchUser(input.userId);
  }

  async listDiscussions(filters: DiscussionFilters) {
    const userId = filters.userId?.trim() || undefined;
    const normalizedQuery = filters.query?.trim().toLowerCase();

    const items = [...this.discussions.values()]
      .filter((discussion) => {
        if (filters.status && filters.status !== "all" && discussion.status !== filters.status) {
          return false;
        }

        if (filters.intent && discussion.intent !== filters.intent) {
          return false;
        }

        if (filters.tag && !discussion.tags.includes(filters.tag)) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [discussion.title, discussion.prompt, ...discussion.tags].join(" ").toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .map((discussion) => this.toDiscussionCard(discussion, userId))
      .sort((left, right) => this.compareDiscussionCards(left, right, filters.sort));

    const limit = filters.limit ?? 12;
    const offset = filters.offset ?? 0;

    return {
      items: items.slice(offset, offset + limit),
      meta: {
        limit,
        offset,
        total: items.length
      }
    };
  }

  async getDiscussionDetail(discussionId: string, viewerUserId?: string) {
    const discussion = this.findDiscussionByRef(discussionId);

    if (!discussion) {
      return null;
    }

    const currentPhase = this.mustFindCurrentPhase(discussion.id);
    const createdBy = this.mustFindUser(discussion.createdByUserId);
    const phaseItems = this.listPhasesForDiscussion(discussion.id).map((phase) => ({ ...phase }));
    const messageItems = this.listMessagesForDiscussion(discussion.id).map((message) => {
      const author = this.mustFindUser(message.authorId);
      const hasUpvoted = viewerUserId ? this.ensureVoteSet(message.id).has(viewerUserId) : false;

      return {
        id: message.id,
        discussionId: message.discussionId,
        phaseId: message.phaseId,
        phaseNumber: message.phaseNumber,
        parentMessageId: message.parentMessageId,
        author: {
          id: author.id,
          handle: author.handle
        },
        body: message.body,
        upvoteCount: message.upvoteCount,
        hasUpvoted,
        isHighlighted: message.isHighlighted,
        createdAt: message.createdAt
      } satisfies DiscussionMessage;
    });

    return {
      base: {
        ...this.toDiscussionCard(discussion, viewerUserId),
        createdBy: {
          id: createdBy.id,
          handle: createdBy.handle
        },
        joinedCurrentPhase: viewerUserId
          ? this.ensureParticipantSet(currentPhase.id).has(viewerUserId)
          : false
      },
      phases: phaseItems,
      messages: messageItems
    } satisfies DiscussionDetailParts;
  }

  async listSummaryMessagesForPhase(phaseId: string) {
    const phaseMessages = sortByCreatedAsc(
      [...this.messages.values()].filter((message) => message.phaseId === phaseId)
    );

    return phaseMessages.map((message) => this.toSummaryMessage(message));
  }

  async listSummaryMessagesForDiscussion(discussionId: string) {
    return this.listMessagesForDiscussion(discussionId).map((message) => this.toSummaryMessage(message));
  }

  async findExpiredActivePhases(limit = 20) {
    const now = Date.now();

    return [...this.phases.values()]
      .filter((phase) => phase.status === "active" && new Date(phase.endsAt).getTime() <= now)
      .sort((left, right) => new Date(left.endsAt).getTime() - new Date(right.endsAt).getTime())
      .slice(0, limit)
      .map(
        (phase) =>
          ({
            id: phase.id,
            discussion_id: phase.discussionId,
            phase_number: phase.phaseNumber
          }) satisfies ExpiredPhase
      );
  }

  async completeExpiredPhase(input: {
    phaseId: string;
    discussionId: string;
    phaseSummary: InsightSummary;
    discussionSummary: InsightSummary;
    highlightedMessageIds: string[];
  }) {
    const phase = this.phases.get(input.phaseId);

    if (!phase || phase.status !== "active") {
      return false;
    }

    phase.status = "completed";
    phase.completedAt = toIso();
    phase.summary = input.phaseSummary;
    this.phases.set(phase.id, phase);

    const highlightedIds = new Set(input.highlightedMessageIds);
    for (const message of this.messages.values()) {
      if (message.phaseId === phase.id) {
        message.isHighlighted = highlightedIds.has(message.id);
        this.messages.set(message.id, message);
      }
    }

    const discussion = this.mustFindDiscussion(input.discussionId);
    discussion.status = "completed";
    discussion.completedAt = phase.completedAt;
    discussion.finalSummary = input.discussionSummary;
    this.discussions.set(discussion.id, discussion);
    return true;
  }

  async assertUserExists(userId: string) {
    if (!this.users.has(userId)) {
      throw new HttpError(400, "Anonymous user session is missing. Refresh and try again.");
    }
  }

  toDetail(parts: DiscussionDetailParts, liveSummary: InsightSummary | null) {
    return createDiscussionBase(parts, liveSummary);
  }

  private compareDiscussionCards(
    left: DiscussionCard,
    right: DiscussionCard,
    sort: DiscussionFilters["sort"] = "trending"
  ) {
    switch (sort) {
      case "latest":
        return compareIsoDescending(left.createdAt, right.createdAt);
      case "insightful":
        if (right.bookmarkCount !== left.bookmarkCount) {
          return right.bookmarkCount - left.bookmarkCount;
        }

        if (right.messageCount !== left.messageCount) {
          return right.messageCount - left.messageCount;
        }

        if (right.reviveCount !== left.reviveCount) {
          return right.reviveCount - left.reviveCount;
        }

        if ((right.completedAt ?? "") !== (left.completedAt ?? "")) {
          return compareIsoDescending(left.completedAt, right.completedAt);
        }

        return compareIsoDescending(left.createdAt, right.createdAt);
      case "trending":
      default: {
        const leftScore =
          left.participantCount * 5 + left.messageCount * 3 + left.bookmarkCount * 4 + left.reviveCount * 2;
        const rightScore =
          right.participantCount * 5 +
          right.messageCount * 3 +
          right.bookmarkCount * 4 +
          right.reviveCount * 2;

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        return compareIsoDescending(left.lastActivityAt, right.lastActivityAt);
      }
    }
  }

  private createUniqueSlug(title: string) {
    let slug = createSlug(title);

    while ([...this.discussions.values()].some((discussion) => discussion.slug === slug)) {
      slug = createSlug(title);
    }

    return slug;
  }

  private findDiscussionByRef(discussionId: string) {
    const normalized = discussionId.trim();

    return [...this.discussions.values()].find(
      (discussion) => discussion.id === normalized || discussion.slug === normalized
    );
  }

  private mustFindDiscussionByRef(discussionId: string) {
    const discussion = this.findDiscussionByRef(discussionId);

    if (!discussion) {
      throw new HttpError(404, "Discussion not found.");
    }

    return discussion;
  }

  private mustFindDiscussion(discussionId: string) {
    const discussion = this.discussions.get(discussionId);

    if (!discussion) {
      throw new HttpError(404, "Discussion not found.");
    }

    return discussion;
  }

  private mustFindCurrentPhase(discussionId: string) {
    const discussion = this.mustFindDiscussion(discussionId);
    const phase = [...this.phases.values()].find(
      (item) => item.discussionId === discussion.id && item.phaseNumber === discussion.currentPhaseNumber
    );

    if (!phase) {
      throw new HttpError(404, "Discussion phase not found.");
    }

    return phase;
  }

  private getCurrentPhaseByDiscussion(discussionId: string) {
    const discussion = this.findDiscussionByRef(discussionId);

    if (!discussion) {
      return null;
    }

    return this.mustFindCurrentPhase(discussion.id);
  }

  private listPhasesForDiscussion(discussionId: string) {
    return [...this.phases.values()]
      .filter((phase) => phase.discussionId === discussionId)
      .sort((left, right) => left.phaseNumber - right.phaseNumber)
      .map((phase) => ({
        id: phase.id,
        discussionId: phase.discussionId,
        phaseNumber: phase.phaseNumber,
        durationMinutes: phase.durationMinutes,
        status: phase.status,
        participantCount: phase.participantCount,
        messageCount: phase.messageCount,
        startedAt: phase.startedAt,
        endsAt: phase.endsAt,
        completedAt: phase.completedAt,
        summary: phase.summary,
        revivedFromPhaseId: phase.revivedFromPhaseId
      }) satisfies DiscussionPhase);
  }

  private listMessagesForDiscussion(discussionId: string) {
    return [...this.messages.values()]
      .filter((message) => message.discussionId === discussionId)
      .sort((left, right) => {
        if (left.phaseNumber !== right.phaseNumber) {
          return left.phaseNumber - right.phaseNumber;
        }

        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      });
  }

  private toDiscussionCard(discussion: DiscussionRecord, viewerUserId?: string) {
    const currentPhase = this.mustFindCurrentPhase(discussion.id);

    return {
      id: discussion.id,
      slug: discussion.slug,
      title: discussion.title,
      prompt: discussion.prompt,
      intent: discussion.intent,
      tags: discussion.tags,
      status: discussion.status,
      currentPhaseNumber: discussion.currentPhaseNumber,
      reviveCount: discussion.reviveCount,
      participantCount: currentPhase.participantCount,
      messageCount: discussion.totalMessages,
      bookmarkCount: discussion.bookmarkCount,
      createdAt: discussion.createdAt,
      lastActivityAt: discussion.lastActivityAt,
      completedAt: discussion.completedAt,
      endsAt: currentPhase.endsAt,
      summary: discussion.status === "completed" ? discussion.finalSummary : currentPhase.summary,
      bookmarked: viewerUserId ? this.ensureBookmarkSet(discussion.id).has(viewerUserId) : false
    } satisfies DiscussionCard;
  }

  private toSummaryMessage(message: MessageRecord) {
    const author = this.mustFindUser(message.authorId);

    return {
      id: message.id,
      phaseNumber: message.phaseNumber,
      authorHandle: author.handle,
      body: message.body,
      upvoteCount: message.upvoteCount,
      createdAt: message.createdAt
    } satisfies SummaryMessage;
  }

  private readVoteState(message: MessageRecord, userId: string) {
    return {
      messageId: message.id,
      upvoteCount: message.upvoteCount,
      hasUpvoted: this.ensureVoteSet(message.id).has(userId)
    };
  }

  private readBookmarkState(discussion: DiscussionRecord, userId: string) {
    return {
      discussionId: discussion.id,
      bookmarked: this.ensureBookmarkSet(discussion.id).has(userId),
      bookmarkCount: discussion.bookmarkCount
    };
  }

  private mustFindUser(userId: string) {
    const user = this.users.get(userId);

    if (!user) {
      throw new HttpError(400, "Anonymous user session is missing. Refresh and try again.");
    }

    return user;
  }

  private mustFindMessage(messageId: string) {
    const message = this.messages.get(messageId);

    if (!message) {
      throw new HttpError(404, "Message not found.");
    }

    return message;
  }

  private ensureParticipantSet(phaseId: string) {
    const existing = this.participants.get(phaseId);

    if (existing) {
      return existing;
    }

    const created = new Set<string>();
    this.participants.set(phaseId, created);
    return created;
  }

  private ensureBookmarkSet(discussionId: string) {
    const existing = this.bookmarks.get(discussionId);

    if (existing) {
      return existing;
    }

    const created = new Set<string>();
    this.bookmarks.set(discussionId, created);
    return created;
  }

  private ensureVoteSet(messageId: string) {
    const existing = this.votes.get(messageId);

    if (existing) {
      return existing;
    }

    const created = new Set<string>();
    this.votes.set(messageId, created);
    return created;
  }

  private touchUser(userId: string) {
    const user = this.users.get(userId);

    if (!user) {
      return;
    }

    this.users.set(userId, {
      ...user,
      lastSeenAt: toIso()
    });
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

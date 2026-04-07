import type {
  AnonymousUser,
  BookmarkResponse,
  DiscussionCard,
  DiscussionDetail,
  DiscussionFilters,
  DiscussionIntent,
  DiscussionListResponse,
  DiscussionMessage,
  DiscussionPhase,
  InsightSummary,
  VoteResponse
} from "../../shared/types";

export type SummaryMessage = {
  id: string;
  phaseNumber: number;
  authorHandle: string;
  body: string;
  upvoteCount: number;
  createdAt: string;
};

export type ExpiredPhase = {
  id: string;
  discussion_id: string;
  phase_number: number;
};

export type DiscussionDetailParts = {
  base: DiscussionCard & {
    createdBy: Pick<AnonymousUser, "id" | "handle">;
    joinedCurrentPhase: boolean;
  };
  phases: DiscussionPhase[];
  messages: DiscussionMessage[];
};

export interface DiscussionRepositoryLike {
  bootstrapUser(deviceKey?: string): Promise<AnonymousUser>;
  createDiscussion(input: {
    userId: string;
    title: string;
    prompt: string;
    intent: DiscussionIntent;
    tags: string[];
    durationMinutes: number;
  }): Promise<string>;
  joinCurrentPhase(discussionId: string, userId: string): Promise<boolean>;
  addMessage(input: {
    discussionId: string;
    userId: string;
    body: string;
    parentMessageId?: string | null;
  }): Promise<void>;
  addVote(messageId: string, userId: string): Promise<VoteResponse>;
  removeVote(messageId: string, userId: string): Promise<VoteResponse>;
  addBookmark(discussionId: string, userId: string): Promise<BookmarkResponse>;
  removeBookmark(discussionId: string, userId: string): Promise<BookmarkResponse>;
  reviveDiscussion(input: { discussionId: string; userId: string; durationMinutes: number }): Promise<void>;
  listDiscussions(filters: DiscussionFilters): Promise<DiscussionListResponse>;
  getDiscussionDetail(discussionId: string, viewerUserId?: string): Promise<DiscussionDetailParts | null>;
  listSummaryMessagesForPhase(phaseId: string): Promise<SummaryMessage[]>;
  listSummaryMessagesForDiscussion(discussionId: string): Promise<SummaryMessage[]>;
  findExpiredActivePhases(limit?: number): Promise<ExpiredPhase[]>;
  completeExpiredPhase(input: {
    phaseId: string;
    discussionId: string;
    phaseSummary: InsightSummary;
    discussionSummary: InsightSummary;
    highlightedMessageIds: string[];
  }): Promise<boolean>;
  assertUserExists(userId: string): Promise<void>;
  toDetail(parts: DiscussionDetailParts, liveSummary: InsightSummary | null): DiscussionDetail;
}

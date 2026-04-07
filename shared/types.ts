export const discussionIntents = ["debate", "help", "opinion", "fun"] as const;
export const discussionStatuses = ["active", "completed"] as const;
export const phaseStatuses = ["active", "completed"] as const;
export const discussionSorts = ["trending", "latest", "insightful"] as const;

export type DiscussionIntent = (typeof discussionIntents)[number];
export type DiscussionStatus = (typeof discussionStatuses)[number];
export type PhaseStatus = (typeof phaseStatuses)[number];
export type DiscussionSort = (typeof discussionSorts)[number];

export type AnonymousUser = {
  id: string;
  handle: string;
  deviceKey: string;
  createdAt: string;
  lastSeenAt: string;
};

export type OpinionSplit = {
  agree: number;
  disagree: number;
  neutral: number;
};

export type InsightHighlight = {
  messageId: string;
  authorHandle: string;
  excerpt: string;
  upvoteCount: number;
  phaseNumber: number;
};

export type InsightSummary = {
  keyPoints: string[];
  opinionSplit: OpinionSplit;
  topInsights: InsightHighlight[];
  narrative: string;
  generatedAt: string;
  source: "live" | "phase" | "discussion";
};

export type DiscussionPhase = {
  id: string;
  discussionId: string;
  phaseNumber: number;
  durationMinutes: number;
  status: PhaseStatus;
  participantCount: number;
  messageCount: number;
  startedAt: string;
  endsAt: string;
  completedAt: string | null;
  summary: InsightSummary | null;
  revivedFromPhaseId: string | null;
};

export type DiscussionMessage = {
  id: string;
  discussionId: string;
  phaseId: string;
  phaseNumber: number;
  parentMessageId: string | null;
  author: Pick<AnonymousUser, "id" | "handle">;
  body: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  isHighlighted: boolean;
  createdAt: string;
};

export type DiscussionCard = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  intent: DiscussionIntent;
  tags: string[];
  status: DiscussionStatus;
  currentPhaseNumber: number;
  reviveCount: number;
  participantCount: number;
  messageCount: number;
  bookmarkCount: number;
  createdAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  endsAt: string | null;
  summary: InsightSummary | null;
  bookmarked: boolean;
};

export type DiscussionDetail = DiscussionCard & {
  createdBy: Pick<AnonymousUser, "id" | "handle">;
  phases: DiscussionPhase[];
  messages: DiscussionMessage[];
  liveSummary: InsightSummary | null;
  joinedCurrentPhase: boolean;
};

export type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type AnonymousBootstrapInput = {
  deviceKey?: string;
};

export type CreateDiscussionInput = {
  userId: string;
  title: string;
  prompt: string;
  intent: DiscussionIntent;
  tags: string[];
  durationMinutes: number;
};

export type JoinDiscussionInput = {
  userId: string;
};

export type PostMessageInput = {
  userId: string;
  body: string;
  parentMessageId?: string | null;
};

export type ToggleVoteInput = {
  userId: string;
};

export type ToggleBookmarkInput = {
  userId: string;
};

export type ReviveDiscussionInput = {
  userId: string;
  durationMinutes: number;
};

export type BootstrapUserRequest = {
  input?: AnonymousBootstrapInput;
};

export type CreateDiscussionRequest = {
  input: CreateDiscussionInput;
};

export type JoinDiscussionRequest = {
  input: JoinDiscussionInput;
};

export type PostMessageRequest = {
  input: PostMessageInput;
};

export type ToggleVoteRequest = {
  input: ToggleVoteInput;
};

export type ToggleBookmarkRequest = {
  input: ToggleBookmarkInput;
};

export type ReviveDiscussionRequest = {
  input: ReviveDiscussionInput;
};

export type BootstrapUserResponse = {
  user: AnonymousUser;
};

export type DiscussionListResponse = {
  items: DiscussionCard[];
  meta: PaginationMeta;
};

export type DiscussionDetailResponse = {
  discussion: DiscussionDetail;
};

export type JoinDiscussionResponse = {
  discussion: DiscussionDetail;
};

export type VoteResponse = {
  messageId: string;
  upvoteCount: number;
  hasUpvoted: boolean;
};

export type BookmarkResponse = {
  discussionId: string;
  bookmarked: boolean;
  bookmarkCount: number;
};

export type ApiErrorResponse = {
  error: string;
};

export type DiscussionFilters = {
  status?: DiscussionStatus | "all";
  sort?: DiscussionSort;
  intent?: DiscussionIntent;
  tag?: string;
  query?: string;
  limit?: number;
  offset?: number;
  userId?: string;
};

import type {
  BookmarkResponse,
  BootstrapUserResponse,
  CreateDiscussionInput,
  DiscussionDetailResponse,
  DiscussionFilters,
  DiscussionListResponse,
  JoinDiscussionResponse,
  PostMessageInput,
  ReviveDiscussionInput,
  ToggleVoteInput,
  VoteResponse
} from "../../shared/types";

const env = import.meta.env as Record<string, string | undefined>;
const apiBase = env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(`${apiBase}${path}`, window.location.origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return apiBase ? url.toString() : `${path}${url.search}`;
}

async function readError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? "The request failed. Please try again.";
}

async function request<T>(path: string, init?: RequestInit, query?: Record<string, string | number | undefined>) {
  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

export async function bootstrapUser(deviceKey?: string) {
  const payload = await request<BootstrapUserResponse>("/api/users/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      input: {
        deviceKey
      }
    })
  });

  return payload.user;
}

export async function listDiscussions(filters: DiscussionFilters = {}) {
  return request<DiscussionListResponse>("/api/discussions", undefined, {
    status: filters.status,
    sort: filters.sort,
    intent: filters.intent,
    tag: filters.tag,
    q: filters.query,
    userId: filters.userId,
    limit: filters.limit,
    offset: filters.offset
  });
}

export async function listInsights(filters: DiscussionFilters = {}) {
  return request<DiscussionListResponse>("/api/discussions/insights/library", undefined, {
    sort: filters.sort,
    intent: filters.intent,
    tag: filters.tag,
    q: filters.query,
    userId: filters.userId,
    limit: filters.limit,
    offset: filters.offset
  });
}

export async function createDiscussion(input: CreateDiscussionInput) {
  const payload = await request<DiscussionDetailResponse>("/api/discussions", {
    method: "POST",
    body: JSON.stringify({ input })
  });

  return payload.discussion;
}

export async function getDiscussion(discussionId: string, userId?: string) {
  const payload = await request<DiscussionDetailResponse>(
    `/api/discussions/${discussionId}`,
    undefined,
    { userId }
  );

  return payload.discussion;
}

export async function joinDiscussion(discussionId: string, userId: string) {
  const payload = await request<JoinDiscussionResponse>(`/api/discussions/${discussionId}/join`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        userId
      }
    })
  });

  return payload.discussion;
}

export async function postMessage(discussionId: string, input: PostMessageInput) {
  const payload = await request<DiscussionDetailResponse>(`/api/discussions/${discussionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ input })
  });

  return payload.discussion;
}

export async function upvoteMessage(messageId: string, input: ToggleVoteInput) {
  return request<VoteResponse>(`/api/messages/${messageId}/votes`, {
    method: "POST",
    body: JSON.stringify({ input })
  });
}

export async function removeUpvote(messageId: string, userId: string) {
  return request<VoteResponse>(`/api/messages/${messageId}/votes`, { method: "DELETE" }, { userId });
}

export async function bookmarkDiscussion(discussionId: string, userId: string) {
  return request<BookmarkResponse>(`/api/discussions/${discussionId}/bookmark`, {
    method: "POST",
    body: JSON.stringify({
      input: {
        userId
      }
    })
  });
}

export async function removeBookmark(discussionId: string, userId: string) {
  return request<BookmarkResponse>(
    `/api/discussions/${discussionId}/bookmark`,
    { method: "DELETE" },
    { userId }
  );
}

export async function reviveDiscussion(discussionId: string, input: ReviveDiscussionInput) {
  const payload = await request<DiscussionDetailResponse>(`/api/discussions/${discussionId}/revive`, {
    method: "POST",
    body: JSON.stringify({ input })
  });

  return payload.discussion;
}

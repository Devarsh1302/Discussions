import {
  discussionIntents,
  discussionSorts,
  discussionStatuses,
  type DiscussionFilters,
  type DiscussionIntent,
  type DiscussionSort,
  type DiscussionStatus
} from "../../shared/types";

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value) {
    return undefined;
  }

  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function parseId(value: string | undefined, fallback = "") {
  return value?.trim() ?? fallback;
}

export function parseStringList(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

export function parsePagination(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(readQueryValue(query.limit) ?? 12) || 12, 1), 50);
  const offset = Math.max(Number(readQueryValue(query.offset) ?? 0) || 0, 0);
  return { limit, offset };
}

export function parseDiscussionFilters(query: Record<string, unknown>): DiscussionFilters {
  const { limit, offset } = parsePagination(query);

  return {
    status: parseEnum<DiscussionStatus | "all">(
      readQueryValue(query.status),
      ["all", ...discussionStatuses]
    ),
    sort: parseEnum<DiscussionSort>(readQueryValue(query.sort), discussionSorts),
    intent: parseEnum<DiscussionIntent>(readQueryValue(query.intent), discussionIntents),
    tag: readQueryValue(query.tag)?.trim(),
    query: readQueryValue(query.q)?.trim(),
    userId: readQueryValue(query.userId)?.trim(),
    limit,
    offset
  };
}

export function ensureString(value: string | undefined, message: string) {
  if (!value?.trim()) {
    throw new HttpError(400, message);
  }

  return value.trim();
}

export function ensureDuration(value: number | undefined) {
  if (!Number.isFinite(value) || Number(value) < 15 || Number(value) > 60) {
    throw new HttpError(400, "Choose a discussion duration between 15 and 60 minutes.");
  }

  return Number(value);
}

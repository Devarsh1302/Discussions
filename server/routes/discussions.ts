import { Router, type Request, type Response } from "express";
import type {
  BookmarkResponse,
  CreateDiscussionRequest,
  DiscussionDetailResponse,
  DiscussionListResponse,
  JoinDiscussionRequest,
  JoinDiscussionResponse,
  PostMessageRequest,
  ReviveDiscussionRequest,
  ToggleBookmarkRequest,
  ToggleVoteRequest,
  VoteResponse
} from "../../shared/types";
import {
  ensureDuration,
  ensureString,
  parseDiscussionFilters,
  parseId,
  parseStringList
} from "../lib/http";
import { DiscussionService } from "../services/discussionService";

export function createDiscussionsRouter(service: DiscussionService) {
  const router = Router();

  router.get(
    "/",
    async (request: Request, response: Response<DiscussionListResponse>, next) => {
      try {
        const result = await service.listDiscussions(parseDiscussionFilters(request.query));
        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/",
    async (
      request: Request<unknown, DiscussionDetailResponse, CreateDiscussionRequest>,
      response: Response<DiscussionDetailResponse>,
      next
    ) => {
      try {
        const input = request.body?.input;
        const discussion = await service.createDiscussion({
          userId: ensureString(input?.userId, "Anonymous user session is required."),
          title: ensureString(input?.title, "Add a discussion title."),
          prompt: ensureString(input?.prompt, "Add the opening question or opinion."),
          intent: input?.intent ?? "opinion",
          tags: parseStringList(input?.tags),
          durationMinutes: ensureDuration(input?.durationMinutes)
        });

        response.status(201).json({ discussion });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/:discussionId",
    async (
      request: Request<{ discussionId: string }>,
      response: Response<DiscussionDetailResponse>,
      next
    ) => {
      try {
        const discussion = await service.getDiscussion(
          request.params.discussionId,
          parseId(request.query.userId?.toString())
        );

        response.json({ discussion });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:discussionId/join",
    async (
      request: Request<{ discussionId: string }, JoinDiscussionResponse, JoinDiscussionRequest>,
      response: Response<JoinDiscussionResponse>,
      next
    ) => {
      try {
        const discussion = await service.joinDiscussion(
          request.params.discussionId,
          ensureString(request.body?.input?.userId, "Anonymous user session is required.")
        );

        response.json({ discussion });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:discussionId/messages",
    async (
      request: Request<{ discussionId: string }, DiscussionDetailResponse, PostMessageRequest>,
      response: Response<DiscussionDetailResponse>,
      next
    ) => {
      try {
        const input = request.body?.input;
        const discussion = await service.addMessage({
          discussionId: request.params.discussionId,
          userId: ensureString(input?.userId, "Anonymous user session is required."),
          body: ensureString(input?.body, "Write a reply before posting."),
          parentMessageId: input?.parentMessageId ?? null
        });

        response.status(201).json({ discussion });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:discussionId/bookmark",
    async (
      request: Request<{ discussionId: string }, BookmarkResponse, ToggleBookmarkRequest>,
      response: Response<BookmarkResponse>,
      next
    ) => {
      try {
        const result = await service.bookmarkDiscussion(
          request.params.discussionId,
          ensureString(request.body?.input?.userId, "Anonymous user session is required.")
        );

        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/:discussionId/bookmark",
    async (
      request: Request<{ discussionId: string }>,
      response: Response<BookmarkResponse>,
      next
    ) => {
      try {
        const result = await service.removeBookmark(
          request.params.discussionId,
          ensureString(request.query.userId?.toString(), "Anonymous user session is required.")
        );

        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:discussionId/revive",
    async (
      request: Request<{ discussionId: string }, DiscussionDetailResponse, ReviveDiscussionRequest>,
      response: Response<DiscussionDetailResponse>,
      next
    ) => {
      try {
        const input = request.body?.input;
        const discussion = await service.reviveDiscussion(request.params.discussionId, {
          userId: ensureString(input?.userId, "Anonymous user session is required."),
          durationMinutes: ensureDuration(input?.durationMinutes)
        });

        response.json({ discussion });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/insights/library",
    async (request: Request, response: Response<DiscussionListResponse>, next) => {
      try {
        const result = await service.listInsights(parseDiscussionFilters(request.query));
        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export function createMessagesRouter(service: DiscussionService) {
  const router = Router();

  router.post(
    "/:messageId/votes",
    async (
      request: Request<{ messageId: string }, VoteResponse, ToggleVoteRequest>,
      response: Response<VoteResponse>,
      next
    ) => {
      try {
        const result = await service.upvoteMessage(
          request.params.messageId,
          ensureString(request.body?.input?.userId, "Anonymous user session is required.")
        );

        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/:messageId/votes",
    async (
      request: Request<{ messageId: string }>,
      response: Response<VoteResponse>,
      next
    ) => {
      try {
        const result = await service.removeVote(
          request.params.messageId,
          ensureString(request.query.userId?.toString(), "Anonymous user session is required.")
        );

        response.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

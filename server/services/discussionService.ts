import type { CreateDiscussionInput, DiscussionFilters, ReviveDiscussionInput } from "../../shared/types";
import { HttpError } from "../lib/http";
import { PhaseFinalizer } from "./phaseFinalizer";
import { generateSummary } from "./summaryService";
import type { DiscussionDetailParts, DiscussionRepositoryLike } from "../repositories/repositoryContract";

export class DiscussionService {
  constructor(
    private readonly repository: DiscussionRepositoryLike,
    private readonly finalizer: PhaseFinalizer
  ) {}

  async bootstrapUser(deviceKey?: string) {
    return this.repository.bootstrapUser(deviceKey);
  }

  async listDiscussions(filters: DiscussionFilters) {
    await this.finalizer.flushExpired();
    return this.repository.listDiscussions(filters);
  }

  async listInsights(filters: DiscussionFilters) {
    return this.listDiscussions({
      ...filters,
      status: "completed"
    });
  }

  async getDiscussion(discussionId: string, viewerUserId?: string) {
    await this.finalizer.flushExpired();
    const detail = await this.repository.getDiscussionDetail(discussionId, viewerUserId);

    if (!detail) {
      throw new HttpError(404, "Discussion not found.");
    }

    return this.attachLiveSummary(detail);
  }

  async createDiscussion(input: CreateDiscussionInput) {
    await this.repository.assertUserExists(input.userId);
    const discussionId = await this.repository.createDiscussion({
      userId: input.userId,
      title: input.title.trim(),
      prompt: input.prompt.trim(),
      intent: input.intent,
      tags: input.tags,
      durationMinutes: input.durationMinutes
    });

    return this.getDiscussion(discussionId, input.userId);
  }

  async joinDiscussion(discussionId: string, userId: string) {
    await this.finalizer.flushExpired();
    await this.repository.assertUserExists(userId);
    await this.repository.joinCurrentPhase(discussionId, userId);
    return this.getDiscussion(discussionId, userId);
  }

  async addMessage(input: {
    discussionId: string;
    userId: string;
    body: string;
    parentMessageId?: string | null;
  }) {
    await this.finalizer.flushExpired();
    await this.repository.assertUserExists(input.userId);
    await this.repository.addMessage({
      discussionId: input.discussionId,
      userId: input.userId,
      body: input.body.trim(),
      parentMessageId: input.parentMessageId ?? null
    });

    return this.getDiscussion(input.discussionId, input.userId);
  }

  async upvoteMessage(messageId: string, userId: string) {
    await this.repository.assertUserExists(userId);
    return this.repository.addVote(messageId, userId);
  }

  async removeVote(messageId: string, userId: string) {
    await this.repository.assertUserExists(userId);
    return this.repository.removeVote(messageId, userId);
  }

  async bookmarkDiscussion(discussionId: string, userId: string) {
    await this.repository.assertUserExists(userId);
    return this.repository.addBookmark(discussionId, userId);
  }

  async removeBookmark(discussionId: string, userId: string) {
    await this.repository.assertUserExists(userId);
    return this.repository.removeBookmark(discussionId, userId);
  }

  async reviveDiscussion(discussionId: string, input: ReviveDiscussionInput) {
    await this.finalizer.flushExpired();
    await this.repository.assertUserExists(input.userId);
    await this.repository.reviveDiscussion({
      discussionId,
      userId: input.userId,
      durationMinutes: input.durationMinutes
    });

    return this.getDiscussion(discussionId, input.userId);
  }

  private attachLiveSummary(detail: DiscussionDetailParts | null) {
    if (!detail) {
      throw new HttpError(404, "Discussion not found.");
    }

    const currentPhaseMessages = detail.messages
      .filter((message) => message.phaseNumber === detail.base.currentPhaseNumber)
      .map((message) => ({
        id: message.id,
        phaseNumber: message.phaseNumber,
        authorHandle: message.author.handle,
        body: message.body,
        upvoteCount: message.upvoteCount,
        createdAt: message.createdAt
      }));

    const liveSummary =
      detail.base.status === "active"
        ? generateSummary(currentPhaseMessages, "live")
        : detail.phases[detail.phases.length - 1]?.summary ?? detail.base.summary;

    return this.repository.toDetail(detail, liveSummary ?? null);
  }
}

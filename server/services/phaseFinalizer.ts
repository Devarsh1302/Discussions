import { generateSummary } from "./summaryService";
import type { DiscussionRepositoryLike } from "../repositories/repositoryContract";

export class PhaseFinalizer {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly repository: DiscussionRepositoryLike) {}

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.flushExpired().catch((error) => {
        console.error("Phase finalizer failed:", error);
      });
    }, 30_000);

    this.timer.unref();
  }

  async flushExpired() {
    const expired = await this.repository.findExpiredActivePhases();

    for (const phase of expired) {
      const [phaseMessages, discussionMessages] = await Promise.all([
        this.repository.listSummaryMessagesForPhase(phase.id),
        this.repository.listSummaryMessagesForDiscussion(phase.discussion_id)
      ]);

      const phaseSummary = generateSummary(phaseMessages, "phase");
      const discussionSummary = generateSummary(discussionMessages, "discussion");

      await this.repository.completeExpiredPhase({
        phaseId: phase.id,
        discussionId: phase.discussion_id,
        phaseSummary,
        discussionSummary,
        highlightedMessageIds: phaseSummary.topInsights.map((item) => item.messageId)
      });
    }
  }
}

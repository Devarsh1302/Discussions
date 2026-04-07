import { LoaderCircle, MessageSquareReply, RefreshCw, Repeat2, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, type FormEvent } from "react";
import type { AnonymousUser, DiscussionDetail, DiscussionMessage } from "../../shared/types";
import { Card } from "../components/Card";
import { MessageList } from "../components/MessageList";
import { PhaseTimeline } from "../components/PhaseTimeline";
import { SummaryPanel } from "../components/SummaryPanel";
import { Timer } from "../components/Timer";
import {
  bookmarkDiscussion,
  getDiscussion,
  joinDiscussion,
  postMessage,
  removeBookmark,
  removeUpvote,
  reviveDiscussion,
  upvoteMessage
} from "../lib/api";
import { formatAbsoluteTime, formatIntent, formatRelativeTime } from "../lib/format";

type DiscussionPageProps = {
  user: AnonymousUser;
  discussionId: string;
  navigate: (path: string) => void;
};

const composerClass =
  "w-full rounded-[16px] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-[#f4a261]/30 focus:bg-[#f4a261]/10";

export function DiscussionPage({ user, discussionId, navigate }: DiscussionPageProps) {
  const [discussion, setDiscussion] = useState<DiscussionDetail | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [reviveMinutes, setReviveMinutes] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const detail = await joinDiscussion(discussionId, user.id);

        if (!cancelled) {
          setDiscussion(detail);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not open discussion.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [discussionId, user.id]);

  useEffect(() => {
    if (!discussion || discussion.status !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      getDiscussion(discussion.id, user.id)
        .then((detail) => setDiscussion(detail))
        .catch(() => undefined);
    }, 12_000);

    return () => window.clearInterval(timer);
  }, [discussion, user.id]);

  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!discussion) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const detail = await postMessage(discussion.id, {
        userId: user.id,
        body: replyBody,
        parentMessageId: replyToId
      });

      setDiscussion(detail);
      setReplyBody("");
      setReplyToId(null);
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Reply could not be posted.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleVote(message: DiscussionMessage) {
    try {
      const result = message.hasUpvoted
        ? await removeUpvote(message.id, user.id)
        : await upvoteMessage(message.id, { userId: user.id });

      setDiscussion((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((item) =>
                item.id === message.id
                  ? {
                      ...item,
                      upvoteCount: result.upvoteCount,
                      hasUpvoted: result.hasUpvoted,
                      isHighlighted: result.upvoteCount >= 3
                    }
                  : item
              )
            }
          : current
      );
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "Vote failed.");
    }
  }

  async function handleBookmark() {
    if (!discussion) {
      return;
    }

    try {
      const result = discussion.bookmarked
        ? await removeBookmark(discussion.id, user.id)
        : await bookmarkDiscussion(discussion.id, user.id);

      setDiscussion((current) =>
        current
          ? {
              ...current,
              bookmarked: result.bookmarked,
              bookmarkCount: result.bookmarkCount
            }
          : current
      );
    } catch (bookmarkError) {
      setError(bookmarkError instanceof Error ? bookmarkError.message : "Bookmark failed.");
    }
  }

  async function handleRevive() {
    if (!discussion) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const detail = await reviveDiscussion(discussion.id, {
        userId: user.id,
        durationMinutes: reviveMinutes
      });

      setDiscussion(detail);
    } catch (reviveError) {
      setError(reviveError instanceof Error ? reviveError.message : "Revive failed.");
    } finally {
      setIsSaving(false);
    }
  }

  if (error && !discussion && !isLoading) {
    return (
      <Card className="p-6">
        <div className="text-sm text-rose-100">{error}</div>
      </Card>
    );
  }

  if (isLoading || !discussion) {
    return (
      <Card className="p-6">
        <div className="inline-flex items-center gap-3 text-white">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading discussion
        </div>
      </Card>
    );
  }

  const replyTarget = replyToId ? discussion.messages.find((message) => message.id === replyToId) : null;
  const canPost = discussion.status === "active";

  return (
    <div className="space-y-4">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition hover:text-zinc-300"
              >
                Back to Explore
              </button>
              <h1 className="mt-3 font-display text-3xl leading-tight text-white sm:text-[2rem]">{discussion.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">{discussion.prompt}</p>
            </div>

            <div className="grid gap-3">
              <Timer endsAt={discussion.endsAt} status={discussion.status} />
              <button
                type="button"
                onClick={handleBookmark}
                className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                  discussion.bookmarked
                    ? "border-amber-300/30 bg-amber-400/12 text-amber-50"
                    : "border-white/10 bg-white/5 text-white hover:border-amber-300/25 hover:bg-amber-400/10"
                }`}
              >
                <Star className="h-4 w-4" />
                {discussion.bookmarked ? "Bookmarked" : "Bookmark"}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <StatPill label={formatIntent(discussion.intent)} />
            <StatPill label={`${discussion.participantCount} participants`} />
            <StatPill label={`${discussion.messageCount} total replies`} />
            <StatPill label={`${discussion.reviveCount} revives`} />
            <StatPill label={`Started ${formatRelativeTime(discussion.createdAt)}`} />
          </div>

          <div className="mt-4 text-[11px] text-zinc-500">
            Created by {discussion.createdBy.handle} on {formatAbsoluteTime(discussion.createdAt)}
          </div>
        </Card>
      </motion.section>

      {error && <Card className="p-4 text-sm text-rose-100">{error}</Card>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="space-y-4">
          <SummaryPanel
            title={discussion.status === "active" ? "Live Insight Read" : "Insight Summary"}
            summary={discussion.status === "active" ? discussion.liveSummary : discussion.summary}
            statusLabel={discussion.status === "active" ? "Live summary" : "Permanent insight"}
          />

          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Conversation</div>
                <h2 className="mt-2 font-display text-2xl text-white">Replies Across Phases</h2>
              </div>

              <button
                type="button"
                onClick={() => getDiscussion(discussion.id, user.id).then(setDiscussion).catch(() => undefined)}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm text-zinc-300 transition hover:border-[#f4a261]/30 hover:bg-[#f4a261]/12"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="mt-4">
              <MessageList
                messages={discussion.messages}
                canInteract={canPost}
                onReply={setReplyToId}
                onVote={handleVote}
              />
            </div>
          </Card>

          <Card className="p-5">
            {canPost ? (
              <form onSubmit={handlePost} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Reply</div>
                    <h3 className="mt-2 font-display text-xl text-white">Contribute to this phase</h3>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-300">
                    Posting as {user.handle}
                  </div>
                </div>

                {replyTarget && (
                  <div className="rounded-[16px] border border-white/10 bg-white/5 px-3.5 py-3.5 text-sm text-zinc-300">
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      <MessageSquareReply className="h-4 w-4" />
                      Replying to {replyTarget.author.handle}
                    </div>
                    <p className="mt-2.5 leading-6">{replyTarget.body}</p>
                    <button
                      type="button"
                      onClick={() => setReplyToId(null)}
                      className="mt-2.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition hover:text-zinc-300"
                    >
                      Clear reply target
                    </button>
                  </div>
                )}

                <textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder="Add a perspective that could become part of the insight summary."
                  rows={5}
                  className={composerClass}
                />

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#f4a261,#ffba7a)] px-5 text-sm font-semibold text-[#23120a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? "Posting..." : "Post reply"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Insight Mode</div>
                  <h3 className="mt-2 font-display text-xl text-white">This phase is now read-only</h3>
                </div>
                <p className="text-sm leading-6 text-zinc-300">
                  The timer has ended, so the discussion is preserved as an insight summary. You can
                  reopen it with a fresh timer and keep all previous phases intact.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  {[15, 30, 45, 60].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setReviveMinutes(minutes)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        reviveMinutes === minutes
                          ? "border-[#f4a261]/35 bg-[#f4a261]/15 text-[#ffe0cf]"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-[#f4a261]/30 hover:bg-[#f4a261]/12"
                      }`}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleRevive}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#f4a261,#ffba7a)] px-5 text-sm font-semibold text-[#23120a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Repeat2 className="h-4 w-4" />
                  {isSaving ? "Reviving..." : "Revive Discussion"}
                </button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <PhaseTimeline phases={discussion.phases} />
        </div>
      </div>
    </div>
  );
}

function StatPill({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
      {label}
    </div>
  );
}

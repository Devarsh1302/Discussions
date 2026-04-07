import { MessageSquareReply, Sparkles, ThumbsUp } from "lucide-react";
import type { DiscussionMessage } from "../../shared/types";
import { formatAbsoluteTime, formatPhaseLabel } from "../lib/format";

type MessageListProps = {
  messages: DiscussionMessage[];
  canInteract: boolean;
  onReply: (messageId: string) => void;
  onVote: (message: DiscussionMessage) => void;
};

export function MessageList({ messages, canInteract, onReply, onVote }: MessageListProps) {
  const parentById = new Map(messages.map((message) => [message.id, message]));
  let currentPhase = -1;

  if (messages.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm leading-6 text-zinc-400">
        No replies yet. The first strong point often sets the tone for the whole insight summary.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const showPhaseLabel = currentPhase !== message.phaseNumber;
        currentPhase = message.phaseNumber;
        const parent = message.parentMessageId ? parentById.get(message.parentMessageId) : null;

        return (
          <div key={message.id}>
            {showPhaseLabel && (
              <div className="mb-2.5 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                {formatPhaseLabel(message.phaseNumber)}
              </div>
            )}

            <article className="rounded-[18px] border border-white/8 bg-black/20 px-3.5 py-3.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    {message.author.handle}
                    {message.isHighlighted && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#f6c453]/30 bg-[#f6c453]/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#ffe29c]">
                        <Sparkles className="h-3 w-3" />
                        Most Insightful
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{formatAbsoluteTime(message.createdAt)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => onVote(message)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition ${
                    message.hasUpvoted
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-50"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:border-emerald-300/25 hover:bg-emerald-400/10"
                  }`}
                >
                  <ThumbsUp className="h-4 w-4" />
                  {message.upvoteCount}
                </button>
              </div>

              {parent && (
                <div className="mt-3 rounded-[14px] border border-white/8 bg-white/5 px-3 py-2.5 text-xs leading-5 text-zinc-400">
                  Replying to {parent.author.handle}: "{truncate(parent.body)}"
                </div>
              )}

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{message.body}</p>

              {canInteract && (
                <button
                  type="button"
                  onClick={() => onReply(message.id)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300 transition hover:border-[#f4a261]/30 hover:bg-[#f4a261]/12"
                >
                  <MessageSquareReply className="h-4 w-4" />
                  Reply
                </button>
              )}
            </article>
          </div>
        );
      })}
    </div>
  );
}

function truncate(value: string) {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}

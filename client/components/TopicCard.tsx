import { ArrowRight, Bookmark, MessageSquareText, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { DiscussionCard } from "../../shared/types";
import { formatAbsoluteTime, formatRelativeTime } from "../lib/format";
import { Card } from "./Card";
import { IntentBadge } from "./IntentBadge";
import { Timer } from "./Timer";

type TopicCardProps = {
  discussion: DiscussionCard;
  onOpen: (discussionId: string) => void;
};

export function TopicCard({ discussion, onOpen }: TopicCardProps) {
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IntentBadge intent={discussion.intent} />
        <Timer endsAt={discussion.endsAt} status={discussion.status} />
      </div>

      <div className="mt-4 flex-1">
        <h3 className="font-display text-xl leading-tight text-white">{discussion.title}</h3>
        <p className="mt-2.5 max-h-[72px] overflow-hidden text-sm leading-6 text-zinc-300">
          {discussion.prompt}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {discussion.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-zinc-300"
            >
              #{tag}
            </span>
          ))}
        </div>

        {discussion.summary?.keyPoints[0] && (
          <div className="mt-4 rounded-[18px] border border-white/8 bg-black/20 px-3.5 py-3.5">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
              <Sparkles className="h-3.5 w-3.5" />
              Insight Snapshot
            </div>
            <p className="mt-2.5 text-sm leading-6 text-zinc-200">{discussion.summary.keyPoints[0]}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <StatChip icon={<Users className="h-4 w-4" />} label={`${discussion.participantCount} joined`} />
        <StatChip icon={<MessageSquareText className="h-4 w-4" />} label={`${discussion.messageCount} replies`} />
        <StatChip icon={<Bookmark className="h-4 w-4" />} label={`${discussion.bookmarkCount} saves`} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-xs text-zinc-500">
          Started {formatRelativeTime(discussion.createdAt)}
          <div className="mt-1">{formatAbsoluteTime(discussion.createdAt)}</div>
        </div>
        <button
          type="button"
          onClick={() => onOpen(discussion.id)}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:border-[#f4a261]/30 hover:bg-[#f4a261]/12"
        >
          Open
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

function StatChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5">
      {icon}
      {label}
    </div>
  );
}

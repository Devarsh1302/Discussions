import type { DiscussionPhase } from "../../shared/types";
import { formatAbsoluteTime, formatPhaseLabel, formatStatus } from "../lib/format";
import { Card } from "./Card";

export function PhaseTimeline({ phases }: { phases: DiscussionPhase[] }) {
  return (
    <Card className="p-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Lifecycle</div>
      <h3 className="mt-2.5 font-display text-xl text-white">Discussion Phases</h3>

      <div className="mt-5 space-y-3">
        {phases.map((phase) => (
          <div
            key={phase.id}
            className="rounded-[18px] border border-white/8 bg-black/20 px-3.5 py-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{formatPhaseLabel(phase.phaseNumber)}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {formatAbsoluteTime(phase.startedAt)} to {formatAbsoluteTime(phase.endsAt)}
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                {formatStatus(phase.status)}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
              <span className="rounded-full border border-white/10 px-2.5 py-1">{phase.participantCount} participants</span>
              <span className="rounded-full border border-white/10 px-2.5 py-1">{phase.messageCount} replies</span>
              <span className="rounded-full border border-white/10 px-2.5 py-1">{phase.durationMinutes} minutes</span>
            </div>

            {phase.summary?.keyPoints[0] && (
              <p className="mt-3 text-sm leading-6 text-zinc-300">{phase.summary.keyPoints[0]}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

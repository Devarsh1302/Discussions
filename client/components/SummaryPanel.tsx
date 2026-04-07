import type { InsightSummary } from "../../shared/types";
import { Card } from "./Card";

type SummaryPanelProps = {
  title: string;
  summary: InsightSummary | null;
  statusLabel: string;
};

export function SummaryPanel({ title, summary, statusLabel }: SummaryPanelProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{statusLabel}</div>
          <h3 className="mt-2.5 font-display text-xl text-white">{title}</h3>
        </div>
      </div>

      {!summary ? (
        <div className="mt-5 rounded-[18px] border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-zinc-400">
          The placeholder summariser will populate this panel as the conversation gains enough signal.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <p className="text-sm leading-6 text-zinc-300">{summary.narrative}</p>

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Key Takeaways</div>
            <div className="mt-2.5 space-y-2.5">
              {summary.keyPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-[16px] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-6 text-zinc-200"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Opinion Split</div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <MetricCard label="Agree" value={`${summary.opinionSplit.agree}%`} tone="emerald" />
              <MetricCard label="Disagree" value={`${summary.opinionSplit.disagree}%`} tone="amber" />
              <MetricCard label="Neutral" value={`${summary.opinionSplit.neutral}%`} tone="zinc" />
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Top Insights</div>
            <div className="mt-2.5 space-y-2.5">
              {summary.topInsights.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-white/10 bg-black/20 px-4 py-3.5 text-sm text-zinc-400">
                  Top insights appear after participants upvote standout replies.
                </div>
              ) : (
                summary.topInsights.map((item) => (
                  <div
                    key={item.messageId}
                    className="rounded-[16px] border border-white/8 bg-black/20 px-3.5 py-3.5"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                      <span>{item.authorHandle}</span>
                      <span>{item.upvoteCount} upvotes</span>
                    </div>
                    <p className="mt-2.5 text-sm leading-6 text-zinc-200">{item.excerpt}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "zinc";
}) {
  const classes = {
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-50",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-50",
    zinc: "border-white/10 bg-white/5 text-zinc-100"
  };

  return (
    <div className={`rounded-[16px] border px-3.5 py-3 ${classes[tone]}`}>
      <div className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</div>
      <div className="mt-1.5 font-display text-2xl">{value}</div>
    </div>
  );
}

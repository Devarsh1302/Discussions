import { useEffect, useState } from "react";
import type { DiscussionStatus } from "../../shared/types";
import { formatCountdown, formatStatus } from "../lib/format";

type TimerProps = {
  endsAt: string | null;
  status: DiscussionStatus;
};

export function Timer({ endsAt, status }: TimerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!endsAt || status !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [endsAt, status]);

  if (!endsAt || status !== "active") {
    return (
      <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-300">
        {formatStatus(status)}
      </div>
    );
  }

  return (
    <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
      {formatCountdown(endsAt)} left
    </div>
  );
}

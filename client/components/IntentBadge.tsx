import type { DiscussionIntent } from "../../shared/types";
import { formatIntent } from "../lib/format";

const palette: Record<DiscussionIntent, string> = {
  debate: "border-[#f6c453]/30 bg-[#f6c453]/15 text-[#ffe29c]",
  help: "border-[#78d0ff]/30 bg-[#78d0ff]/15 text-[#d7f0ff]",
  opinion: "border-[#8ef2bb]/30 bg-[#8ef2bb]/15 text-[#dcffed]",
  fun: "border-[#ff9d85]/30 bg-[#ff9d85]/15 text-[#ffe0d7]"
};

export function IntentBadge({ intent }: { intent: DiscussionIntent }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${palette[intent]}`}
    >
      {formatIntent(intent)}
    </span>
  );
}

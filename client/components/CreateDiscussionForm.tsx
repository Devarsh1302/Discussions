import { LoaderCircle, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { AnonymousUser, CreateDiscussionInput, DiscussionIntent } from "../../shared/types";
import { IntentBadge } from "./IntentBadge";

type CreateDiscussionFormProps = {
  user: AnonymousUser;
  onSubmit: (input: CreateDiscussionInput) => Promise<void>;
};

const durations = [15, 30, 45, 60];
const intents: DiscussionIntent[] = ["debate", "help", "opinion", "fun"];
const inputClass =
  "w-full rounded-[16px] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-500 focus:border-[#f4a261]/30 focus:bg-[#f4a261]/10";

export function CreateDiscussionForm({ user, onSubmit }: CreateDiscussionFormProps) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tags, setTags] = useState("AI, Career");
  const [intent, setIntent] = useState<DiscussionIntent>("opinion");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        userId: user.id,
        title,
        prompt,
        intent,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        durationMinutes
      });

      setTitle("");
      setPrompt("");
      setTags("");
      setIntent("opinion");
      setDurationMinutes(30);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Discussion could not be created.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#f4a261]/25 bg-[#f4a261]/12 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#ffd2bd]">
        <Sparkles className="h-4 w-4" />
        New Discussion
      </div>

      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Posting as</div>
        <div className="mt-2 rounded-[16px] border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-200">
          {user.handle}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Topic Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Should AI feedback be part of college grading?"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Opening Prompt</label>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Frame the discussion with context, tension, or the core question."
          rows={4}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Intent</label>
        <div className="flex flex-wrap gap-2.5">
          {intents.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIntent(option)}
              className={`rounded-full border px-1.5 py-1.5 transition ${
                intent === option
                  ? "border-white/0 bg-transparent"
                  : "border-white/10 bg-white/5 hover:border-[#f4a261]/30 hover:bg-[#f4a261]/12"
              }`}
            >
              <IntentBadge intent={option} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Tags</label>
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="AI, College, Career"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Duration</label>
        <div className="flex flex-wrap gap-2.5">
          {durations.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setDurationMinutes(minutes)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                durationMinutes === minutes
                  ? "border-[#f4a261]/35 bg-[#f4a261]/15 text-[#ffe0cf]"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:border-[#f4a261]/30 hover:bg-[#f4a261]/12"
              }`}
            >
              {minutes} min
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-[16px] border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#f4a261,#ffba7a)] px-5 text-sm font-semibold text-[#23120a] shadow-[0_14px_30px_rgba(244,162,97,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Creating discussion
          </>
        ) : (
          "Launch discussion"
        )}
      </button>
    </form>
  );
}

import {
  ArrowRight,
  Bookmark,
  Clock3,
  LibraryBig,
  MessageSquareText,
  Repeat2,
  Sparkles,
  Users
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import type { AnonymousUser, DiscussionCard, DiscussionFilters } from "../../shared/types";
import { Card } from "../components/Card";
import { CreateDiscussionForm } from "../components/CreateDiscussionForm";
import { TopicCard } from "../components/TopicCard";
import { createDiscussion, listDiscussions } from "../lib/api";

type ExplorePageProps = {
  user: AnonymousUser;
  navigate: (path: string) => void;
};

const intents = ["all", "debate", "help", "opinion", "fun"] as const;
const sorts = ["trending", "latest", "insightful"] as const;

export function ExplorePage({ user, navigate }: ExplorePageProps) {
  const [sort, setSort] = useState<(typeof sorts)[number]>("trending");
  const [intent, setIntent] = useState<(typeof intents)[number]>("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DiscussionCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const filters: DiscussionFilters = {
          status: "active",
          sort,
          query: query.trim() || undefined,
          intent: intent === "all" ? undefined : intent,
          userId: user.id
        };

        const result = await listDiscussions(filters);

        if (!cancelled) {
          setItems(result.items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load discussions.");
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
  }, [intent, query, sort, user.id]);

  async function handleCreate(input: Parameters<typeof createDiscussion>[0]) {
    const discussion = await createDiscussion(input);
    navigate(`/discussions/${discussion.id}`);
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  return (
    <div className="space-y-10">
      <motion.section
        id="home"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <Card className="overflow-hidden px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <div className="relative text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#d7954b]/20 bg-[#d7954b]/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-[#efc086]">
              <Sparkles className="h-3.5 w-3.5" />
              Thoughtful anonymous discourse
            </div>

            <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl leading-[0.94] text-[#f4eee8] sm:text-7xl lg:text-[6.2rem]">
              Where Better
              <span className="block text-[#d7954b]">Discussions Become Insight</span>
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#c8b6a3] sm:text-lg">
              Join time-boxed discussions around meaningful topics, surface the strongest takes,
              and keep every finished conversation as something worth returning to.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => scrollToSection("live-topics")}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#d7954b] px-6 text-sm font-semibold text-[#1f130a] transition hover:brightness-110"
              >
                Browse Live Topics
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/insights")}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#d7954b]/25 bg-transparent px-6 text-sm font-semibold text-[#efc086] transition hover:bg-[#d7954b]/10"
              >
                Open Insights Library
              </button>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-[#b89c82]">
              <HeroPill icon={<Users className="h-4 w-4" />} label="Anonymous voices" />
              <HeroPill icon={<Clock3 className="h-4 w-4" />} label="15 to 60 minute phases" />
              <HeroPill icon={<Repeat2 className="h-4 w-4" />} label="Revive anytime" />
            </div>
          </div>
        </Card>
      </motion.section>

      <motion.section
        id="how-it-works"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.06 }}
        className="space-y-6"
      >
        <SectionIntro
          eyebrow="How It Works"
          title="Four simple steps to your next meaningful discussion."
          description="The product is built around timed phases, lightweight participation, and durable insight after the timer ends."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <FlowCard
            icon={<LibraryBig className="h-5 w-5" />}
            title="Browse Topics"
            description="Open a live topic or start a new one with the intent, tags, and timer that fit the conversation."
          />
          <FlowCard
            icon={<Users className="h-5 w-5" />}
            title="Join Anonymously"
            description="Enter instantly with an auto-generated handle so the discussion stays low-friction and opinion-first."
          />
          <FlowCard
            icon={<MessageSquareText className="h-5 w-5" />}
            title="Contribute In Real Time"
            description="Reply, upvote strong points, and watch a live insight read evolve as the phase unfolds."
          />
          <FlowCard
            icon={<Repeat2 className="h-5 w-5" />}
            title="Lock, Learn, Revive"
            description="When the timer ends the topic becomes insight content, and you can reopen it later as a new phase."
          />
        </div>
      </motion.section>

      <motion.section
        id="features"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="space-y-6"
      >
        <SectionIntro
          eyebrow="Features"
          title="Built for discussions that should stay useful after they end."
          description="Not chat rooms, not disappearing threads. Every decision in the interface pushes the conversation toward signal."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            title="Timed Phases"
            description="Each discussion runs in a fixed window, creating urgency without turning into an endless feed."
            icon={<Clock3 className="h-5 w-5" />}
          />
          <FeatureCard
            title="Live Insight Read"
            description="Participants can see the strongest themes, opinion split, and standout replies forming in real time."
            icon={<Sparkles className="h-5 w-5" />}
          />
          <FeatureCard
            title="Permanent Insight Library"
            description="Completed discussions become reusable content that can be bookmarked, revisited, and revived."
            icon={<Bookmark className="h-5 w-5" />}
          />
        </div>
      </motion.section>

      <motion.section
        id="live-topics"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.14 }}
        className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]"
      >
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Home</div>
                <h2 className="mt-2 font-display text-3xl text-white">Active Topics</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Explore what is live right now, or filter down to the kind of discussion you want to join.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, prompt, tag"
                  className="rounded-[14px] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#d7954b]/30"
                />

                <select
                  value={intent}
                  onChange={(event) => setIntent(event.target.value as (typeof intents)[number])}
                  className="rounded-[14px] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#d7954b]/30"
                >
                  {intents.map((option) => (
                    <option key={option} value={option} className="bg-[#1a1718]">
                      {option === "all" ? "All intents" : option}
                    </option>
                  ))}
                </select>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as (typeof sorts)[number])}
                  className="rounded-[14px] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#d7954b]/30"
                >
                  {sorts.map((option) => (
                    <option key={option} value={option} className="bg-[#1a1718]">
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {error ? (
            <Card className="p-6 text-sm text-rose-100">{error}</Card>
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="loading-shimmer h-[270px]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="p-8 text-center">
              <h3 className="font-display text-2xl text-white">No active discussions yet</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Start the first timed topic and seed the library with an insight-worthy conversation.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((discussion) => (
                <TopicCard
                  key={discussion.id}
                  discussion={discussion}
                  onOpen={(nextDiscussionId) => navigate(`/discussions/${nextDiscussionId}`)}
                />
              ))}
            </div>
          )}
        </div>

        <div id="start-discussion" className="xl:sticky xl:top-28">
          <Card className="p-5">
            <CreateDiscussionForm user={user} onSubmit={handleCreate} />
          </Card>
        </div>
      </motion.section>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[#b89675]">{eyebrow}</div>
      <h2 className="mt-2 font-display text-4xl leading-tight text-[#f4eee8] sm:text-5xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[#bca895] sm:text-base">{description}</p>
    </div>
  );
}

function FlowCard({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#d7954b]/20 bg-[#d7954b]/10 text-[#eab36d]">
        {icon}
      </div>
      <div>
        <h3 className="font-display text-2xl text-[#f4eee8]">{title}</h3>
        <p className="mt-2 text-base leading-8 text-[#bca895]">{description}</p>
      </div>
    </Card>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-6">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#d7954b]/20 bg-[#d7954b]/10 text-[#eab36d]">
        {icon}
      </div>
      <h3 className="mt-5 font-display text-[2rem] leading-none text-[#f4eee8]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#bca895]">{description}</p>
    </Card>
  );
}

function HeroPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
      {icon}
      {label}
    </div>
  );
}

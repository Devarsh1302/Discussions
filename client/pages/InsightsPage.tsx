import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AnonymousUser, DiscussionCard } from "../../shared/types";
import { Card } from "../components/Card";
import { TopicCard } from "../components/TopicCard";
import { listInsights } from "../lib/api";

type InsightsPageProps = {
  user: AnonymousUser;
  navigate: (path: string) => void;
};

const sorts = ["latest", "trending", "insightful"] as const;

export function InsightsPage({ user, navigate }: InsightsPageProps) {
  const [sort, setSort] = useState<(typeof sorts)[number]>("latest");
  const [items, setItems] = useState<DiscussionCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await listInsights({
          sort,
          userId: user.id
        });

        if (!cancelled) {
          setItems(result.items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load insights.");
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
  }, [sort, user.id]);

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Insights Library</div>
              <h1 className="mt-2 font-display text-3xl leading-tight text-white sm:text-4xl">
                Completed discussions, preserved as structured insight.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
                Explore discussions after they lock, compare opinion splits, and reopen them later as
                new phases without losing earlier takeaways.
              </p>
            </div>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as (typeof sorts)[number])}
              className="rounded-[14px] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#f4a261]/30"
            >
              {sorts.map((option) => (
                <option key={option} value={option} className="bg-[#1a1718]">
                  sort: {option}
                </option>
              ))}
            </select>
          </div>
        </Card>
      </motion.section>

      {error ? (
        <Card className="p-6 text-sm text-rose-100">{error}</Card>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="loading-shimmer h-[260px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="font-display text-2xl text-white">No completed insights yet</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Once a discussion timer ends, it will move here as permanent content.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
  );
}

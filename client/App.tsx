import { LoaderCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AnonymousUser } from "../shared/types";
import { Card } from "./components/Card";
import { bootstrapUser } from "./lib/api";
import { useRoute } from "./lib/router";
import { persistUser, readStoredUser } from "./lib/session";
import { DiscussionPage } from "./pages/DiscussionPage";
import { ExplorePage } from "./pages/ExplorePage";
import { InsightsPage } from "./pages/InsightsPage";

export default function App() {
  const [user, setUser] = useState<AnonymousUser | null>(() => readStoredUser());
  const [bootError, setBootError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(!readStoredUser());
  const { route, navigate } = useRoute();

  useEffect(() => {
    let cancelled = false;

    async function ensureUser() {
      setIsBooting(true);

      try {
        const nextUser = await bootstrapUser(readStoredUser()?.deviceKey);

        if (!cancelled) {
          setUser(nextUser);
          persistUser(nextUser);
          setBootError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : "Could not start anonymous session.");
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    ensureUser();

    return () => {
      cancelled = true;
    };
  }, []);

  function scrollHomeSection(sectionId?: string) {
    const scroll = () => {
      if (!sectionId) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    };

    if (route.name !== "explore") {
      navigate("/");
      window.setTimeout(scroll, 120);
      return;
    }

    scroll();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120f10] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,162,97,0.18),transparent_22%),radial-gradient(circle_at_85%_15%,rgba(65,145,196,0.12),transparent_18%),linear-gradient(180deg,#120f10_0%,#0a090a_40%,#151113_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(215,149,75,0.42)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.02)_0%,transparent_48%,rgba(255,255,255,0.02)_100%)]" />

      <div className="relative mx-auto min-h-screen w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-40 mb-6 flex flex-col gap-4 rounded-[22px] border border-white/10 bg-[#171417]/85 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d7954b]/25 bg-[#d7954b]/12 font-accent text-sm font-semibold text-[#f0b970]">
              DS
            </div>
            <div>
              <div className="font-display text-[1.95rem] leading-none text-white">Discussions</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.28em] text-[#c0a68a]">
                Where ideas become insight
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-300 sm:flex-1">
            <HeaderLink active={route.name === "explore"} label="Home" onClick={() => scrollHomeSection()} />
            <HeaderLink label="How It Works" onClick={() => scrollHomeSection("how-it-works")} />
            <HeaderLink label="Features" onClick={() => scrollHomeSection("features")} />
          </nav>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/insights")}
              className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3.5 text-sm font-semibold text-zinc-200 transition hover:border-[#d7954b]/30 hover:bg-[#d7954b]/12 hover:text-white"
            >
              Insights
            </button>
            <button
              type="button"
              onClick={() => scrollHomeSection("start-discussion")}
              className="inline-flex min-h-9 items-center rounded-full bg-[#d7954b] px-4 text-sm font-semibold text-[#1f130a] transition hover:brightness-110"
            >
              Start Topic
            </button>
          </div>
        </header>

        <main className="mt-6">
          {bootError ? (
            <Card className="p-6 text-sm text-rose-100">{bootError}</Card>
          ) : isBooting || !user ? (
            <Card className="p-6">
              <div className="inline-flex items-center gap-3 text-white">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Starting anonymous session
              </div>
            </Card>
          ) : (
            <motion.div
              key={route.name === "discussion" ? route.discussionId : route.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {route.name === "explore" && <ExplorePage user={user} navigate={navigate} />}
              {route.name === "insights" && <InsightsPage user={user} navigate={navigate} />}
              {route.name === "discussion" && (
                <DiscussionPage user={user} discussionId={route.discussionId} navigate={navigate} />
              )}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}

function HeaderLink({
  active = false,
  label,
  onClick
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition ${
        active
          ? "border-[#d7954b]/25 bg-[#d7954b]/12 text-[#f3c389]"
          : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

import { useEffect, useState } from "react";

export type AppRoute =
  | { name: "explore" }
  | { name: "insights" }
  | { name: "discussion"; discussionId: string };

function parseRoute(pathname: string): AppRoute {
  if (pathname === "/insights") {
    return { name: "insights" };
  }

  const discussionMatch = pathname.match(/^\/discussions\/([^/]+)$/);

  if (discussionMatch) {
    return {
      name: "discussion",
      discussionId: decodeURIComponent(discussionMatch[1])
    };
  }

  return { name: "explore" };
}

export function useRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(path: string) {
    if (window.location.pathname === path) {
      return;
    }

    window.history.pushState({}, "", path);
    setPathname(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return {
    route: parseRoute(pathname),
    navigate
  };
}

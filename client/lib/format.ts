import type { DiscussionIntent, DiscussionStatus, PhaseStatus } from "../../shared/types";

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  const minutes = Math.round(Math.abs(diff) / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return diff < 0 ? `${minutes}m ago` : `in ${minutes}m`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return diff < 0 ? `${hours}h ago` : `in ${hours}h`;
  }

  const days = Math.round(hours / 24);
  return diff < 0 ? `${days}d ago` : `in ${days}d`;
}

export function formatAbsoluteTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatIntent(intent: DiscussionIntent) {
  switch (intent) {
    case "debate":
      return "Debate";
    case "help":
      return "Help";
    case "fun":
      return "Fun";
    case "opinion":
    default:
      return "Opinion";
  }
}

export function formatStatus(status: DiscussionStatus | PhaseStatus) {
  return status === "active" ? "Active" : "Completed";
}

export function formatCountdown(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();

  if (diff <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatPhaseLabel(phaseNumber: number) {
  return `Phase ${phaseNumber}`;
}

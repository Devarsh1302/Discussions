import type { InsightSummary } from "../../shared/types";

type SummaryMessage = {
  id: string;
  phaseNumber: number;
  authorHandle: string;
  body: string;
  upvoteCount: number;
  createdAt: string;
};

const stopWords = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "from",
  "have",
  "there",
  "their",
  "about",
  "would",
  "could",
  "should",
  "because",
  "they",
  "them",
  "your",
  "what",
  "when",
  "where",
  "which",
  "into",
  "while",
  "been",
  "were",
  "some",
  "just",
  "than",
  "then",
  "also",
  "only",
  "really",
  "think",
  "feel"
]);

const agreeSignals = ["agree", "support", "exactly", "yes", "definitely", "true", "same"];
const disagreeSignals = ["disagree", "however", "but", "not", "never", "wrong", "against"];

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function tokenize(body: string) {
  return body
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !stopWords.has(token));
}

function createKeyPoints(messages: SummaryMessage[]) {
  const frequencies = new Map<string, number>();

  for (const message of messages) {
    const uniqueTokens = new Set(tokenize(message.body));

    for (const token of uniqueTokens) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
  }

  return [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(
      ([topic, count]) =>
        `${topic.charAt(0).toUpperCase()}${topic.slice(1)} came up repeatedly across ${count} contribution${
          count === 1 ? "" : "s"
        }.`
    );
}

function createOpinionSplit(messages: SummaryMessage[]) {
  let agree = 0;
  let disagree = 0;
  let neutral = 0;

  for (const message of messages) {
    const normalized = message.body.toLowerCase();
    const hasAgree = agreeSignals.some((token) => normalized.includes(token));
    const hasDisagree = disagreeSignals.some((token) => normalized.includes(token));

    if (hasAgree && !hasDisagree) {
      agree += 1;
      continue;
    }

    if (hasDisagree && !hasAgree) {
      disagree += 1;
      continue;
    }

    neutral += 1;
  }

  const total = agree + disagree + neutral || 1;
  const agreePct = Math.round((agree / total) * 100);
  const disagreePct = Math.round((disagree / total) * 100);
  const neutralPct = clampPercent(100 - agreePct - disagreePct);

  return {
    agree: agreePct,
    disagree: disagreePct,
    neutral: neutralPct
  };
}

function excerpt(body: string) {
  const trimmed = body.trim();
  return trimmed.length > 150 ? `${trimmed.slice(0, 147)}...` : trimmed;
}

function createTopInsights(messages: SummaryMessage[]) {
  return [...messages]
    .sort((left, right) => {
      if (right.upvoteCount !== left.upvoteCount) {
        return right.upvoteCount - left.upvoteCount;
      }

      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    })
    .slice(0, 3)
    .map((message) => ({
      messageId: message.id,
      authorHandle: message.authorHandle,
      excerpt: excerpt(message.body),
      upvoteCount: message.upvoteCount,
      phaseNumber: message.phaseNumber
    }));
}

function createNarrative(
  keyPoints: string[],
  opinionSplit: ReturnType<typeof createOpinionSplit>,
  topInsightsCount: number,
  source: InsightSummary["source"]
) {
  if (source === "live") {
    return `Live read: the discussion is leaning ${opinionSplit.agree >= opinionSplit.disagree ? "toward alignment" : "toward disagreement"}, with ${topInsightsCount} standout contribution${topInsightsCount === 1 ? "" : "s"} shaping the tone so far.`;
  }

  return `This ${source === "phase" ? "phase" : "discussion"} closed with ${keyPoints.length} recurring theme${
    keyPoints.length === 1 ? "" : "s"
  }, and the strongest signal came from ${topInsightsCount} highly-upvoted insight${
    topInsightsCount === 1 ? "" : "s"
  }.`;
}

export function generateSummary(
  messages: SummaryMessage[],
  source: InsightSummary["source"]
): InsightSummary {
  if (messages.length === 0) {
    return {
      keyPoints: ["The timer ended before the group produced enough signal to summarize."],
      opinionSplit: {
        agree: 0,
        disagree: 0,
        neutral: 100
      },
      topInsights: [],
      narrative:
        source === "live"
          ? "Live read: participants are still gathering and the conversation has not formed clear themes yet."
          : "This phase ended quietly, so the summary stays minimal until a future revive adds more signal.",
      generatedAt: new Date().toISOString(),
      source
    };
  }

  const keyPoints = createKeyPoints(messages);
  const opinionSplit = createOpinionSplit(messages);
  const topInsights = createTopInsights(messages);

  return {
    keyPoints:
      keyPoints.length > 0
        ? keyPoints
        : ["Participants shared several distinct takes, but no single theme dominated."],
    opinionSplit,
    topInsights,
    narrative: createNarrative(keyPoints, opinionSplit, topInsights.length, source),
    generatedAt: new Date().toISOString(),
    source
  };
}

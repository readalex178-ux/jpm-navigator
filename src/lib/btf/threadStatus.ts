// Helpers for unread state and reply-time tracking on LinkedIn threads.
// Pure functions — no side effects, no store reads.

import type { ScrapedThread } from "@/lib/extension/types";

const parseTs = (s?: string | null): number => {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
};

export function lastMessageAt(thread: ScrapedThread | undefined): number {
  if (!thread) return 0;
  // Try messages first (most accurate), fall back to scrapedAt.
  for (let i = thread.messages.length - 1; i >= 0; i--) {
    const t = parseTs(thread.messages[i].timestamp);
    if (t) return t;
  }
  return parseTs(thread.scrapedAt);
}

export function lastInboundAt(thread: ScrapedThread | undefined): number {
  if (!thread) return 0;
  for (let i = thread.messages.length - 1; i >= 0; i--) {
    const m = thread.messages[i];
    if (m.sender === "them") {
      const t = parseTs(m.timestamp);
      if (t) return t;
    }
  }
  return 0;
}

export function isThreadUnread(
  thread: ScrapedThread,
  readAt: string | undefined,
): boolean {
  const last = lastMessageAt(thread);
  if (!last) return false;
  if (!readAt) return true;
  return parseTs(readAt) < last;
}

export type ReplyAgeBucket = "fresh" | "amber" | "red" | "none";

export function daysAgo(ms: number): number {
  if (!ms) return 0;
  return Math.floor((Date.now() - ms) / 86_400_000);
}

export function replyAgeBucket(thread: ScrapedThread | undefined): {
  bucket: ReplyAgeBucket;
  days: number;
  inboundAt: number;
} {
  const inboundAt = lastInboundAt(thread);
  if (!inboundAt) return { bucket: "none", days: 0, inboundAt: 0 };
  const days = daysAgo(inboundAt);
  const bucket: ReplyAgeBucket =
    days > 7 ? "red" : days > 3 ? "amber" : "fresh";
  return { bucket, days, inboundAt };
}

export function formatReplyAge(days: number): string {
  if (days <= 0) return "Replied today";
  if (days === 1) return "Replied 1d ago";
  return `Replied ${days}d ago`;
}

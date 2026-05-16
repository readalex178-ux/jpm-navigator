import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeThread, type AnalyzeResult } from "./linkedinAnalyzer.functions";
import { useStore, daysSince } from "../store";
import type { ScrapedThread } from "../extension/types";

function lastMessageAt(t?: ScrapedThread): string {
  if (!t || !t.messages.length) return t?.scrapedAt ?? "";
  return t.messages[t.messages.length - 1].timestamp;
}

export function useThreadAnalysis(threadId: string | null | undefined) {
  const fn = useServerFn(analyzeThread);
  const thread = useStore((s) => (threadId ? s.linkedinThreads[threadId] : undefined));
  const profile = useStore((s) =>
    thread?.participantProfileUrl ? s.linkedinProfiles[thread.participantProfileUrl] : undefined,
  );
  const prospectId = useStore((s) => (threadId ? s.threadProspectMap[threadId] : undefined));
  const prospect = useStore((s) => (prospectId ? s.prospects.find((p) => p.id === prospectId) : undefined));
  const setterName = useStore((s) => s.settings.name);
  const cached = useStore((s) => (threadId ? s.analyses[threadId] : undefined));
  const upsertAnalysis = useStore((s) => s.upsertAnalysis);
  const updateProspect = useStore((s) => s.updateProspect);
  const setBant = useStore((s) => s.setBant);
  const setQualScore = useStore((s) => s.setQualScore);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef<string | null>(null);

  const stamp = lastMessageAt(thread);
  const isFresh = !!cached && cached.basedOnLastMessageAt === stamp;

  const run = useCallback(
    async (force = false) => {
      if (!thread || !threadId) return;
      const currentStamp = lastMessageAt(thread);
      if (!force && cached && cached.basedOnLastMessageAt === currentStamp) return;
      if (inflightRef.current === threadId) return;
      inflightRef.current = threadId;
      setLoading(true);
      setError(null);
      try {
        const res: AnalyzeResult = await fn({
          data: {
            thread: {
              threadId: thread.threadId,
              participantName: thread.participantName,
              participantHeadline: thread.participantHeadline,
              participantProfileUrl: thread.participantProfileUrl,
              lastMessagePreview: thread.lastMessagePreview,
              messages: thread.messages,
              scrapedAt: thread.scrapedAt,
            },
            profile: profile ?? null,
            prospect: prospect
              ? {
                  stage: prospect.stage,
                  niche: prospect.niche,
                  tier: prospect.tier,
                  qualScore: prospect.qualScore,
                  daysSinceTouch: daysSince(prospect.lastTouchAt),
                }
              : null,
            setterName,
          },
        });
        if (res.ok) {
          upsertAnalysis({
            ...res.analysis,
            threadId,
            analyzedAt: new Date().toISOString(),
            basedOnLastMessageAt: currentStamp,
          });
          // Sync to linked prospect
          if (prospect) {
            setBant(prospect.id, res.analysis.bantSuggestion);
            setQualScore(prospect.id, res.analysis.qualScoreSuggestion);
            if (res.analysis.market && !prospect.niche) {
              updateProspect(prospect.id, { niche: res.analysis.market });
            }
          }
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
        inflightRef.current = null;
      }
    },
    [fn, thread, threadId, profile, prospect, setterName, cached, upsertAnalysis, setBant, setQualScore, updateProspect],
  );

  // Auto-run when thread updates (debounced)
  useEffect(() => {
    if (!thread || !threadId) return;
    if (isFresh) return;
    const t = setTimeout(() => {
      void run(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [threadId, stamp, isFresh, thread, run]);

  return { analysis: cached, loading, error, refresh: () => run(true), isFresh };
}

/**
 * Lightweight hook to read an analysis without triggering a run.
 * Used by inbox triage dots.
 */
export function useCachedAnalysis(threadId: string) {
  return useStore((s) => s.analyses[threadId]);
}

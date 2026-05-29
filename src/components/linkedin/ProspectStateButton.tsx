import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Copy } from "lucide-react";
import { summariseProspect } from "@/lib/ai/aiAssistants.functions";
import { useStore } from "@/lib/store";
import type { ScrapedThread } from "@/lib/extension/types";
import { toast } from "sonner";

export function ProspectStateButton({
  thread,
  prospectStage,
}: {
  thread: ScrapedThread;
  prospectStage?: string;
}) {
  const fn = useServerFn(summariseProspect);
  const history = useStore((s) => s.analysisHistory[thread.threadId]) ?? [];
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setSummary(null);
    try {
      const threadText = thread.messages
        .slice(-20)
        .map((m) => `${m.sender === "me" ? "SETTER" : "PROSPECT"} (${m.timestamp}): ${m.text}`)
        .join("\n");
      const histText = history
        .slice(-5)
        .map(
          (h) =>
            `${h.analyzedAt}: verdict=${h.oneLineVerdict} · stage=${h.stage} · next=${h.nextAction}`,
        )
        .join("\n");
      const r = await fn({
        data: {
          prospectName: thread.participantName,
          stage: prospectStage,
          thread: threadText,
          history: histText,
        },
      });
      if (r.ok) setSummary(r.summary);
      else toast.error(r.error);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3">
      <Button size="sm" variant="outline" onClick={run} disabled={busy} className="w-full">
        {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
        Summarise state
      </Button>
      {summary && (
        <div className="mt-2 rounded-md border border-border bg-surface p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              State of {thread.participantName}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5"
              onClick={() => {
                navigator.clipboard.writeText(summary);
                toast.success("Copied");
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{summary}</pre>
        </div>
      )}
    </div>
  );
}

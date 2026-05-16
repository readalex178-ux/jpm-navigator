import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import type { ThreadAnalysis, NextAction } from "@/lib/ai/analyzerSchema";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<NextAction, string> = {
  send_connection: "Send connection request",
  voice_note_1: "Send Voice Note #1",
  voice_note_2: "Send Voice Note #2",
  text_followup: "Send text follow-up",
  breakup: "Send break-up text",
  objection_response: "Handle objection",
  send_calendar_link: "Send calendar link",
  book_call: "Confirm booking",
  disqualify: "Disqualify",
  wait: "Wait",
};

const TRIAGE_COLOR = {
  hot: "border-success text-success",
  warm: "border-amber-400 text-amber-500",
  cold: "border-muted-foreground text-muted-foreground",
  disqualify: "border-destructive text-destructive",
} as const;

const QUAL_FLAG: Record<number, string> = {
  1: "✓",
  0: "✗",
  [-1]: "?",
};

export function AnalyzerStrip({
  analysis,
  loading,
  error,
  onRefresh,
  onUseDraft,
}: {
  analysis?: ThreadAnalysis;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onUseDraft: (action: NextAction, draft: string) => void;
}) {
  if (loading && !analysis) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span>Analyzing conversation…</span>
      </div>
    );
  }
  if (error && !analysis) {
    return (
      <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
        <span className="flex items-center gap-2">
          <AlertCircle className="h-3 w-3 text-destructive" />
          {error}
        </span>
        <Button size="sm" variant="outline" onClick={onRefresh}>
          Retry
        </Button>
      </div>
    );
  }
  if (!analysis) {
    return (
      <div className="mb-3 flex items-center justify-between rounded-md border border-dashed border-border p-3 text-xs">
        <span className="text-muted-foreground">No AI read yet.</span>
        <Button size="sm" variant="outline" onClick={onRefresh}>
          <Sparkles className="mr-1 h-3 w-3" />
          Analyze
        </Button>
      </div>
    );
  }

  const q = analysis.qualification;
  const draftAvailable =
    analysis.draftMessage.trim().length > 0 &&
    analysis.nextAction !== "disqualify" &&
    analysis.nextAction !== "wait";

  return (
    <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <Badge variant="outline" className={cn("uppercase", TRIAGE_COLOR[analysis.triage])}>
          {analysis.triage}
        </Badge>
        <Badge variant="outline">{analysis.market}</Badge>
        <Badge variant="outline">ICP: {analysis.icpMatch}</Badge>
        <Badge variant="outline">
          Qual {q.decisionMaker === 1 ? 1 : 0}+{q.hasOffer === 1 ? 1 : 0}+
          {q.earningSomething === 1 ? 1 : 0}+{q.wantsMore === 1 ? 1 : 0}/4
        </Badge>
        <Badge variant="outline">Conf {Math.round(analysis.confidence * 100)}%</Badge>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 px-1.5"
          onClick={onRefresh}
          disabled={loading}
          title="Re-analyze"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      <div className="mt-2 grid gap-1 text-xs">
        <div>
          <span className="text-muted-foreground">Stage:</span>{" "}
          <span className="font-medium">{analysis.stage.replace(/_/g, " ")}</span>
          {" · "}
          <span className="text-muted-foreground">Tone:</span>{" "}
          <span>{analysis.tone.energy}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Hook:</span>{" "}
          <span className="italic">"{analysis.personalisationHook}"</span>
        </div>
        <div className="rounded bg-surface/60 p-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Next move
          </div>
          <div className="font-medium">
            {ACTION_LABEL[analysis.nextAction]}{" "}
            {analysis.objection !== "none" && (
              <Badge variant="outline" className="ml-1 text-[9px] uppercase">
                obj: {analysis.objection.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{analysis.reasoning}</div>
        </div>
      </div>

      {draftAvailable && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            Draft ready ({analysis.draftMessage.split(/\s+/).length} words)
          </span>
          <Button
            size="sm"
            onClick={() => onUseDraft(analysis.nextAction, analysis.draftMessage)}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Use this draft
          </Button>
        </div>
      )}

      {q.verdict === "disqualify" && (
        <div className="mt-2 rounded bg-destructive/10 p-2 text-[11px] text-destructive">
          Disqualify suggested: {q.reason}
        </div>
      )}
    </div>
  );
}

import type { Triage } from "@/lib/ai/analyzerSchema";
import { useCachedAnalysis } from "@/lib/ai/useThreadAnalysis";
import { cn } from "@/lib/utils";

const DOT: Record<Triage, string> = {
  hot: "bg-success",
  warm: "bg-amber-400",
  cold: "bg-muted-foreground/60",
  disqualify: "bg-destructive",
};

const LABEL: Record<Triage, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  disqualify: "Skip",
};

export function InboxTriageDot({ threadId }: { threadId: string }) {
  const a = useCachedAnalysis(threadId);
  if (!a) {
    return (
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full bg-border"
        title="Not analyzed yet"
      />
    );
  }
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", DOT[a.triage])}
      title={`${LABEL[a.triage]} · ${a.oneLineVerdict}`}
    />
  );
}

export function InboxTriageVerdict({ threadId }: { threadId: string }) {
  const a = useCachedAnalysis(threadId);
  if (!a) return null;
  return (
    <div className="mt-0.5 line-clamp-1 text-[10px] text-primary/80">
      {a.oneLineVerdict}
    </div>
  );
}

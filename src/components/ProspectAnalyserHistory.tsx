import { useState } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProspectAnalyserHistory({ prospectId }: { prospectId: string }) {
  const entries = useStore((s) => s.prospectAnalyses[prospectId]) ?? [];
  const clear = useStore((s) => s.clearProspectAnalyses);
  const [open, setOpen] = useState(false);

  if (entries.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No co-pilot history yet. Run "What do I send next?" to start tracking it.
      </div>
    );
  }

  const ordered = [...entries].reverse();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <History className="h-3 w-3" /> Analyser history ({entries.length})
        </button>
        {open && entries.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => clear(prospectId)}>Clear</Button>
        )}
      </div>
      {open && (
        <ul className="space-y-2">
          {ordered.map((e) => (
            <li key={e.id} className="rounded-md border border-border bg-surface p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground num">
                <span>{formatStamp(e.createdAt)}</span>
                <Badge variant="outline" className="text-[10px]">{e.stageAtTime} → {e.suggestedStage}</Badge>
                <span>conf {Math.round(e.confidence * 100)}%</span>
              </div>
              <div className="font-medium">{e.verdictLine}</div>
              <div className="mt-1 text-xs text-muted-foreground">{e.nextMove}</div>
              {e.draftMessage && (
                <pre className="mt-2 whitespace-pre-wrap rounded bg-background/60 p-2 text-xs">
                  {e.draftMessage}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

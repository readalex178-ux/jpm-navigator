import { useState } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CachedAnalysis, Triage, NextAction } from "@/lib/ai/analyzerSchema";

const TRIAGE_COLOR: Record<Triage, string> = {
  hot: "border-success text-success",
  warm: "border-amber-400 text-amber-500",
  cold: "border-muted-foreground text-muted-foreground",
  disqualify: "border-destructive text-destructive",
};

const ACTION_SHORT: Record<NextAction, string> = {
  send_connection: "Connect",
  voice_note_1: "VN #1",
  voice_note_2: "VN #2",
  text_followup: "Text follow-up",
  breakup: "Break-up",
  objection_response: "Objection",
  send_calendar_link: "Calendar link",
  book_call: "Book call",
  disqualify: "Disqualify",
  wait: "Wait",
};

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

function diff<T>(prev: T | undefined, next: T): boolean {
  if (prev === undefined) return true;
  return prev !== next;
}

function HistoryRow({
  entry,
  prev,
  index,
}: {
  entry: CachedAnalysis;
  prev?: CachedAnalysis;
  index: number;
}) {
  const triageChanged = diff(prev?.triage, entry.triage);
  const actionChanged = diff(prev?.nextAction, entry.nextAction);
  const stageChanged = diff(prev?.stage, entry.stage);
  return (
    <div className="relative pl-5">
      <span className="absolute left-1 top-2 h-2 w-2 rounded-full bg-primary" />
      <span className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
      <div className="pb-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="font-medium text-muted-foreground">
            #{index + 1} · {formatStamp(entry.analyzedAt)}
          </span>
          <Badge
            variant="outline"
            className={cn("uppercase", TRIAGE_COLOR[entry.triage], triageChanged && "ring-1 ring-primary")}
          >
            {entry.triage}
          </Badge>
          <Badge variant="outline" className={cn(stageChanged && "ring-1 ring-primary")}>
            {entry.stage.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className={cn(actionChanged && "ring-1 ring-primary")}>
            → {ACTION_SHORT[entry.nextAction]}
          </Badge>
          <Badge variant="outline">conf {Math.round(entry.confidence * 100)}%</Badge>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{entry.oneLineVerdict}</div>
        {(triageChanged || actionChanged || stageChanged) && prev && (
          <div className="mt-1 text-[10px] text-primary/80">
            {triageChanged && (
              <span className="mr-2">triage: {prev.triage} → {entry.triage}</span>
            )}
            {stageChanged && (
              <span className="mr-2">
                stage: {prev.stage.replace(/_/g, " ")} → {entry.stage.replace(/_/g, " ")}
              </span>
            )}
            {actionChanged && (
              <span>
                action: {ACTION_SHORT[prev.nextAction]} → {ACTION_SHORT[entry.nextAction]}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalyzerHistoryTimeline({ threadId }: { threadId: string }) {
  const history = useStore((s) => s.analysisHistory[threadId]) ?? [];
  const [open, setOpen] = useState(false);

  if (history.length === 0) return null;

  // Show newest at top
  const reversed = [...history].reverse();

  return (
    <div className="mb-3 rounded-md border border-border bg-surface/40">
      <Button
        variant="ghost"
        size="sm"
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <History className="h-3 w-3" />
          Analyzer history
          <Badge variant="outline" className="ml-1 text-[9px]">
            {history.length}
          </Badge>
        </span>
        <span className="text-[10px] text-muted-foreground">
          last {formatStamp(history[history.length - 1].analyzedAt)}
        </span>
      </Button>
      {open && (
        <ScrollArea className="max-h-64 px-3 pb-2">
          <div className="pt-1">
            {reversed.map((entry, i) => {
              // prev in chronological order = the one BEFORE this one in original history
              const originalIndex = history.length - 1 - i;
              const prev = originalIndex > 0 ? history[originalIndex - 1] : undefined;
              return (
                <HistoryRow
                  key={`${entry.analyzedAt}-${i}`}
                  entry={entry}
                  prev={prev}
                  index={originalIndex}
                />
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

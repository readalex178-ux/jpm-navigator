import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Activity, VNEntry } from "@/lib/btf/types";

export type ConvMessage = {
  id: string;
  date: string;
  fromMe: boolean;
  type: string;
  text: string;
};

function mergeMessages(
  activities: Activity[],
  vnLog: VNEntry[],
  extras: ConvMessage[] = [],
): ConvMessage[] {
  const fromActs: ConvMessage[] = activities.map((a) => ({
    id: `a:${a.id}`,
    date: a.date,
    fromMe: a.fromMe ?? true,
    type: a.type,
    text: a.notes,
  }));
  const fromVns: ConvMessage[] = [];
  for (const v of vnLog) {
    fromVns.push({
      id: `v:${v.id}`,
      date: v.date,
      fromMe: true,
      type: "VN",
      text: v.variation ? `🎙 VN sent — ${v.variation}` : "🎙 VN sent",
    });
    if (v.reply !== "none") {
      fromVns.push({
        id: `v:${v.id}:reply`,
        date: v.date,
        fromMe: false,
        type: v.reply,
        text: `(replied with ${v.reply})`,
      });
    }
  }
  return [...fromActs, ...fromVns, ...extras].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export function buildConversation(
  activities: Activity[],
  vnLog: VNEntry[],
  extras: ConvMessage[] = [],
): ConvMessage[] {
  return mergeMessages(activities, vnLog, extras);
}

export function ConversationLog({
  activities,
  vnLog,
  extras = [],
}: {
  activities: Activity[];
  vnLog: VNEntry[];
  extras?: ConvMessage[];
}) {
  const messages = useMemo(() => mergeMessages(activities, vnLog, extras), [activities, vnLog, extras]);

  if (messages.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No messages yet. Use the composer below to log the first one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn("flex w-full", m.fromMe ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
              m.fromMe
                ? "bg-primary/15 text-foreground border border-primary/30"
                : "bg-surface text-foreground border border-border",
            )}
          >
            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{m.fromMe ? "Me" : "Them"}</span>
              <Badge variant="outline" className="h-fit px-1 py-0 text-[9px]">{m.type}</Badge>
              <span className="num">{m.date.slice(0, 16).replace("T", " ")}</span>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

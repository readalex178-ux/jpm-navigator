import { useMemo } from "react";
import { MessageSquare, Mic, Sparkles, ArrowRightCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

type Item = {
  id: string;
  date: string;
  icon: typeof MessageSquare;
  label: string;
  body: string;
  tone?: "me" | "them" | "ai" | "vn";
};

export function ProspectTimeline({ prospectId }: { prospectId: string }) {
  const prospect = useStore((s) => s.prospects.find((p) => p.id === prospectId));
  const analyses = useStore((s) => s.prospectAnalyses[prospectId] ?? []);

  const items = useMemo<Item[]>(() => {
    if (!prospect) return [];
    const out: Item[] = [];
    prospect.activities.forEach((a) => {
      out.push({
        id: `a-${a.id}`,
        date: a.date,
        icon: a.type === "VN" ? Mic : MessageSquare,
        label: `${a.fromMe === false ? "Them" : "Me"} · ${a.type}`,
        body: a.notes,
        tone: a.fromMe === false ? "them" : "me",
      });
    });
    prospect.vnLog.forEach((v) => {
      out.push({
        id: `v-${v.id}`,
        date: v.date,
        icon: Mic,
        label: `VN logged · reply: ${v.reply}`,
        body: v.variation,
        tone: "vn",
      });
    });
    analyses.forEach((a) => {
      out.push({
        id: `x-${a.id}`,
        date: a.createdAt,
        icon: Sparkles,
        label: `AI · ${a.stageAtTime} → ${a.suggestedStage}`,
        body: a.verdictLine,
        tone: "ai",
      });
    });
    out.push({
      id: "created",
      date: prospect.createdAt,
      icon: ArrowRightCircle,
      label: "Prospect added",
      body: prospect.name,
    });
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [prospect, analyses]);

  if (!items.length) {
    return <div className="text-sm text-muted-foreground">Nothing logged yet.</div>;
  }

  return (
    <ol className="relative space-y-3 border-l border-border/60 pl-4">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <li key={it.id} className="relative">
            <span className="absolute -left-[21px] grid h-4 w-4 place-items-center rounded-full border border-border bg-background">
              <Icon className="h-2.5 w-2.5" />
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  it.tone === "ai"
                    ? "border-primary/40 text-primary text-[10px]"
                    : it.tone === "them"
                    ? "border-amber-400/40 text-amber-400 text-[10px]"
                    : "text-[10px]"
                }
              >
                {it.label}
              </Badge>
              <span className="num text-[10px] text-muted-foreground">
                {new Date(it.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{it.body}</div>
          </li>
        );
      })}
    </ol>
  );
}

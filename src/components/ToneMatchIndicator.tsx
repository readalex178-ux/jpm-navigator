import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Mic, MessageSquare, Snowflake, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToneVerdict, type ToneStatus } from "@/lib/btf/toneMatch";
import type { Prospect } from "@/lib/btf/types";

const STYLES: Record<ToneStatus, { ring: string; chip: string; Icon: typeof Mic }> = {
  matching: {
    ring: "border-success text-success",
    chip: "bg-success/15 text-success",
    Icon: Mic,
  },
  warm: {
    ring: "border-amber-400 text-amber-500",
    chip: "bg-amber-500/15 text-amber-500",
    Icon: MessageSquare,
  },
  cold: {
    ring: "border-destructive text-destructive",
    chip: "bg-destructive/15 text-destructive",
    Icon: Snowflake,
  },
  unknown: {
    ring: "border-border text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    Icon: HelpCircle,
  },
};

export function ToneMatchIndicator({
  prospect,
  className,
}: {
  prospect: Prospect;
  className?: string;
}) {
  const v = getToneVerdict(prospect);
  const style = STYLES[v.status];
  const Icon = style.Icon;
  const opener = v.openerExample?.replaceAll("{name}", prospect.name.split(" ")[0] ?? prospect.name);

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-help gap-1 text-[10px] font-medium",
            style.ring,
            className,
          )}
        >
          <Icon className="h-3 w-3" />
          Tone: {v.label}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-80 space-y-2.5 p-3 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              style.chip,
            )}
          >
            <Icon className="h-3 w-3" />
            {v.label}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {v.status === "matching"
              ? "Locked in"
              : v.status === "warm"
                ? "Adjust"
                : v.status === "cold"
                  ? "Change pattern"
                  : "Read signals"}
          </span>
        </div>

        <div>
          <div className="mb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            Why
          </div>
          <p className="leading-relaxed text-foreground/90">{v.reason}</p>
        </div>

        <div>
          <div className="mb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            Next touch
          </div>
          <p className="leading-relaxed text-foreground/90">{v.suggestion}</p>
        </div>

        {opener && (
          <div className="rounded-md border border-dashed border-border bg-surface/60 p-2">
            <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Opener you can lift
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-foreground/90">
              "{opener}"
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

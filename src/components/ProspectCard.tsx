import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type Prospect,
  platformEmoji,
  STAGE_AGE_LIMIT,
} from "@/lib/btf/types";
import { daysSince } from "@/lib/store";

export function FlagDot({ prospect }: { prospect: Prospect }) {
  const signalCount = Object.values(prospect.signals).filter(Boolean).length;
  const green = signalCount >= 3;
  const red =
    Object.values(prospect.signals).every((v) => !v) || prospect.leadType === "No Close";
  const color = green ? "bg-success" : red ? "bg-destructive" : "bg-muted-foreground";
  return <span className={cn("inline-block h-2 w-2 rounded-full", color)} title={`${signalCount} signals`} />;
}

export function ProspectCard({
  prospect,
  onClick,
}: {
  prospect: Prospect;
  onClick?: () => void;
}) {
  const days = daysSince(prospect.lastTouchAt);
  const stageLimit = STAGE_AGE_LIMIT[prospect.stage];
  const stageDays = daysSince(prospect.stageEnteredAt);
  const overdue = stageLimit !== undefined && stageDays > stageLimit;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group block w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-surface-elevated",
        overdue ? "border-destructive/60" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FlagDot prospect={prospect} />
            <span className="truncate font-display font-semibold">{prospect.name}</span>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {platformEmoji(prospect.platform)} {prospect.niche || "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="num font-display text-lg font-bold text-primary">
            {prospect.qualScore}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/100</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{prospect.stage}</Badge>
        <Badge variant="secondary" className="text-[10px]">{prospect.tier}</Badge>
        <Badge variant="secondary" className="text-[10px]">{prospect.leadType}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground num">
          {days}d since touch
        </span>
      </div>
    </button>
  );
}

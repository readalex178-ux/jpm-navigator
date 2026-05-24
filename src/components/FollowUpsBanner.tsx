import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bell, Clock, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { getDueFollowUps } from "@/lib/followups";
import { platformEmoji } from "@/lib/btf/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FollowUpsBanner() {
  const prospects = useStore((s) => s.prospects);
  const due = useMemo(() => getDueFollowUps(prospects), [prospects]);

  if (due.length === 0) return null;

  return (
    <div className="rounded-lg border border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold">
          Follow up now · {due.length}
        </h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
          These need a touch today
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {due.slice(0, 6).map(({ prospect: p, reason, overdueDays, source }) => (
          <li key={p.id}>
            <Link
              to="/prospects/$id"
              params={{ id: p.id }}
              className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/30"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {p.qualScore || "—"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate font-medium">
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {platformEmoji(p.platform)}
                  </span>
                  <Badge variant="outline" className="h-fit px-1 py-0 text-[9px]">
                    {p.stage}
                  </Badge>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {reason}
                  {source === "stage-age" && (
                    <span className="ml-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      · auto
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={cn(
                    "num text-xs font-semibold tabular-nums",
                    overdueDays > 0 ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Clock className="mr-1 inline h-3 w-3" />
                  {overdueDays === 0 ? "today" : `+${overdueDays}d`}
                </div>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {due.length > 6 && (
        <div className="mt-2 text-right">
          <Link to="/prospects" className="text-xs text-primary hover:underline">
            See all {due.length} →
          </Link>
        </div>
      )}
    </div>
  );
}

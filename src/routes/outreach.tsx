import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore, daysSince } from "@/lib/store";
import { SEQUENCE, platformEmoji } from "@/lib/btf/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/outreach")({
  head: () => ({
    meta: [
      { title: "Outreach — BTF Setter OS" },
      { name: "description", content: "Active conversations and what's due today." },
    ],
  }),
  component: OutreachPage,
});

const ACTIVE_STAGES = new Set([
  "Connected",
  "VN1 Sent",
  "Replied",
  "VN2 Sent",
  "Calendar Sent",
  "Re-Engaged",
]);

type Filter = "all" | "due" | "overdue" | "stale";

function nextSequenceStep(platform: keyof typeof SEQUENCE, ageDays: number) {
  const steps = SEQUENCE[platform];
  const next = steps.find((s) => s.day >= ageDays);
  if (next) return { action: next.action, dueIn: next.day - ageDays };
  return { action: "Break-up / re-engage", dueIn: 0 };
}

function OutreachPage() {
  const prospects = useStore((s) => s.prospects);
  const [filter, setFilter] = useState<Filter>("all");

  const enriched = useMemo(() => {
    return prospects
      .filter((p) => ACTIVE_STAGES.has(p.stage))
      .map((p) => {
        const ageDays = daysSince(p.stageEnteredAt);
        const touchDays = daysSince(p.lastTouchAt);
        const next = nextSequenceStep(p.platform, ageDays);
        const overdue = next.dueIn === 0 && touchDays >= 1;
        const stale = touchDays >= 3;
        return { p, ageDays, touchDays, next, overdue, stale };
      });
  }, [prospects]);

  const filtered = useMemo(() => {
    if (filter === "due") return enriched.filter((x) => x.next.dueIn === 0);
    if (filter === "overdue") return enriched.filter((x) => x.overdue);
    if (filter === "stale") return enriched.filter((x) => x.stale);
    return enriched;
  }, [enriched, filter]);

  const counts = {
    all: enriched.length,
    due: enriched.filter((x) => x.next.dueIn === 0).length,
    overdue: enriched.filter((x) => x.overdue).length,
    stale: enriched.filter((x) => x.stale).length,
  };

  return (
    <>
      <PageHeader title="Outreach" subtitle={`${enriched.length} active conversations`} />

      <PageBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["due", "Due today"],
              ["overdue", "Overdue"],
              ["stale", "Stale 3+d"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-xs hover:border-primary/40",
                filter === k && "border-primary bg-surface-elevated text-foreground",
              )}
            >
              {label} <span className="text-muted-foreground">({counts[k]})</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Nothing matches this filter.
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(({ p, touchDays, next, overdue, stale }) => {
              const last = p.activities[0];
              const lastVN = p.vnLog[0];
              const toneMatch =
                lastVN?.reply === "VN" ? "matching" : lastVN?.reply === "text" ? "warm" : "cold";

              return (
                <Section
                  key={p.id}
                  title={`${platformEmoji(p.platform)} ${p.name} · ${p.stage}`}
                  action={
                    <div className="flex items-center gap-2">
                      {stale && (
                        <Badge variant="outline" className="border-amber-400 text-amber-500 text-[10px]">
                          stale {touchDays}d
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          toneMatch === "matching" && "border-success text-success",
                          toneMatch === "cold" && "border-destructive text-destructive",
                        )}
                      >
                        Tone: {toneMatch}
                      </Badge>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/prospects/$id" params={{ id: p.id }}>
                          Open
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/linkedin">Co-Pilot</Link>
                      </Button>
                    </div>
                  }
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Last activity
                      </div>
                      <div className="mt-1 text-sm">{last ? last.notes : "—"}</div>
                      <div className="mt-1 text-xs text-muted-foreground num">{touchDays}d since touch</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Next sequence step
                      </div>
                      <div className={cn("mt-1 text-sm", overdue && "text-destructive")}>
                        {next.action}{" "}
                        <span className="text-xs text-muted-foreground">
                          {next.dueIn === 0 ? (overdue ? "(overdue)" : "(today)") : `(in ${next.dueIn}d)`}
                        </span>
                      </div>
                    </div>
                  </div>
                </Section>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}

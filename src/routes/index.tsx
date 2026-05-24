import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section, StatCard } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, ArrowRight, Flame, Clock } from "lucide-react";
import { useStore, todayStr, daysSince } from "@/lib/store";
import { ProspectDrawer } from "@/components/ProspectDrawer";
import { FollowUpsBanner } from "@/components/FollowUpsBanner";
import { WEEKLY_BENCHMARKS, platformEmoji, type Stage } from "@/lib/btf/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — BTF Setter OS" },
      {
        name: "description",
        content: "Today's setter queue, snapshot metrics, and pipeline at a glance.",
      },
    ],
  }),
  component: DashboardPage,
});

// Recommended cadence per stage (days)
const STAGE_CADENCE: Partial<Record<Stage, { sla: number; next: string }>> = {
  Found: { sla: 1, next: "Send VN1" },
  Connected: { sla: 1, next: "Send VN1" },
  "VN1 Sent": { sla: 3, next: "Check / VN2" },
  Replied: { sla: 1, next: "Reply & qualify" },
  "VN2 Sent": { sla: 3, next: "Send calendar" },
  "Calendar Sent": { sla: 2, next: "Follow up" },
  "Call Booked": { sla: 1, next: "Confirm + claim GHL" },
  "No Show": { sla: 1, next: "Reschedule script" },
  Nurturing: { sla: 5, next: "Re-engage" },
  "Re-Engaged": { sla: 2, next: "Re-pitch" },
};

function DashboardPage() {
  const [open, setOpen] = useState(false);
  const prospects = useStore((s) => s.prospects);
  const kpiDays = useStore((s) => s.kpiDays);
  const commissions = useStore((s) => s.commissions);

  const today = useMemo(() => {
    const date = todayStr();
    return (
      kpiDays.find((entry) => entry.date === date) ?? {
        date,
        vnSent: 0,
        connectionsSent: 0,
        replies: 0,
        activeConvos: 0,
        calendarsSent: 0,
        booked: 0,
        shows: 0,
        hours: 0,
        byPlatform: {},
      }
    );
  }, [kpiDays]);

  const replyRate = today.vnSent > 0 ? Math.round((today.replies / today.vnSent) * 100) : 0;
  const activeConvos = prospects.filter((p) =>
    ["Connected", "VN1 Sent", "Replied", "VN2 Sent", "Calendar Sent", "Re-Engaged"].includes(
      p.stage,
    ),
  ).length;

  // Today's queue: anything overdue per stage cadence, sorted by overdue then qual score
  const queue = useMemo(() => {
    return prospects
      .map((p) => {
        const c = STAGE_CADENCE[p.stage];
        if (!c) return null;
        const since = daysSince(p.lastTouchAt);
        const overdue = since - c.sla;
        return { p, overdue, since, next: c.next };
      })
      .filter((x): x is { p: typeof prospects[number]; overdue: number; since: number; next: string } => x !== null)
      .sort((a, b) => b.overdue - a.overdue || b.p.qualScore - a.p.qualScore)
      .slice(0, 8);
  }, [prospects]);

  const weekly = useMemo(() => {
    const out: Record<string, number> = {};
    prospects.forEach((p) => {
      if (p.stage === "Call Booked" || p.stage === "Closed") {
        if (daysSince(p.stageEnteredAt) <= 7) {
          out[p.platform] = (out[p.platform] ?? 0) + 1;
        }
      }
    });
    return out;
  }, [prospects]);

  const projectedToday = useMemo(() => {
    const todays = commissions.filter((c) => c.closedAt.slice(0, 10) === todayStr());
    return todays.reduce((s, c) => s + c.amount, 0);
  }, [commissions]);

  return (
    <>
      <PageHeader title="Today" subtitle="Who needs a touch right now.">
        <Button variant="outline" size="sm" asChild>
          <Link to="/pipeline">
            Pipeline <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add prospect
        </Button>
      </PageHeader>

      <PageBody className="space-y-6">
        <FollowUpsBanner />

        {/* TODAY QUEUE — leads everything */}
        <Section
          title={`Today's queue · ${queue.length}`}
          action={
            <Link to="/prospects" className="text-xs text-primary hover:underline">
              All prospects →
            </Link>
          }
        >
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Flame className="h-6 w-6 text-muted-foreground/60" />
              <div className="text-sm text-muted-foreground">
                Inbox zero. Add prospects to start the cadence.
              </div>
              <Button size="sm" onClick={() => setOpen(true)} className="mt-2">
                <Plus className="mr-1 h-4 w-4" /> Add prospect
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {queue.map(({ p, overdue, since, next }) => {
                const isOverdue = overdue >= 0;
                return (
                  <li key={p.id}>
                    <Link
                      to="/prospects/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/30 -mx-1 px-1 rounded-md"
                    >
                      <div
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                          isOverdue
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p.qualScore || "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate font-medium">
                          <span className="truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {platformEmoji(p.platform)}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.stage} · {next}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={cn(
                            "num text-xs font-semibold tabular-nums",
                            isOverdue ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          <Clock className="mr-1 inline h-3 w-3" />
                          {since}d
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {isOverdue ? `+${overdue}d overdue` : "on track"}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* SNAPSHOT */}
        <div>
          <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Today's snapshot
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="VNs sent" value={today.vnSent} />
            <StatCard label="Replies" value={today.replies} />
            <StatCard label="Reply rate" value={`${replyRate}%`} accent hint="Target 20–30%" />
            <StatCard label="Calls booked" value={today.booked} accent />
            <StatCard label="Active convos" value={activeConvos} />
          </div>
        </div>

        {/* WEEK + COMMISSION */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="This week vs target" className="lg:col-span-2">
            <div className="space-y-3.5">
              {(["linkedin", "instagram", "facebook", "x", "email"] as const).map((p) => {
                const got = weekly[p] ?? 0;
                const target = WEEKLY_BENCHMARKS[p];
                const pct = target > 0 ? Math.min(100, (got / target) * 100) : 0;
                return (
                  <div key={p}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">
                        {platformEmoji(p)} {p}
                      </span>
                      <span className="num text-foreground">
                        {got}<span className="text-muted-foreground">/{target}</span>
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Commission today">
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <div className="num font-display text-3xl font-bold text-primary">
                  ${projectedToday.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">closed today</div>
              </div>
              <Link
                to="/kpi"
                className="inline-flex items-center text-xs text-primary hover:underline"
              >
                View KPI tracker <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
          </Section>
        </div>
      </PageBody>

      <ProspectDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

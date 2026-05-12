import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section, StatCard } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, ArrowRight, Flame } from "lucide-react";
import { useStore, todayStr, daysSince } from "@/lib/store";
import { ProspectDrawer } from "@/components/ProspectDrawer";
import { WEEKLY_BENCHMARKS, platformEmoji } from "@/lib/btf/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — BTF Setter OS" },
      { name: "description", content: "Today's setter metrics, hot prospects, and pipeline at a glance." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [open, setOpen] = useState(false);
  const prospects = useStore((s) => s.prospects);
  const today = useStore((s) => s.getKpiDay(todayStr()));
  const commissions = useStore((s) => s.commissions);

  const replyRate = today.vnSent > 0 ? Math.round((today.replies / today.vnSent) * 100) : 0;
  const activeConvos = prospects.filter((p) =>
    ["Connected", "VN1 Sent", "Replied", "VN2 Sent", "Calendar Sent", "Re-Engaged"].includes(p.stage),
  ).length;

  const hot = useMemo(
    () =>
      [...prospects]
        .sort((a, b) => b.qualScore - a.qualScore || daysSince(b.lastTouchAt) - daysSince(a.lastTouchAt))
        .slice(0, 5),
    [prospects],
  );

  // Weekly progress: count "Call Booked" or "Closed" prospects in last 7d per platform
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
      <PageHeader title="Dashboard" subtitle="Operator console — today's snapshot.">
        <Button variant="outline" size="sm" asChild>
          <Link to="/pipeline">View pipeline <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add prospect
        </Button>
      </PageHeader>

      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="VNs sent" value={today.vnSent} hint="Logged today" />
          <StatCard label="Replies" value={today.replies} />
          <StatCard label="Reply rate" value={`${replyRate}%`} accent hint="Target 20–30%" />
          <StatCard label="Calls booked" value={today.booked} accent />
          <StatCard label="Active convos" value={activeConvos} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Section
              title="Hot prospects"
              action={<Link to="/prospects" className="text-xs text-primary">View all →</Link>}
            >
              {hot.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No prospects yet. Add your first to start tracking.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {hot.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          <Flame className="h-3.5 w-3.5 text-primary" />
                          <span className="truncate">{p.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {platformEmoji(p.platform)} {p.niche || "—"} · {p.stage}
                        </div>
                      </div>
                      <div className="num text-right">
                        <div className="font-display font-bold text-primary">{p.qualScore}</div>
                        <div className="text-[10px] text-muted-foreground">{daysSince(p.lastTouchAt)}d ago</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title="This week">
            <div className="space-y-4">
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
                      <span className="num">{got}/{target}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <Section title="Commission today">
          <div className="flex items-baseline gap-3">
            <div className="num font-display text-3xl font-bold text-primary">
              ${projectedToday.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">closed today</div>
          </div>
        </Section>
      </PageBody>

      <ProspectDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

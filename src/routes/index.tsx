import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowRight, Flame, Clock, Inbox, Mic, CheckCircle2, Zap, Target, TrendingUp } from "lucide-react";
import { useStore, todayStr, daysSince } from "@/lib/store";
import { ProspectDrawer } from "@/components/ProspectDrawer";
import { FollowUpsBanner } from "@/components/FollowUpsBanner";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { DailyBriefingCard } from "@/components/DailyBriefingCard";
import {
  STAGE_NEXT_ACTION,
  TIER_VALUE,
  DAILY_TARGETS,
  platformEmoji,
  type Stage,
  type Tier,
} from "@/lib/btf/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — BTF Setter OS" },
      { name: "description", content: "Today's setter queue, projected commission, and momentum." },
    ],
  }),
  component: DashboardPage,
});

const STAGE_SLA: Partial<Record<Stage, number>> = {
  Found: 1,
  Connected: 1,
  "VN1 Sent": 3,
  Replied: 1,
  "VN2 Sent": 3,
  "Calendar Sent": 2,
  "Call Booked": 1,
};

// Map next-action verbs → quick action target
function quickActionFor(stage: Stage): { label: string; icon: typeof Mic; to: "/inbox" | "/prospects/$id" } {
  if (stage === "Replied" || stage === "Connected") return { label: "Open Inbox", icon: Inbox, to: "/inbox" };
  if (stage === "VN1 Sent" || stage === "VN2 Sent") return { label: "Log VN", icon: Mic, to: "/prospects/$id" };
  if (stage === "Call Booked") return { label: "Claim GHL", icon: CheckCircle2, to: "/prospects/$id" };
  return { label: "Open", icon: ArrowRight, to: "/prospects/$id" };
}

function DashboardPage() {
  const [open, setOpen] = useState(false);
  const prospects = useStore((s) => s.prospects);
  const kpiDays = useStore((s) => s.kpiDays);
  const commissions = useStore((s) => s.commissions);
  const target = useStore((s) => s.settings.monthlyTarget);

  const today = useMemo(() => {
    const date = todayStr();
    return (
      kpiDays.find((entry) => entry.date === date) ?? {
        date, vnSent: 0, connectionsSent: 0, connectionsAccepted: 0, replies: 0,
        activeConvos: 0, calendarsSent: 0, booked: 0, shows: 0, hours: 0, byPlatform: {},
      }
    );
  }, [kpiDays]);

  // Today's queue — overdue first, then highest qual score
  const queue = useMemo(() => {
    const now = Date.now();
    return prospects
      .map((p) => {
        const sla = STAGE_SLA[p.stage];
        if (sla === undefined) return null;
        const since = Math.floor((now - new Date(p.lastTouchAt).getTime()) / 86400000);
        const overdue = since - sla;
        return { p, overdue, since, next: STAGE_NEXT_ACTION[p.stage] };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.overdue >= -1)
      .sort((a, b) => b.overdue - a.overdue || b.p.qualScore - a.p.qualScore)
      .slice(0, 10);
  }, [prospects]);

  // Weather report
  const overdueCount = queue.filter((q) => q.overdue >= 0).length;
  const bookedThisWeek = useMemo(() => {
    return prospects.filter(
      (p) => (p.stage === "Call Booked" || p.stage === "Closed") && daysSince(p.stageEnteredAt) <= 7,
    ).length;
  }, [prospects]);

  const weather = useMemo(() => {
    if (overdueCount >= 5) return `You have ${overdueCount} overdue prospects. Clear the queue before anything else.`;
    if (overdueCount > 0) return `${overdueCount} overdue, ${queue.length - overdueCount} due today. Manageable.`;
    if (queue.length === 0) return "Inbox zero. Time to add new prospects or open the LinkedIn extension.";
    return `${queue.length} on deck, none overdue. Clean board — keep momentum.`;
  }, [overdueCount, queue.length]);

  // Projected monthly commission
  const { mtd, projected, dfyToGoal, weeklyBooked } = useMemo(() => {
    const now = new Date();
    const thisMonth = commissions.filter((c) => {
      const d = new Date(c.closedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const mtd = thisMonth.reduce((s, c) => s + c.amount, 0);
    const byTier: Record<Tier, number> = { DIY: 0, DWY: 0, DFY: 0 };
    thisMonth.forEach((c) => { byTier[c.tier] = (byTier[c.tier] ?? 0) + 1; });
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected = dayOfMonth > 0 ? Math.round((mtd / dayOfMonth) * daysInMonth) : 0;
    const remaining = Math.max(0, target - mtd);
    const dfyToGoal = Math.ceil(remaining / TIER_VALUE.DFY);
    return { mtd, projected, byTier, dfyToGoal, weeklyBooked: bookedThisWeek };
  }, [commissions, target, bookedThisWeek]);

  const monthlyCallTarget = 8;
  const motivational = useMemo(() => {
    const togo = Math.max(0, monthlyCallTarget - bookedThisWeek);
    if (bookedThisWeek === 0) return "First call this week is the hardest. Send 3 VNs right now.";
    if (togo === 0) return `Weekly target hit (${bookedThisWeek} booked). Stack it deeper.`;
    return `${togo} call${togo === 1 ? "" : "s"} from weekly target.`;
  }, [bookedThisWeek]);

  // Momentum: streak (consecutive days with vnSent > 0)
  const streak = useMemo(() => {
    const map = new Map(kpiDays.map((k) => [k.date, k.vnSent]));
    let s = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const key = d.toISOString().slice(0, 10);
      if ((map.get(key) ?? 0) > 0) s++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return s;
  }, [kpiDays]);

  const weeklyVn = useMemo(() => {
    const start = new Date(); start.setDate(start.getDate() - 6);
    return kpiDays
      .filter((k) => new Date(k.date) >= start)
      .reduce((s, k) => s + k.vnSent, 0);
  }, [kpiDays]);
  const weeklyVnTarget = DAILY_TARGETS.vnLinkedIn * 5;
  const vnPct = Math.min(100, (weeklyVn / weeklyVnTarget) * 100);

  const moneyPct = target > 0 ? Math.min(100, (mtd / target) * 100) : 0;

  return (
    <>
      <PageHeader title="Today" subtitle={weather}>
        <Button variant="outline" size="sm" asChild>
          <Link to="/pipeline">Pipeline <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add prospect
        </Button>
      </PageHeader>

      <PageBody className="space-y-6">
        <FollowUpsBanner />
        <OnboardingChecklist onAddProspect={() => setOpen(true)} />
        <DailyBriefingCard />


        {/* Motivational sub-line */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4 text-primary" />
          <span>{motivational}</span>
        </div>

        {/* HERO: projected commission */}
        <section className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Projected this month
              </div>
              <div className="num font-display text-5xl font-bold leading-none text-primary sm:text-6xl">
                ${projected.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                ${mtd.toLocaleString()} closed · target ${target.toLocaleString()} ·{" "}
                {dfyToGoal > 0 ? `${dfyToGoal} DFY to goal` : "🎯 goal hit"}
              </div>
            </div>
            <div className="w-full sm:max-w-xs">
              <Progress value={moneyPct} className="h-2" />
              <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>{Math.round(moneyPct)}% to target</span>
                <Link to="/kpi" className="text-primary hover:underline">KPI →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* MOMENTUM STRIP */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MomentumTile icon={Flame} label="VN streak" value={`${streak}d`} hint={streak > 0 ? "Keep it alive" : "Send 1 today"} />
          <MomentumTile icon={TrendingUp} label="VNs this week" value={`${weeklyVn}/${weeklyVnTarget}`} progress={vnPct} />
          <MomentumTile icon={Target} label="Calls this week" value={`${weeklyBooked}`} hint={`target ${monthlyCallTarget}`} />
          <MomentumTile icon={CheckCircle2} label="Connections today" value={`${today.connectionsSent}`} hint={`cap 18`} />
        </div>

        {/* TODAY'S QUEUE — hero list */}
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
              <div className="text-sm text-muted-foreground">Inbox zero. Add prospects to start the cadence.</div>
              <Button size="sm" onClick={() => setOpen(true)} className="mt-2">
                <Plus className="mr-1 h-4 w-4" /> Add prospect
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {queue.map(({ p, overdue, since, next }) => {
                const isOverdue = overdue >= 0;
                const qa = quickActionFor(p.stage);
                const Icon = qa.icon;
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <Link
                      to="/prospects/$id"
                      params={{ id: p.id }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 -mx-1 py-1 hover:bg-muted/30"
                    >
                      <div
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                          isOverdue ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p.qualScore || "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate font-medium">
                          <span className="truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{platformEmoji(p.platform)}</span>
                          {p.tier === "DFY" && (
                            <Badge variant="outline" className="border-tier-dfy/50 text-tier-dfy text-[9px] uppercase">DFY</Badge>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.stage} · {next}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn("num text-xs font-semibold tabular-nums", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                          <Clock className="mr-1 inline h-3 w-3" />
                          {since}d
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {isOverdue ? `+${overdue}d overdue` : "due"}
                        </div>
                      </div>
                    </Link>
                    <Button size="sm" variant={isOverdue ? "default" : "outline"} asChild>
                      {qa.to === "/inbox" ? (
                        <Link to="/inbox"><Icon className="mr-1 h-3 w-3" />{qa.label}</Link>
                      ) : (
                        <Link to="/prospects/$id" params={{ id: p.id }}><Icon className="mr-1 h-3 w-3" />{qa.label}</Link>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </PageBody>

      <ProspectDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

function MomentumTile({
  icon: Icon, label, value, hint, progress,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint?: string;
  progress?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="num mt-1.5 font-display text-2xl font-bold leading-none">{value}</div>
      {progress !== undefined ? (
        <Progress value={progress} className="mt-2 h-1" />
      ) : hint ? (
        <div className="mt-1.5 text-[10px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

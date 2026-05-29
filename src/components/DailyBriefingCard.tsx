import { useMemo, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X, AlertTriangle, Flame, TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore, todayStr, daysSince } from "@/lib/store";
import { TIER_VALUE, DAILY_TARGETS, type Stage } from "@/lib/btf/types";
import { generateDailyBriefing, type DailyBriefing } from "@/lib/ai/dailyBriefing.functions";
import { getDueFollowUps } from "@/lib/followups";
import { toast } from "sonner";

const STAGE_SLA: Partial<Record<Stage, number>> = {
  Found: 1,
  Connected: 1,
  "VN1 Sent": 3,
  Replied: 1,
  "VN2 Sent": 3,
  "Calendar Sent": 2,
  "Call Booked": 1,
};

function storageKey(date: string) {
  return `btf:briefing:${date}`;
}
function dismissKey(date: string) {
  return `btf:briefing:dismissed:${date}`;
}

export function DailyBriefingCard() {
  const prospects = useStore((s) => s.prospects);
  const kpiDays = useStore((s) => s.kpiDays);
  const commissions = useStore((s) => s.commissions);
  const target = useStore((s) => s.settings.monthlyTarget);
  const date = todayStr();
  const callFn = useServerFn(generateDailyBriefing);

  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Load cached briefing or dismissed state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(dismissKey(date)) === "1") {
      setDismissed(true);
      return;
    }
    const raw = localStorage.getItem(storageKey(date));
    if (raw) {
      try {
        setBriefing(JSON.parse(raw) as DailyBriefing);
      } catch {
        /* ignore */
      }
    }
  }, [date]);

  const inputs = useMemo(() => {
    const now = Date.now();
    const queue = prospects
      .map((p) => {
        const sla = STAGE_SLA[p.stage];
        if (sla === undefined) return null;
        const since = Math.floor((now - new Date(p.lastTouchAt).getTime()) / 86400000);
        return { p, overdue: since - sla, since };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const overdue = queue.filter((q) => q.overdue >= 0).length;
    const dueToday = queue.filter((q) => q.overdue >= -1 && q.overdue < 0).length;
    const hottest = [...prospects]
      .filter((p) => !["Closed", "Inactive", "Nurturing"].includes(p.stage))
      .sort((a, b) => b.qualScore - a.qualScore)[0];
    const overdueFollowUps = getDueFollowUps(prospects).length;
    const unclaimedGhl = prospects.filter((p) => p.stage === "Call Booked" && !p.ghlClaimed).length;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const callsBookedThisWeek = prospects.filter(
      (p) => (p.stage === "Call Booked" || p.stage === "Closed") && daysSince(p.stageEnteredAt) <= 7,
    ).length;
    const weeklyVnSent = kpiDays
      .filter((k) => new Date(k.date) >= weekStart)
      .reduce((s, k) => s + k.vnSent, 0);
    const weeklyVnTarget = DAILY_TARGETS.vnLinkedIn * 5;

    const nowD = new Date();
    const thisMonth = commissions.filter((c) => {
      const d = new Date(c.closedAt);
      return d.getMonth() === nowD.getMonth() && d.getFullYear() === nowD.getFullYear();
    });
    const mtd = thisMonth.reduce((s, c) => s + c.amount, 0);
    const dayOfMonth = nowD.getDate();
    const daysInMonth = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
    const projected = dayOfMonth > 0 ? Math.round((mtd / dayOfMonth) * daysInMonth) : 0;
    const dfyToGoal = Math.ceil(Math.max(0, target - mtd) / TIER_VALUE.DFY);

    return {
      date,
      overdueCount: overdue,
      dueTodayCount: dueToday,
      hottestProspect: hottest
        ? {
            name: hottest.name,
            stage: hottest.stage,
            qualScore: hottest.qualScore,
            tier: hottest.tier,
            daysSinceTouch: Math.floor((now - new Date(hottest.lastTouchAt).getTime()) / 86400000),
          }
        : null,
      overdueFollowUps,
      unclaimedGhl,
      callsBookedThisWeek,
      weeklyVnSent,
      weeklyVnTarget,
      mtdCommission: mtd,
      monthlyTarget: target,
      projectedCommission: projected,
      dfyToGoal,
      dayOfMonth,
      daysInMonth,
    };
  }, [prospects, kpiDays, commissions, target, date]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await callFn({ data: inputs });
      if (res.ok) {
        setBriefing(res.result);
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey(date), JSON.stringify(res.result));
        }
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error((e as Error).message || "Briefing failed.");
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") localStorage.setItem(dismissKey(date), "1");
  };

  if (dismissed) return null;

  if (!briefing) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">AI daily briefing</div>
              <div className="text-xs text-muted-foreground">
                One-tap morning rundown of your queue, pace, and biggest risk today.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={generate} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-3 w-3" />
              )}
              Generate
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={dismiss}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Daily briefing
            </div>
            <div className="mt-0.5 font-display text-base font-semibold leading-snug">
              {briefing.headline}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={dismiss}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {briefing.priorities.length > 0 && (
        <ol className="space-y-1.5">
          {briefing.priorities.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="num shrink-0 font-semibold text-primary">{i + 1}.</span>
              <div className="min-w-0">
                <div className="font-medium leading-tight">{p.title}</div>
                {p.why && <div className="text-xs text-muted-foreground">{p.why}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        {briefing.hottest && (
          <div className="flex items-start gap-1.5 rounded-md bg-card/40 p-2">
            <Flame className="mt-0.5 h-3 w-3 shrink-0 text-orange-400" />
            <span className="leading-snug">{briefing.hottest}</span>
          </div>
        )}
        {briefing.pace && (
          <div className="flex items-start gap-1.5 rounded-md bg-card/40 p-2">
            <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            <span className="leading-snug">{briefing.pace}</span>
          </div>
        )}
        {briefing.warning && (
          <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
            <span className="leading-snug">{briefing.warning}</span>
          </div>
        )}
      </div>
    </section>
  );
}

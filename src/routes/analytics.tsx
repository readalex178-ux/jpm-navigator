import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { useStore } from "@/lib/store";
import { TIER_VALUE, type Tier, type Stage } from "@/lib/btf/types";
import { Progress } from "@/components/ui/progress";
// badge removed: variations no longer track booked count
import { TrendingUp, Target, Trophy, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — BTF Setter OS" },
      { name: "description", content: "Niche reply rates, script performance, commission mix, pipeline projection." },
    ],
  }),
  component: AnalyticsPage,
});

const REPLY_BENCHMARK = 13; // %

function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="What's working, what's not, and what's coming."
      />
      <PageBody className="space-y-6">
        <PipelineProjection />
        <div className="grid gap-4 lg:grid-cols-2">
          <CommissionTierMix />
          <NicheReplyRate />
        </div>
        <ScriptVariationPerf />
      </PageBody>
    </>
  );
}

/* ---------- #58 Pipeline projection ---------- */

function PipelineProjection() {
  const prospects = useStore((s) => s.prospects);

  const { calendarTotal, bookedTotal, total, byTier } = useMemo(() => {
    const eligible: Stage[] = ["Calendar Sent", "Call Booked"];
    const calendar = prospects.filter((p) => p.stage === "Calendar Sent");
    const booked = prospects.filter((p) => p.stage === "Call Booked");
    const all = [...calendar, ...booked];
    const calendarTotal = calendar.reduce((s, p) => s + (TIER_VALUE[p.tier] ?? 0), 0);
    const bookedTotal = booked.reduce((s, p) => s + (TIER_VALUE[p.tier] ?? 0), 0);
    const byTier: Record<Tier, { count: number; value: number }> = {
      DIY: { count: 0, value: 0 },
      DWY: { count: 0, value: 0 },
      DFY: { count: 0, value: 0 },
    };
    all.forEach((p) => {
      if (!eligible.includes(p.stage)) return;
      byTier[p.tier].count += 1;
      byTier[p.tier].value += TIER_VALUE[p.tier] ?? 0;
    });
    return { calendarTotal, bookedTotal, total: calendarTotal + bookedTotal, byTier };
  }, [prospects]);

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Target className="h-3 w-3" /> Pipeline projection
          </div>
          <div className="num font-display text-5xl font-bold leading-none text-primary sm:text-6xl">
            ${total.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Potential pipeline — not guaranteed. Sum of tier value for Calendar Sent + Call Booked.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-72">
          <Tile label="Calendar Sent" value={`$${calendarTotal.toLocaleString()}`} />
          <Tile label="Call Booked" value={`$${bookedTotal.toLocaleString()}`} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {(Object.keys(byTier) as Tier[]).map((t) => (
          <div key={t} className="rounded-lg border border-border bg-card/50 p-3">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <span>{t}</span>
              <span>×{byTier[t].count}</span>
            </div>
            <div className="num mt-1 font-display text-xl font-bold">
              ${byTier[t].value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="num mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}

/* ---------- #55 Commission tier chart ---------- */

function CommissionTierMix() {
  const commissions = useStore((s) => s.commissions);

  const { byTier, total, count } = useMemo(() => {
    const byTier: Record<Tier, { count: number; value: number }> = {
      DIY: { count: 0, value: 0 },
      DWY: { count: 0, value: 0 },
      DFY: { count: 0, value: 0 },
    };
    commissions.forEach((c) => {
      byTier[c.tier].count += 1;
      byTier[c.tier].value += c.amount;
    });
    const total = Object.values(byTier).reduce((s, x) => s + x.value, 0);
    const count = commissions.length;
    return { byTier, total, count };
  }, [commissions]);

  const tierClass: Record<Tier, string> = {
    DIY: "bg-muted-foreground/60",
    DWY: "bg-primary/70",
    DFY: "bg-tier-dfy",
  };

  return (
    <Section
      title="Commission mix"
      action={
        <span className="text-xs text-muted-foreground">
          {count} close{count === 1 ? "" : "s"} · ${total.toLocaleString()}
        </span>
      }
    >
      {count === 0 ? (
        <EmptyHint icon={Trophy} text="No closes logged yet. Log your first commission to see tier mix." />
      ) : (
        <>
          {/* Stacked bar */}
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {(Object.keys(byTier) as Tier[]).map((t) => {
              const pct = total > 0 ? (byTier[t].value / total) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={t}
                  className={cn("h-full", tierClass[t])}
                  style={{ width: `${pct}%` }}
                  title={`${t}: $${byTier[t].value.toLocaleString()}`}
                />
              );
            })}
          </div>
          <ul className="space-y-2">
            {(Object.keys(byTier) as Tier[]).map((t) => {
              const pct = total > 0 ? (byTier[t].value / total) * 100 : 0;
              return (
                <li key={t} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", tierClass[t])} />
                    <span className="font-medium">{t}</span>
                    <span className="text-xs text-muted-foreground">
                      ×{byTier[t].count}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="num font-semibold tabular-nums">
                      ${byTier[t].value.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{Math.round(pct)}%</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}

/* ---------- #53 Niche reply-rate breakdown ---------- */

function NicheReplyRate() {
  const prospects = useStore((s) => s.prospects);

  const rows = useMemo(() => {
    const byNiche = new Map<string, { vnSent: number; vnReplied: number }>();
    prospects.forEach((p) => {
      const niche = (p.niche || "Uncategorised").trim() || "Uncategorised";
      const entry = byNiche.get(niche) ?? { vnSent: 0, vnReplied: 0 };
      const vns = p.vnLog ?? [];
      vns.forEach((vn) => {
        entry.vnSent += 1;
        if (vn.reply && vn.reply !== "none") entry.vnReplied += 1;
      });
      byNiche.set(niche, entry);
    });
    return [...byNiche.entries()]
      .map(([niche, x]) => ({
        niche,
        ...x,
        rate: x.vnSent > 0 ? (x.vnReplied / x.vnSent) * 100 : 0,
      }))
      .filter((r) => r.vnSent > 0)
      .sort((a, b) => b.rate - a.rate || b.vnSent - a.vnSent)
      .slice(0, 12);
  }, [prospects]);

  return (
    <Section
      title="Reply rate by niche"
      action={<span className="text-xs text-muted-foreground">benchmark {REPLY_BENCHMARK}%</span>}
    >
      {rows.length === 0 ? (
        <EmptyHint icon={BarChart3} text="No VNs logged yet. Log VN sends + replies on prospect cards." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const above = r.rate >= REPLY_BENCHMARK;
            return (
              <li key={r.niche}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{r.niche}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {r.vnReplied}/{r.vnSent}
                    <span
                      className={cn(
                        "num font-semibold tabular-nums",
                        above ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {r.rate.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <Progress value={Math.min(100, r.rate)} className="h-1.5" />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ---------- #54 Script variation performance ---------- */

function ScriptVariationPerf() {
  const prospects = useStore((s) => s.prospects);

  const rows = useMemo(() => {
    const byVar = new Map<string, { sent: number; replied: number }>();
    prospects.forEach((p) => {
      (p.vnLog ?? []).forEach((vn) => {
        const key = vn.variation?.trim() || "Unlabelled";
        const e = byVar.get(key) ?? { sent: 0, replied: 0 };
        e.sent += 1;
        if (vn.reply && vn.reply !== "none") e.replied += 1;
        byVar.set(key, e);
      });
    });
    return [...byVar.entries()]
      .map(([variation, x]) => ({
        variation,
        ...x,
        rate: x.sent > 0 ? (x.replied / x.sent) * 100 : 0,
      }))
      .sort((a, b) => b.rate - a.rate || b.sent - a.sent);
  }, [prospects]);

  return (
    <Section
      title="Script variation performance"
      action={<span className="text-xs text-muted-foreground">vs {REPLY_BENCHMARK}% benchmark</span>}
    >
      {rows.length === 0 ? (
        <EmptyHint
          icon={TrendingUp}
          text="Tag your VNs with a variation name when you log them to see which scripts perform best."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Variation</th>
                <th className="px-3 py-2 text-right">Sent</th>
                <th className="px-3 py-2 text-right">Replies</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-left">vs benchmark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const above = r.rate >= REPLY_BENCHMARK;
                const ratio = Math.min(200, (r.rate / REPLY_BENCHMARK) * 100); // 100% = at benchmark
                return (
                  <tr key={r.variation} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{r.variation}</span>
                      </div>
                    </td>
                    <td className="num px-3 py-2 text-right tabular-nums">{r.sent}</td>
                    <td className="num px-3 py-2 text-right tabular-nums">{r.replied}</td>
                    <td
                      className={cn(
                        "num px-3 py-2 text-right font-semibold tabular-nums",
                        above ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {r.rate.toFixed(0)}%
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        {/* benchmark marker at 50% (since 200% scale, 100 = benchmark = 50% of bar) */}
                        <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
                        <div
                          className={cn(
                            "h-full",
                            above ? "bg-success" : "bg-muted-foreground/60",
                          )}
                          style={{ width: `${ratio / 2}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ---------- shared ---------- */

function EmptyHint({
  icon: Icon,
  text,
}: {
  icon: typeof TrendingUp;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Icon className="h-5 w-5 text-muted-foreground/60" />
      <div className="text-xs text-muted-foreground">{text}</div>
    </div>
  );
}

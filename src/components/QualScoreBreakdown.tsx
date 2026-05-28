import { Sparkles } from "lucide-react";
import { type Prospect, SIGNAL_LABELS, type BuyingSignals } from "@/lib/btf/types";

type Factor = {
  label: string;
  weight: number; // contribution to a notional 100-pt score
  earned: number; // 0..weight
  detail?: string;
};

/**
 * Deterministic, transparent breakdown of where a prospect's qual score
 * comes from and what would move it up. No AI call — pure read-side.
 */
function computeFactors(p: Prospect): Factor[] {
  const bantTotal = p.bant.need + p.bant.timeline + p.bant.authority + p.bant.budget; // 0..8
  const signalCount = Object.values(p.signals).filter(Boolean).length; // 0..7
  const stageBonus = (() => {
    switch (p.stage) {
      case "Found":
      case "Cold":
        return 0;
      case "Connected":
        return 5;
      case "VN1 Sent":
        return 8;
      case "VN2 Sent":
        return 10;
      case "Replied":
        return 15;
      case "Calendar Sent":
        return 18;
      case "Call Booked":
        return 20;
      default:
        return 4;
    }
  })();
  const dmBonus = p.signals.decisionMakerConfirmed ? 5 : 0;

  return [
    {
      label: "BANT total",
      weight: 40,
      earned: Math.round((bantTotal / 8) * 40),
      detail: `${bantTotal}/8 across need, timeline, authority, budget`,
    },
    {
      label: "Buying signals",
      weight: 30,
      earned: Math.round((signalCount / 7) * 30),
      detail: `${signalCount}/7 signals checked`,
    },
    {
      label: "Stage progress",
      weight: 20,
      earned: stageBonus,
      detail: `${p.stage}`,
    },
    {
      label: "Decision maker confirmed",
      weight: 5,
      earned: dmBonus,
      detail: dmBonus ? "Confirmed" : "Not confirmed",
    },
    {
      label: "Manual override",
      weight: 5,
      earned: 0,
      detail: "Floor headroom — leaves room for your judgement.",
    },
  ];
}

function buildSuggestions(p: Prospect): string[] {
  const out: string[] = [];
  (["need", "timeline", "authority", "budget"] as const).forEach((k) => {
    if (p.bant[k] < 2) {
      out.push(
        `Lift ${k} from ${p.bant[k]} → 2 (ask a discovery question that surfaces ${k}).`,
      );
    }
  });
  (Object.keys(SIGNAL_LABELS) as (keyof BuyingSignals)[]).forEach((k) => {
    if (!p.signals[k]) {
      out.push(`Check buying signal: "${SIGNAL_LABELS[k]}"`);
    }
  });
  if (!p.signals.decisionMakerConfirmed) {
    out.push("Confirm they're the decision maker (+5 instantly).");
  }
  return out.slice(0, 5);
}

export function QualScoreBreakdown({ prospect }: { prospect: Prospect }) {
  const factors = computeFactors(prospect);
  const suggestions = buildSuggestions(prospect);
  const computed = factors.reduce((sum, f) => sum + f.earned, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Score breakdown
        </div>
        <div className="text-[10px] text-muted-foreground">
          recorded <span className="num font-medium text-foreground">{prospect.qualScore}</span> · model{" "}
          <span className="num">{computed}</span>/100
        </div>
      </div>

      <ul className="space-y-1.5">
        {factors.map((f) => {
          const pct = Math.round((f.earned / f.weight) * 100);
          return (
            <li key={f.label} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span>{f.label}</span>
                <span className="num text-muted-foreground">
                  +{f.earned}/{f.weight}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
              {f.detail && (
                <div className="text-[10px] text-muted-foreground">{f.detail}</div>
              )}
            </li>
          );
        })}
      </ul>

      {suggestions.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3 w-3" /> What would push this up
          </div>
          <ul className="space-y-1 text-xs">
            {suggestions.map((s, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-muted-foreground">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { type BuyingSignals, SIGNAL_LABELS } from "@/lib/btf/types";

export function BuyingSignalsProgress({
  signals,
  onChange,
  readOnly = false,
}: {
  signals: BuyingSignals;
  onChange?: (next: BuyingSignals) => void;
  readOnly?: boolean;
}) {
  const keys = Object.keys(SIGNAL_LABELS) as (keyof BuyingSignals)[];
  const total = keys.length;
  const present = keys.filter((k) => signals[k]).length;
  const pct = Math.round((present / total) * 100);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="uppercase tracking-widest text-muted-foreground">
            Buying signals
          </span>
          <span className="num font-medium">
            {present}/{total} · {pct}%
          </span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
      <div className="space-y-1.5">
        {keys.map((k) => (
          <label
            key={k}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={signals[k]}
              disabled={readOnly}
              onCheckedChange={(v) =>
                onChange?.({ ...signals, [k]: !!v })
              }
            />
            {SIGNAL_LABELS[k]}
          </label>
        ))}
      </div>
    </div>
  );
}

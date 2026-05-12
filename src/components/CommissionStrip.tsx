import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { TIER_VALUE } from "@/lib/btf/types";
import { Progress } from "@/components/ui/progress";
import { DollarSign } from "lucide-react";

export function CommissionStrip() {
  const commissions = useStore((s) => s.commissions);
  const target = useStore((s) => s.settings.monthlyTarget);

  const { mtd, projected, dfyToGoal } = useMemo(() => {
    const now = new Date();
    const thisMonth = commissions.filter((c) => {
      const d = new Date(c.closedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const mtd = thisMonth.reduce((s, c) => s + c.amount, 0);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected = dayOfMonth > 0 ? (mtd / dayOfMonth) * daysInMonth : 0;
    const remaining = Math.max(0, target - mtd);
    const dfyToGoal = Math.ceil(remaining / TIER_VALUE.DFY);
    return { mtd, projected, dfyToGoal };
  }, [commissions, target]);

  const pct = target > 0 ? Math.min(100, (mtd / target) * 100) : 0;

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <DollarSign className="h-3 w-3" /> Commission MTD
        </div>
        <div className="num text-xs text-muted-foreground">${target.toLocaleString()}</div>
      </div>
      <div className="num font-display text-xl font-bold text-primary">
        ${mtd.toLocaleString()}
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Pace: ${Math.round(projected).toLocaleString()}</span>
        <span>{dfyToGoal} DFY to goal</span>
      </div>
    </div>
  );
}

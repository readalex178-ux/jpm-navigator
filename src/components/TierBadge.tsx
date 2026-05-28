import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type Tier, TIER_BADGE_CLASS } from "@/lib/btf/types";
import { TIER_META } from "@/lib/btf/tiers";

/**
 * Tier label with an info tooltip describing the price, what's included, and
 * the setter commission range. Use everywhere a tier currently renders.
 */
export function TierBadge({
  tier,
  className,
  showInfoIcon = true,
  size = "sm",
}: {
  tier: Tier;
  className?: string;
  showInfoIcon?: boolean;
  size?: "xs" | "sm";
}) {
  const meta = TIER_META[tier];
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "inline-flex cursor-help items-center gap-1",
              textSize,
              TIER_BADGE_CLASS[tier],
              className,
            )}
          >
            <span>{meta.label}</span>
            {showInfoIcon && <Info className="h-2.5 w-2.5 opacity-70" />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-1.5 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display font-semibold">{meta.label}</span>
            <span className="num text-muted-foreground">{meta.price}</span>
          </div>
          <div className="text-muted-foreground">{meta.included}</div>
          <div className="border-t border-border pt-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Setter cut
            </span>
            <div className="num font-medium">{meta.setterCutLabel}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

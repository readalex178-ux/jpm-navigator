import { type BANT } from "@/lib/btf/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COLOUR: Record<0 | 1 | 2, string> = {
  0: "bg-destructive text-destructive-foreground",
  1: "bg-amber-500 text-amber-50",
  2: "bg-success text-success-foreground",
};

const LABEL: Record<0 | 1 | 2, string> = {
  0: "Red",
  1: "Amber",
  2: "Green",
};

const DIMS = ["budget", "authority", "need", "timeline"] as const;

/** Overall traffic light — driven by the worst dimension. */
export function BantOverall({
  bant,
  className,
}: {
  bant: BANT;
  className?: string;
}) {
  const worst = Math.min(bant.budget, bant.authority, bant.need, bant.timeline) as 0 | 1 | 2;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex h-3 w-3 cursor-help rounded-full",
              COLOUR[worst].split(" ")[0],
              className,
            )}
            aria-label={`BANT overall: ${LABEL[worst]}`}
          />
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          BANT overall: <span className="font-semibold">{LABEL[worst]}</span>{" "}
          (worst dimension wins)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Four coloured pills — full per-dimension breakdown. */
export function BantTrafficLight({ bant }: { bant: BANT }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {DIMS.map((dim) => {
        const v = bant[dim] as 0 | 1 | 2;
        return (
          <div
            key={dim}
            className={cn(
              "rounded-md border border-border bg-surface px-2 py-1.5 text-center",
            )}
          >
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
              {dim.slice(0, 4)}
            </div>
            <div
              className={cn(
                "mx-auto mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold num",
                COLOUR[v],
              )}
              title={LABEL[v]}
            >
              {v}
            </div>
          </div>
        );
      })}
    </div>
  );
}

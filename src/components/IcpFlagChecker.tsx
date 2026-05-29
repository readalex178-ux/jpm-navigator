import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import {
  ICP_GREEN_FLAGS,
  ICP_RED_FLAGS,
  computeFlagScoreDelta,
  countFlags,
  type IcpFlag,
} from "@/lib/btf/icpFlags";
import type { Prospect } from "@/lib/btf/types";
import { Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = { prospect: Prospect };

export function IcpFlagChecker({ prospect }: Props) {
  const updateProspect = useStore((s) => s.updateProspect);
  const setQualScore = useStore((s) => s.setQualScore);

  const flags = prospect.icpFlags ?? {};
  const { green, red } = useMemo(() => countFlags(flags), [flags]);
  const delta = useMemo(() => computeFlagScoreDelta(flags), [flags]);
  const projected = Math.max(0, Math.min(100, prospect.qualScore + delta));
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    const next = { ...flags, [id]: !flags[id] };
    updateProspect(prospect.id, { icpFlags: next });
  };

  const applyToScore = () => {
    if (delta === 0) {
      toast.message("Nothing to apply", { description: "Tick a flag first." });
      return;
    }
    setBusy(true);
    setQualScore(prospect.id, projected);
    // Clear flags so the delta doesn't double-apply on next click.
    updateProspect(prospect.id, { icpFlags: {} });
    toast.success(`Qual score → ${projected}`, {
      description: `${delta > 0 ? "+" : ""}${delta} from ${green} green / ${red} red`,
    });
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="border-success/40 text-success">
            <ThumbsUp className="mr-1 h-3 w-3" /> {green} green
          </Badge>
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            <ThumbsDown className="mr-1 h-3 w-3" /> {red} red
          </Badge>
          {delta !== 0 && (
            <Badge
              variant="outline"
              className={cn(
                "border-primary/40",
                delta > 0 ? "text-success" : "text-destructive",
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta} → {projected}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || delta === 0}
          onClick={applyToScore}
        >
          <Sparkles className="mr-1 h-3 w-3" /> Apply to qual score
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FlagColumn
          title="Green flags"
          tone="green"
          flags={ICP_GREEN_FLAGS}
          checked={flags}
          onToggle={toggle}
        />
        <FlagColumn
          title="Red flags"
          tone="red"
          flags={ICP_RED_FLAGS}
          checked={flags}
          onToggle={toggle}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tick what you observe on the profile. Apply when you're ready — qual score never updates
        automatically.
      </p>
    </div>
  );
}

function FlagColumn({
  title,
  tone,
  flags,
  checked,
  onToggle,
}: {
  title: string;
  tone: "green" | "red";
  flags: IcpFlag[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2",
        tone === "green" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div
        className={cn(
          "mb-2 text-[10px] uppercase tracking-widest",
          tone === "green" ? "text-success" : "text-destructive",
        )}
      >
        {title}
      </div>
      <ul className="space-y-1.5">
        {flags.map((f) => (
          <li key={f.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-background/40">
              <Checkbox
                checked={!!checked[f.id]}
                onCheckedChange={() => onToggle(f.id)}
                className="mt-0.5"
              />
              <span className="flex-1 leading-snug">
                {f.label}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({f.weight > 0 ? "+" : ""}
                  {f.weight})
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

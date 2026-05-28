import { useState } from "react";
import { Calendar, Loader2, Sparkles, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Prospect } from "@/lib/btf/types";
import { buildProspectContext } from "@/lib/ai/prospectContext";
import { suggestFollowUp } from "@/lib/ai/suggestFollowUp.functions";

/**
 * Suggest-a-follow-up chip (#51). No automation — proposes a date and
 * reason, user clicks "Set" to commit. Nothing is written without a click.
 */
export function FollowUpSuggestionChip({ prospect }: { prospect: Prospect }) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<{ days: number; reason: string; at: string } | null>(null);
  const setFollowUp = useStore((s) => s.setFollowUp);
  const call = useServerFn(suggestFollowUp);

  const lastAct = prospect.activities[prospect.activities.length - 1];

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setSuggestion(null);
    try {
      const r = await call({
        data: {
          context: buildProspectContext(prospect),
          platform: prospect.platform,
          tier: prospect.tier,
          stage: prospect.stage,
          lastActivityType: lastAct?.type,
        },
      });
      if (r.ok) setSuggestion({ days: r.days, reason: r.reason, at: r.followUpAt });
      else toast.error(r.error);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!suggestion) return;
    setFollowUp(prospect.id, suggestion.at, suggestion.reason);
    toast.success(`Follow-up set for ${new Date(suggestion.at).toLocaleDateString()}`);
    setSuggestion(null);
  };

  if (suggestion) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="font-medium">Follow up in {suggestion.days} {suggestion.days === 1 ? "day" : "days"}?</span>
        <span className="text-muted-foreground">{suggestion.reason}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" className="h-6 px-2 text-[11px]" onClick={apply}>
            <Calendar className="mr-1 h-3 w-3" /> Set
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setSuggestion(null)}
            aria-label="Dismiss suggestion"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 gap-1.5 text-[11px]"
      onClick={run}
      disabled={busy}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      Suggest follow-up
    </Button>
  );
}

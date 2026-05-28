import { useMemo, useState } from "react";
import { Copy, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type Prospect, type Stage, type Tier } from "@/lib/btf/types";
import { toast } from "sonner";

/**
 * Deterministic playbook lookup — picks the recommended next script based on
 * stage + tier + buying signals. No AI call. Updates automatically when the
 * stage changes because it's derived from props.
 */
type ScriptTemplate = {
  id: string;
  title: string;
  format: "Voice note" | "Text" | "Comment" | "Email";
  body: string;
};

function buildScript(p: Prospect): ScriptTemplate {
  const dmConfirmed = p.signals.decisionMakerConfirmed;
  const slow = p.signals.slowMonth;
  const scale = p.signals.wantsToScale;
  const niche = p.niche || "your space";
  const tierHint = tierFraming(p.tier);

  switch (p.stage) {
    case "Found":
      return {
        id: "found-connect",
        title: "Cold connection request",
        format: "Text",
        body: `Hey ${p.name.split(" ")[0]} — saw your stuff in ${niche}. No pitch, just liked your angle on ${scale ? "scaling" : "what you're building"}. Mind if I connect?`,
      };
    case "Connected":
      return {
        id: "connected-vn1",
        title: "VN1 — soft opener",
        format: "Voice note",
        body: `Hey ${p.name.split(" ")[0]}, thanks for the accept. Quick one — ${slow ? "noticed you mentioned things are quiet" : "saw you're in " + niche} — what's been the bottleneck on getting more booked calls this month? No agenda, just curious how you're tackling it.`,
      };
    case "VN1 Sent":
      return {
        id: "vn1-bump",
        title: "VN1 follow-up nudge",
        format: "Text",
        body: `Probably buried in your inbox — did the VN land okay? Genuinely curious about your answer, not pitching.`,
      };
    case "Replied":
      return {
        id: "replied-vn2",
        title: "VN2 — qualify + frame",
        format: "Voice note",
        body: `Appreciate you coming back. ${tierHint} If that lands, the next move is a quick 15-min loom or call so I can show you exactly what it looks like for someone in ${niche}. Worth a slot this week?`,
      };
    case "VN2 Sent":
      return {
        id: "vn2-bump",
        title: "VN2 follow-up — calendar nudge",
        format: "Text",
        body: `Hey ${p.name.split(" ")[0]}, dropping the link in case it's easier — pick a slot that works: [your calendar link]. If now's not the moment, just say "later" and I'll circle back.`,
      };
    case "Calendar Sent":
      return {
        id: "calendar-confirm",
        title: "Calendar reminder",
        format: "Text",
        body: `Just confirming our time — quick heads-up I'll come prepped on ${niche} specifically. ${dmConfirmed ? "Speak then." : "Will anyone else from your side join? Want to make sure we cover what matters."}`,
      };
    case "Call Booked":
      return {
        id: "booked-prep",
        title: "Pre-call prep DM",
        format: "Text",
        body: `Looking forward to it ${p.name.split(" ")[0]}. One quick prep Q so I don't waste your time: what would have to happen on the call for you to feel it was a great use of 30 minutes?`,
      };
    case "No Show":
      return {
        id: "noshow",
        title: "No-show reschedule",
        format: "Text",
        body: `No drama — happens. Want to grab a fresh slot? [your calendar link] · or hit me back with a couple of windows that work.`,
      };
    case "Nurturing":
      return {
        id: "nurture",
        title: "Value drop",
        format: "Text",
        body: `Saw this and thought of you — [insert relevant resource]. No reply needed, just sharing.`,
      };
    case "Re-Engaged":
      return {
        id: "reengage",
        title: "Re-engagement pitch",
        format: "Voice note",
        body: `Hey ${p.name.split(" ")[0]} — circling back. Last time we spoke, ${scale ? "you mentioned wanting to scale" : "the timing wasn't right"}. Curious if anything's shifted. ${tierHint}`,
      };
    case "Cold":
      return {
        id: "cold-revive",
        title: "Cold-list revival",
        format: "Text",
        body: `Hey — long shot but worth asking. Is ${niche} still the focus, or have you pivoted? If still relevant I've got something that might be useful.`,
      };
    case "Closed":
      return {
        id: "closed-followup",
        title: "Post-close check-in",
        format: "Text",
        body: `Quick check-in — how's the rollout going so far? Anything you need from my side?`,
      };
    default:
      return {
        id: "generic",
        title: "Next message",
        format: "Text",
        body: `Hey ${p.name.split(" ")[0]} — what's the latest?`,
      };
  }
}

function tierFraming(tier: Tier): string {
  switch (tier) {
    case "DFY":
      return "Given the scale you're at, I'd be looking at the done-for-you option — full team running outbound end-to-end.";
    case "DWY":
      return "For where you're at, the done-with-you build is the right shape — we run it with you for 90 days.";
    case "DIY":
      return "If you want to test the system first, the self-serve track gets you the playbook + templates.";
  }
}

export function SuggestedScript({
  prospect,
  onInsert,
}: {
  prospect: Prospect;
  onInsert?: (text: string) => void;
}) {
  const script = useMemo(() => buildScript(prospect), [
    prospect.stage,
    prospect.tier,
    prospect.name,
    prospect.niche,
    prospect.signals,
  ]);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(script.body);
    setCopied(true);
    toast.success("Script copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{script.title}</span>
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            For {prospect.stage} · {prospect.tier}
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">{script.format}</Badge>
      </div>
      <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm leading-relaxed">
        {script.body}
      </pre>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="mr-1 h-3 w-3" /> {copied ? "Copied" : "Copy"}
        </Button>
        {onInsert && (
          <Button size="sm" onClick={() => onInsert(script.body)}>
            Use in composer
          </Button>
        )}
      </div>
    </div>
  );
}

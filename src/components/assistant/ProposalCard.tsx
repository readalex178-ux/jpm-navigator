import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, X, UserPlus, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { matchProspects } from "@/lib/assistant/matchProspect";
import { useApplyProposal } from "@/lib/assistant/apply";
import type { ProposalRecord } from "@/lib/assistant/intents";

interface Props {
  proposal: ProposalRecord;
  onPatch: (patch: Partial<ProposalRecord>) => void;
}

export function ProposalCard({ proposal, onPatch }: Props) {
  const prospects = useStore((s) => s.prospects);
  const apply = useApplyProposal();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    proposal.resolvedProspectId,
  );

  const candidates = useMemo(() => {
    if (proposal.kind === "log_activity" || proposal.kind === "update_stage") {
      return matchProspects(proposal.prospectQuery, prospects);
    }
    return [];
  }, [proposal, prospects]);

  // Auto-pick if exactly one match (still requires Apply click)
  const autoId =
    !selectedId && candidates.length === 1 ? candidates[0].id : selectedId;

  if (proposal.appliedAt) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Check className="mr-1 inline h-3 w-3 text-primary" />
        Applied
        {proposal.resolvedProspectId && (
          <Link
            to="/prospects/$id"
            params={{ id: proposal.resolvedProspectId }}
            className="ml-2 text-primary underline"
          >
            View prospect
          </Link>
        )}
      </div>
    );
  }

  if (proposal.dismissedAt) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/10 px-3 py-2 text-xs text-muted-foreground line-through">
        Dismissed
      </div>
    );
  }

  const onApply = async () => {
    const targetId =
      proposal.kind === "add_prospect" || proposal.kind === "answer_only"
        ? undefined
        : autoId;
    if (
      (proposal.kind === "log_activity" || proposal.kind === "update_stage") &&
      !targetId
    ) {
      return;
    }
    const result = apply(proposal, targetId);
    if (result.ok) {
      onPatch({
        appliedAt: new Date().toISOString(),
        resolvedProspectId: result.prospectId,
      });
    }
  };

  const onDismiss = () =>
    onPatch({ dismissedAt: new Date().toISOString() });

  const header = (() => {
    if (proposal.kind === "log_activity")
      return { icon: MessageSquare, label: "Log activity" };
    if (proposal.kind === "update_stage")
      return { icon: ArrowRight, label: "Update stage" };
    if (proposal.kind === "add_prospect")
      return { icon: UserPlus, label: "Add prospect" };
    return { icon: Sparkles, label: "Answer" };
  })();
  const Icon = header.icon;

  if (proposal.kind === "answer_only") return null;

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 text-sm space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {header.label}
      </div>

      {proposal.kind === "log_activity" && (
        <div className="space-y-1">
          <div>
            <span className="text-muted-foreground">Type: </span>
            <Badge variant="secondary">{proposal.activityType}</Badge>
          </div>
          {proposal.note && (
            <div className="text-foreground/90">"{proposal.note}"</div>
          )}
        </div>
      )}

      {proposal.kind === "update_stage" && (
        <div>
          <span className="text-muted-foreground">New stage: </span>
          <Badge>{proposal.stage}</Badge>
        </div>
      )}

      {proposal.kind === "add_prospect" && (
        <div className="space-y-1">
          <div className="font-medium">{proposal.name}</div>
          <div className="text-xs text-muted-foreground">
            {proposal.platform ?? "linkedin"}
            {proposal.niche ? ` · ${proposal.niche}` : ""}
          </div>
          {proposal.notes && (
            <div className="text-foreground/80 text-xs">{proposal.notes}</div>
          )}
        </div>
      )}

      {(proposal.kind === "log_activity" ||
        proposal.kind === "update_stage") && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Match for "{proposal.prospectQuery}":
          </div>
          {candidates.length === 0 ? (
            <div className="text-xs text-destructive">
              No prospect found — add them first or rephrase.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition ${
                    autoId === c.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 hover:bg-muted"
                  }`}
                >
                  {c.name}
                  <span className="ml-1 text-muted-foreground">· {c.stage}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={onApply}
          disabled={
            (proposal.kind === "log_activity" ||
              proposal.kind === "update_stage") &&
            !autoId
          }
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Apply
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          <X className="mr-1 h-3.5 w-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

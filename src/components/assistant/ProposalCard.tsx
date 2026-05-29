import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Check, X, UserPlus, MessageSquare, ArrowRight, Sparkles, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import { matchProspects } from "@/lib/assistant/matchProspect";
import { useApplyProposal } from "@/lib/assistant/apply";
import type { ProposalRecord } from "@/lib/assistant/intents";
import type { Prospect } from "@/lib/btf/types";


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
    if (proposal.kind === "import_csv")
      return { icon: FileSpreadsheet, label: "Import CSV" };
    return { icon: Sparkles, label: "Answer" };
  })();
  const Icon = header.icon;

  if (proposal.kind === "answer_only") return null;

  if (proposal.kind === "import_csv") {
    return (
      <ImportCsvCard
        proposal={proposal}
        onPatch={onPatch}
        header={{ Icon, label: header.label }}
      />
    );
  }



  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 text-sm space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {header.label}
      </div>

      {proposal.kind === "log_activity" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="text-muted-foreground">Type</label>
            <select
              value={proposal.activityType}
              onChange={(e) => onPatch({ activityType: e.target.value as typeof proposal.activityType })}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {["VN","text","email","comment","like","call","note"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <textarea
            value={proposal.note}
            onChange={(e) => onPatch({ note: e.target.value })}
            placeholder="Exact message text…"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground">Edit before applying — this is what gets logged verbatim.</p>
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

type ImportRow = Partial<Prospect> & { name: string };

function ImportCsvCard({
  proposal,
  onPatch,
  header,
}: {
  proposal: Extract<ProposalRecord, { kind: "import_csv" }>;
  onPatch: (patch: Partial<ProposalRecord>) => void;
  header: { Icon: typeof FileSpreadsheet; label: string };
}) {
  const addProspect = useStore((s) => s.addProspect);
  const existing = useStore((s) => s.prospects);
  const rows = proposal.rows as ImportRow[];
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(rows.map((_, i) => i)),
  );
  const [expanded, setExpanded] = useState(false);

  const existingNames = useMemo(
    () => new Set(existing.map((p) => p.name.trim().toLowerCase())),
    [existing],
  );

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((_, i) => i)));
  };

  const onApply = () => {
    let added = 0;
    for (const i of selected) {
      const r = rows[i];
      if (!r?.name) continue;
      addProspect(r);
      added++;
    }
    toast.success(`Imported ${added} prospect${added === 1 ? "" : "s"}`);
    onPatch({ appliedAt: new Date().toISOString() });
  };

  const onDismiss = () =>
    onPatch({ dismissedAt: new Date().toISOString() });

  if (proposal.appliedAt) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Check className="mr-1 inline h-3 w-3 text-primary" />
        Imported {selected.size} of {rows.length} from {proposal.fileName || "CSV"}
      </div>
    );
  }
  if (proposal.dismissedAt) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Import dismissed
      </div>
    );
  }

  const HeaderIcon = header.Icon;
  const visible = expanded ? rows : rows.slice(0, 8);

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 text-sm space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <HeaderIcon className="h-3.5 w-3.5" />
        {header.label}
        {proposal.fileName && (
          <span className="truncate text-foreground/70">· {proposal.fileName}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"} parsed
          {proposal.skippedCount > 0 && ` · ${proposal.skippedCount} skipped`}
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="text-primary underline-offset-2 hover:underline"
        >
          {selected.size === rows.length ? "Select none" : "Select all"}
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-border/60">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-1.5"></th>
              <th className="px-2 py-1.5 text-left">Name</th>
              <th className="px-2 py-1.5 text-left">Platform</th>
              <th className="px-2 py-1.5 text-left">Stage</th>
              <th className="px-2 py-1.5 text-left">Niche</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const dupe = existingNames.has((r.name || "").trim().toLowerCase());
              return (
                <tr key={i} className="border-t border-border/40">
                  <td className="px-2 py-1.5">
                    <Checkbox
                      checked={selected.has(i)}
                      onCheckedChange={() => toggle(i)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-foreground">{r.name}</div>
                    {dupe && (
                      <div className="text-[10px] text-amber-500">
                        possible duplicate
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {r.platform ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {r.stage ?? "Found"}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px]">
                    {r.niche ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 8 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full border-t border-border/40 bg-muted/30 px-2 py-1.5 text-[11px] text-primary hover:bg-muted/50"
          >
            {expanded ? "Show less" : `Show ${rows.length - 8} more`}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={onApply} disabled={selected.size === 0}>
          <Check className="mr-1 h-3.5 w-3.5" />
          Approve & import {selected.size}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          <X className="mr-1 h-3.5 w-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}


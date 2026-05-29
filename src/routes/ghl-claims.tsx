import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronRight, Clock, Trophy, ExternalLink } from "lucide-react";
import { useStore } from "@/lib/store";
import { TIER_VALUE, platformEmoji } from "@/lib/btf/types";
import { GHL_CHECKLIST_STEPS } from "@/lib/btf/playbook";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/ghl-claims")({
  head: () => ({
    meta: [
      { title: "GHL Claims — BTF Setter OS" },
      {
        name: "description",
        content:
          "Booked calls waiting to be claimed in GoHighLevel. No claim, no commission.",
      },
    ],
  }),
  component: GhlClaimsPage,
});

function GhlClaimsPage() {
  const prospects = useStore((s) => s.prospects);
  const updateProspect = useStore((s) => s.updateProspect);

  const unclaimed = useMemo(
    () =>
      prospects
        .filter((p) => p.stage === "Call Booked" && !p.ghlClaimed)
        .sort(
          (a, b) =>
            new Date(a.stageEnteredAt).getTime() - new Date(b.stageEnteredAt).getTime(),
        ),
    [prospects],
  );

  const claimed = useMemo(
    () =>
      prospects
        .filter((p) => p.stage === "Call Booked" && p.ghlClaimed)
        .sort(
          (a, b) =>
            new Date(b.stageEnteredAt).getTime() - new Date(a.stageEnteredAt).getTime(),
        )
        .slice(0, 10),
    [prospects],
  );

  const valueAtRisk = useMemo(
    () => unclaimed.reduce((s, p) => s + TIER_VALUE[p.tier], 0),
    [unclaimed],
  );

  const onClaim = (id: string, name: string) => {
    updateProspect(id, { ghlClaimed: true, ghlRemindAt: undefined });
    toast.success(`${name} marked as claimed.`);
  };

  return (
    <>
      <PageHeader
        title="GHL Claims"
        subtitle={
          unclaimed.length === 0
            ? "All booked calls are claimed. Nice and clean."
            : `${unclaimed.length} unclaimed · ~$${valueAtRisk.toLocaleString()} in commission at risk if not claimed.`
        }
      />
      <PageBody className="space-y-6">
        {unclaimed.length > 0 && (
          <Section
            title="Quick checklist"
            subtitle="Open GHL, run these for each prospect, then click Claimed."
          >
            <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
              {GHL_CHECKLIST_STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Section>
        )}

        <Section
          title={`Unclaimed · ${unclaimed.length}`}
          action={
            <Link
              to="/pipeline"
              className="text-xs text-primary hover:underline"
            >
              Pipeline →
            </Link>
          }
        >
          {unclaimed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Trophy className="h-6 w-6 text-success" />
              <div className="text-sm text-muted-foreground">
                Nothing to claim. Every booked call is locked in.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {unclaimed.map((p) => {
                const ageHours = Math.floor(
                  (Date.now() - new Date(p.stageEnteredAt).getTime()) / 3600000,
                );
                const stale = ageHours >= 24;
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <Link
                      to="/prospects/$id"
                      params={{ id: p.id }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 -mx-1 py-1 hover:bg-muted/30"
                    >
                      <div
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                          stale
                            ? "bg-destructive/15 text-destructive"
                            : "bg-amber-500/15 text-amber-500",
                        )}
                      >
                        {p.qualScore || "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate font-medium">
                          <span className="truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {platformEmoji(p.platform)}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] uppercase",
                              p.tier === "DFY" && "border-tier-dfy/50 text-tier-dfy",
                              p.tier === "DWY" && "border-tier-dwy/50 text-tier-dwy",
                              p.tier === "DIY" && "border-tier-diy/50 text-tier-diy",
                            )}
                          >
                            {p.tier} · ${TIER_VALUE[p.tier]}
                          </Badge>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          <Clock className="mr-1 inline h-3 w-3" />
                          Booked {formatDistanceToNow(new Date(p.stageEnteredAt), { addSuffix: true })}
                          {p.niche ? ` · ${p.niche}` : ""}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {p.profileUrl && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                          <a
                            href={p.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open profile"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => onClaim(p.id, p.name)}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Claimed
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {claimed.length > 0 && (
          <Section title="Recently claimed" subtitle="Last 10 locked in.">
            <ul className="divide-y divide-border/60">
              {claimed.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <Link
                    to="/prospects/$id"
                    params={{ id: p.id }}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(p.stageEnteredAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </PageBody>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";
import { useStore, daysSince } from "@/lib/store";
import { SEQUENCE, platformEmoji } from "@/lib/btf/types";
import { chat, AiNotConfiguredError } from "@/lib/ai/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/outreach")({
  head: () => ({
    meta: [
      { title: "Outreach — BTF Setter OS" },
      { name: "description", content: "Active conversations and AI-suggested next actions." },
    ],
  }),
  component: OutreachPage,
});

const ACTIVE_STAGES = new Set([
  "Connected",
  "VN1 Sent",
  "Replied",
  "VN2 Sent",
  "Calendar Sent",
  "Re-Engaged",
]);

function nextSequenceStep(platform: keyof typeof SEQUENCE, ageDays: number) {
  const steps = SEQUENCE[platform];
  const next = steps.find((s) => s.day >= ageDays);
  if (next) return { action: next.action, dueIn: next.day - ageDays };
  return { action: "Break-up / re-engage", dueIn: 0 };
}

function OutreachPage() {
  const prospects = useStore((s) => s.prospects);
  const settings = useStore((s) => s.settings);
  const active = useMemo(
    () => prospects.filter((p) => ACTIVE_STAGES.has(p.stage)),
    [prospects],
  );
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiOut, setAiOut] = useState<Record<string, string>>({});

  const runAi = async (id: string) => {
    const p = prospects.find((x) => x.id === id);
    if (!p) return;
    setAiBusy(id);
    try {
      const last = p.activities[0];
      const out = await chat(settings, [{
        role: "user",
        content: `Prospect: ${p.name} on ${p.platform}, niche ${p.niche}, stage ${p.stage}, ${daysSince(p.stageEnteredAt)}d in stage. Last activity: ${last ? `${last.type}: ${last.notes}` : "none"}. What's the exact next move? Be tactical and short.`,
      }]);
      setAiOut((m) => ({ ...m, [id]: out }));
    } catch (e) {
      toast.error(e instanceof AiNotConfiguredError ? e.message : `AI error: ${(e as Error).message}`);
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Outreach" subtitle={`${active.length} active conversations`} />

      <PageBody>
        {active.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            No active conversations. Move prospects into a conversation stage to see them here.
          </div>
        ) : (
          <div className="grid gap-3">
            {active.map((p) => {
              const ageDays = daysSince(p.stageEnteredAt);
              const touchDays = daysSince(p.lastTouchAt);
              const next = nextSequenceStep(p.platform, ageDays);
              const overdue = next.dueIn === 0 && touchDays >= 1;
              const last = p.activities[0];
              const lastVN = p.vnLog[0];
              const toneMatch = lastVN?.reply === "VN" ? "matching" : lastVN?.reply === "text" ? "warm" : "cold";

              return (
                <Section
                  key={p.id}
                  title={`${platformEmoji(p.platform)} ${p.name} · ${p.stage}`}
                  action={
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          toneMatch === "matching" && "border-success text-success",
                          toneMatch === "cold" && "border-destructive text-destructive",
                        )}
                      >
                        Tone: {toneMatch}
                      </Badge>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/prospects/$id" params={{ id: p.id }}>Open</Link>
                      </Button>
                    </div>
                  }
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Last message</div>
                      <div className="mt-1 text-sm">{last ? last.notes : "—"}</div>
                      <div className="mt-1 text-xs text-muted-foreground num">
                        {touchDays}d since touch
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Sequence</div>
                      <div className={cn("mt-1 text-sm", overdue && "text-destructive")}>
                        {next.action}{" "}
                        <span className="text-xs text-muted-foreground">
                          {next.dueIn === 0 ? (overdue ? "(overdue)" : "(today)") : `(in ${next.dueIn}d)`}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={aiBusy === p.id}
                        onClick={() => runAi(p.id)}
                      >
                        {aiBusy === p.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1 h-3 w-3" />
                        )}
                        AI next action
                      </Button>
                    </div>
                  </div>
                  {aiOut[p.id] && (
                    <pre className="mt-3 whitespace-pre-wrap rounded-md bg-surface p-3 text-sm">{aiOut[p.id]}</pre>
                  )}
                </Section>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}

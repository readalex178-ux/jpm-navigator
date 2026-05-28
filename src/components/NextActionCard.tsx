import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Copy, Calendar, ArrowRight, Clock, MessageSquareReply, ListTodo, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { suggestNextAction, type NextAction } from "@/lib/ai/nextAction.functions";
import { useStore } from "@/lib/store";
import { buildConversation } from "@/components/ConversationLog";
import type { Prospect, Stage, ActivityType } from "@/lib/btf/types";
import { STAGES } from "@/lib/btf/types";

type Props = {
  prospect: Prospect;
  extras?: Array<{ fromMe: boolean; type: ActivityType; date: string; text: string }>;
  /** Optional callback to push the draft into a composer. */
  onUseDraft?: (text: string, type: ActivityType) => void;
};

const URGENCY_CLASS: Record<NextAction["urgency"], string> = {
  now: "bg-destructive/15 text-destructive border-destructive/30",
  today: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  this_week: "bg-primary/15 text-primary border-primary/30",
  later: "bg-muted text-muted-foreground border-border",
};

const TYPE_LABEL: Record<NextAction["type"], string> = {
  send_reply: "Send a reply",
  schedule_follow_up: "Schedule follow-up",
  move_stage: "Move stage",
  log_activity: "Log an action",
  wait: "Wait",
};

const TYPE_ICON: Record<NextAction["type"], typeof Sparkles> = {
  send_reply: MessageSquareReply,
  schedule_follow_up: Calendar,
  move_stage: ArrowRight,
  log_activity: ListTodo,
  wait: Clock,
};

export function NextActionCard({ prospect, extras, onUseDraft }: Props) {
  const call = useServerFn(suggestNextAction);
  const setFollowUp = useStore((s) => s.setFollowUp);
  const moveStage = useStore((s) => s.moveStage);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<NextAction | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const conv = buildConversation(prospect.activities ?? [], prospect.vnLog ?? [], extras ?? []);
      const signals = Object.entries(prospect.signals)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await call({
        data: {
          prospectName: prospect.name,
          platform: prospect.platform,
          niche: prospect.niche ?? "",
          stage: prospect.stage,
          stageEnteredAt: prospect.stageEnteredAt,
          lastTouchAt: prospect.lastTouchAt,
          tier: prospect.tier,
          bio: prospect.bio ?? "",
          signals,
          qualScore: prospect.qualScore,
          bant: prospect.bant,
          messages: conv.map((m) => ({
            fromMe: m.fromMe,
            type: m.type,
            date: m.date,
            text: m.text,
          })),
          followUpAt: prospect.followUpAt ?? null,
        },
      });
      if (!res.ok) throw new Error(res.error);
      setAction(res.result);
    } catch (e) {
      toast.error(`AI: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!action) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs font-semibold">Next action</div>
              <div className="text-[11px] text-muted-foreground">
                AI reads the stage + latest reply, suggests one move.
              </div>
            </div>
          </div>
          <Button size="sm" onClick={run} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
            Suggest next action
          </Button>
        </div>
      </div>
    );
  }

  const Icon = TYPE_ICON[action.type];
  const confidencePct = Math.round(action.confidence * 100);

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="rounded bg-primary/15 p-1.5 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {TYPE_LABEL[action.type]}
              </span>
              <Badge variant="outline" className={cn("text-[10px]", URGENCY_CLASS[action.urgency])}>
                {action.urgency.replace("_", " ")}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{confidencePct}% confident</span>
            </div>
            <div className="mt-0.5 text-sm font-semibold leading-snug">{action.title}</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={run} disabled={busy} title="Regenerate">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{action.reason}</p>

      {action.type === "send_reply" && action.draftMessage && (
        <div className="rounded border border-border bg-background p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Draft · {action.activityType || "text"}
            </span>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-xs">{action.draftMessage}</pre>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                navigator.clipboard.writeText(action.draftMessage);
                toast.success("Copied — paste into the platform when ready.");
              }}
            >
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
            {onUseDraft && (
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  const t = (action.activityType || "text") as ActivityType;
                  onUseDraft(action.draftMessage, t);
                  toast.success("Loaded into composer. Send manually, then click Log.");
                }}
              >
                Load into composer
              </Button>
            )}
          </div>
        </div>
      )}

      {action.type === "schedule_follow_up" && action.followUpAt && (
        <div className="rounded border border-border bg-background p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Suggested for
              </div>
              <div className="font-medium">
                {new Date(action.followUpAt).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {action.followUpReason && (
                <div className="text-[11px] text-muted-foreground">{action.followUpReason}</div>
              )}
            </div>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                setFollowUp(prospect.id, action.followUpAt, action.followUpReason || "AI-suggested follow-up");
                toast.success("Follow-up scheduled.");
              }}
            >
              <Calendar className="mr-1 h-3 w-3" /> Schedule
            </Button>
          </div>
        </div>
      )}

      {action.type === "move_stage" && action.suggestedStage && (
        <div className="rounded border border-border bg-background p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Move to stage
              </div>
              <div className="font-medium">
                {prospect.stage} <ArrowRight className="inline h-3 w-3" /> {action.suggestedStage}
              </div>
            </div>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              disabled={!STAGES.includes(action.suggestedStage as Stage) || prospect.stage === action.suggestedStage}
              onClick={() => {
                moveStage(prospect.id, action.suggestedStage as Stage);
                toast.success(`Moved to ${action.suggestedStage}`);
              }}
            >
              <ArrowRight className="mr-1 h-3 w-3" /> Move
            </Button>
          </div>
        </div>
      )}

      {action.type === "log_activity" && action.activityType && (
        <div className="rounded border border-border bg-background p-2 text-[11px] text-muted-foreground">
          Suggested activity: <span className="font-medium text-foreground">{action.activityType}</span>.
          Log it from the composer when done.
        </div>
      )}

      {action.type === "wait" && (
        <div className="rounded border border-border bg-background p-2 text-[11px] text-muted-foreground">
          No action right now. Re-check this prospect later.
        </div>
      )}
    </div>
  );
}

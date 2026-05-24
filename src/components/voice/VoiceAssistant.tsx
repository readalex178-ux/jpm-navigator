import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { parseVoiceIntent, type VoiceIntent } from "@/lib/ai/voiceIntent.functions";
import { suggestFollowUp } from "@/lib/ai/prospectCoach.functions";
import { buildConversation } from "@/components/ConversationLog";
import { useStore } from "@/lib/store";
import type { Prospect, Stage } from "@/lib/btf/types";

type Status = "idle" | "recording" | "processing";

type PendingAction = {
  intent: VoiceIntent;
  prospectId?: string;
};

interface Props {
  variant: "floating" | "header";
}

export function VoiceAssistant({ variant }: Props) {
  const router = useRouter();
  const parseFn = useServerFn(parseVoiceIntent);
  const suggestFn = useServerFn(suggestFollowUp);
  const prospects = useStore((s) => s.prospects);
  const moveStage = useStore((s) => s.moveStage);
  const updateProspect = useStore((s) => s.updateProspect);
  const logActivity = useStore((s) => s.logActivity);
  const setFollowUp = useStore((s) => s.setFollowUp);

  const [status, setStatus] = useState<Status>("idle");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) {
        toast.error("Didn't catch that. Try again.");
        setStatus("idle");
        return;
      }

      // If a text field is focused, treat as dictation regardless of intent parsing.
      const focused = document.activeElement as HTMLElement | null;
      const isTextField =
        focused &&
        (focused.tagName === "TEXTAREA" ||
          (focused.tagName === "INPUT" &&
            ["text", "search", "url", "email", ""].includes(
              (focused as HTMLInputElement).type,
            )));

      if (isTextField) {
        insertIntoField(focused as HTMLInputElement | HTMLTextAreaElement, transcript);
        toast.success("Dictated");
        setStatus("idle");
        return;
      }

      const directFollowUpProspect = detectDirectFollowUpIntent(prospects, transcript);
      if (directFollowUpProspect) {
        await applyFollowUpIntent(directFollowUpProspect);
        setStatus("idle");
        return;
      }

      const res = await parseFn({ data: { transcript } });
      setStatus("idle");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      executeIntent(res.intent, transcript);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyFollowUpIntent, parseFn, prospects],
  );

  const applyFollowUpIntent = useCallback(
    async (prospect: Prospect) => {
      try {
        const res = await suggestFn({ data: { context: buildProspectContext(prospect) } });
        if (res.ok) {
          setFollowUp(prospect.id, res.followUpAt, res.reason);
          toast.success(`Follow-up set for ${prospect.name}`);
          return;
        }
      } catch {}

      const fallback = fallbackFollowUpForStage(prospect.stage);
      setFollowUp(prospect.id, fallback.followUpAt, fallback.reason);
      toast.success(`Follow-up set for ${prospect.name}`);
    },
    [setFollowUp, suggestFn],
  );

  const executeIntent = async (intent: VoiceIntent, raw: string) => {
    switch (intent.kind) {
      case "navigate": {
        if (!intent.route) {
          toast.error("Couldn't tell where you wanted to go.");
          return;
        }
        const route = normaliseRoute(intent.route);
        router.navigate({ to: route });
        toast.success(intent.confirm || `Opening ${route}`);
        return;
      }
      case "prospect_action": {
        const match = findProspect(prospects, intent.prospectName);
        if (!match) {
          toast.error(`No prospect found matching "${intent.prospectName ?? "?"}".`);
          return;
        }
        if (intent.action === "open") {
          router.navigate({ to: "/prospects/$id", params: { id: match.id } });
          toast.success(`Opening ${match.name}`);
          return;
        }
        if (intent.action === "set_followup") {
          await applyFollowUpIntent(match);
          return;
        }
        // All other prospect actions require explicit click — no auto-mutation.
        setPending({ intent, prospectId: match.id });
        return;
      }
      case "dictate": {
        // No text field focused — show the transcript so the user can copy.
        toast.info(`Heard: "${(intent.transcript ?? raw).slice(0, 200)}"`, {
          duration: 8000,
          action: {
            label: "Copy",
            onClick: () => navigator.clipboard.writeText(intent.transcript ?? raw),
          },
        });
        return;
      }
      default:
        toast.error(intent.confirm || "Didn't understand that command.");
    }
  };

  const applyPending = () => {
    if (!pending?.prospectId) return;
    const { intent, prospectId } = pending;
    const target = prospects.find((p) => p.id === prospectId);
    if (!target) return;
    switch (intent.action) {
      case "move_stage":
        if (intent.stage) {
          moveStage(prospectId, intent.stage as Stage);
          toast.success(`${target.name} → ${intent.stage}`);
        }
        break;
      case "set_tier":
        if (intent.tier) {
          updateProspect(prospectId, { tier: intent.tier });
          toast.success(`${target.name} tier → ${intent.tier}`);
        }
        break;
      case "add_note":
        if (intent.text) {
          logActivity(prospectId, {
            date: new Date().toISOString(),
            type: "note",
            notes: intent.text,
          });
          toast.success(`Note added to ${target.name}`);
        }
        break;
      case "log_activity":
        if (intent.text) {
          logActivity(prospectId, {
            date: new Date().toISOString(),
            type: intent.activityType ?? "note",
            notes: intent.text,
          });
          toast.success(`Activity logged on ${target.name}`);
        }
        break;
    }
    setPending(null);
  };

  const startRecording = useCallback(async () => {
    if (status !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopStream();
        setStatus("processing");
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        if (blob.size < 500) {
          toast.error("Too short. Hold the mic and speak.");
          setStatus("idle");
          return;
        }
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (!token) {
            toast.error("Sign in first.");
            setStatus("idle");
            return;
          }
          const fd = new FormData();
          const ext = mime.includes("mp4") ? "m4a" : "webm";
          fd.append("file", blob, `voice.${ext}`);
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: fd,
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = (await res.json()) as { ok: boolean; text?: string; error?: string };
          if (!json.ok) throw new Error(json.error ?? "Transcribe failed");
          await handleTranscript((json.text ?? "").trim());
        } catch (err) {
          toast.error((err as Error).message);
          setStatus("idle");
        }
      };
      mediaRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      toast.error("Microphone permission denied.");
      setStatus("idle");
    }
  }, [status, handleTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }
  }, []);

  // Spacebar push-to-talk (desktop convenience) — only when not typing.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
    };
    let armed = false;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      armed = true;
      void startRecording();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !armed) return;
      armed = false;
      stopRecording();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [startRecording, stopRecording]);

  const tapToggle = () => {
    if (status === "recording") stopRecording();
    else if (status === "idle") void startRecording();
  };

  if (variant === "header") {
    return (
      <div className="hidden lg:flex items-center gap-2">
        <Button
          size="sm"
          variant={status === "recording" ? "destructive" : "outline"}
          onClick={tapToggle}
          title="Voice command (Ctrl/Cmd + Space)"
          disabled={status === "processing"}
        >
          {status === "processing" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : status === "recording" ? (
            <MicOff className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
          <span className="ml-1 hidden xl:inline">
            {status === "recording" ? "Stop" : "Voice"}
          </span>
        </Button>
        {pending && <PendingChip pending={pending} onApply={applyPending} onCancel={() => setPending(null)} />}
      </div>
    );
  }

  // Floating (mobile/tablet only — hidden on lg+)
  return (
    <>
      <button
        onClick={tapToggle}
        disabled={status === "processing"}
        aria-label="Voice command"
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg lg:hidden",
          "transition-all active:scale-95",
          status === "recording"
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : "bg-primary text-primary-foreground",
        )}
      >
        {status === "processing" ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : status === "recording" ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>
      {pending && (
        <div className="fixed bottom-24 right-5 z-50 max-w-[calc(100vw-2rem)] lg:hidden">
          <PendingChip pending={pending} onApply={applyPending} onCancel={() => setPending(null)} />
        </div>
      )}
    </>
  );
}

function PendingChip({
  pending,
  onApply,
  onCancel,
}: {
  pending: PendingAction;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-surface-elevated p-2 text-xs shadow-md">
      <Badge variant="outline" className="border-primary text-primary">
        Confirm
      </Badge>
      <span className="max-w-[18rem] truncate">{pending.intent.confirm || "Apply?"}</span>
      <Button size="sm" variant="default" onClick={onApply}>
        <Check className="mr-1 h-3 w-3" /> Apply
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/* ============ helpers ============ */

const ROUTE_ALIASES: Record<string, string> = {
  "/": "/",
  home: "/",
  dashboard: "/",
  inbox: "/inbox",
  prospects: "/prospects",
  prospect: "/prospects",
  pipeline: "/pipeline",
  outreach: "/outreach",
  linkedin: "/linkedin",
  copilot: "/linkedin",
  "co-pilot": "/linkedin",
  kpi: "/kpi",
  kpis: "/kpi",
  metrics: "/kpi",
  tools: "/tools",
  training: "/training",
  settings: "/settings",
};

function normaliseRoute(input: string): string {
  const key = input.trim().toLowerCase().replace(/^\/+/, "");
  if (key === "") return "/";
  return ROUTE_ALIASES[key] ?? (input.startsWith("/") ? input : `/${key}`);
}

function findProspect<T extends { id: string; name: string }>(
  list: T[],
  query: string | undefined,
): T | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  // exact, then startsWith, then includes
  return (
    list.find((p) => p.name.toLowerCase() === q) ||
    list.find((p) => p.name.toLowerCase().startsWith(q)) ||
    list.find((p) => p.name.toLowerCase().includes(q)) ||
    list.find((p) => q.split(/\s+/).every((w) => p.name.toLowerCase().includes(w)))
  );
}

function insertIntoField(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  const joiner = before && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
  const next = `${before}${joiner}${text}${after}`;
  // React-friendly value setter
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const caret = before.length + joiner.length + text.length;
  el.setSelectionRange(caret, caret);
}

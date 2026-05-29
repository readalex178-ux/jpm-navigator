import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles, CalendarClock, X, Check, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import {
  prospectCoachChat,
  suggestFollowUp,
} from "@/lib/ai/prospectCoach.functions";
import type { Prospect } from "@/lib/btf/types";
import { buildConversation } from "./ConversationLog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type ChatMsg = { role: "user" | "assistant"; content: string };

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(local: string): string {
  // local string like "2026-05-25T09:30" — interpret as local time
  return new Date(local).toISOString();
}

export function ProspectCoachChat({ prospect }: { prospect: Prospect }) {
  const setFollowUp = useStore((s) => s.setFollowUp);
  const messages = useStore((s) => s.coachChats[prospect.id] ?? []) as ChatMsg[];
  const appendCoachChat = useStore((s) => s.appendCoachChat);
  const clearCoachChat = useStore((s) => s.clearCoachChat);
  const setMessages = (next: ChatMsg[]) => {
    // Replace transcript for this prospect by clearing + re-appending the diff.
    clearCoachChat(prospect.id);
    const stamp = new Date().toISOString();
    next.forEach((m) => appendCoachChat(prospect.id, { ...m, at: stamp }));
  };
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [pendingFollowUp, setPendingFollowUp] = useState<
    { at: string; reason: string } | null
  >(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- Voice dictation (MediaRecorder → /api/transcribe) ----
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const autoSendRef = useRef(true);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const chatFn = useServerFn(prospectCoachChat);
  const suggestFn = useServerFn(suggestFollowUp);

  const ctx = useMemo(() => {
    const conv = buildConversation(prospect.activities, prospect.vnLog);
    return {
      name: prospect.name,
      platform: prospect.platform,
      niche: prospect.niche,
      stage: prospect.stage,
      stageEnteredAt: prospect.stageEnteredAt,
      lastTouchAt: prospect.lastTouchAt,
      tier: prospect.tier,
      bio: prospect.bio,
      signals: Object.entries(prospect.signals)
        .filter(([, v]) => v)
        .map(([k]) => k),
      bant: prospect.bant,
      qualScore: prospect.qualScore,
      messages: conv.map((m) => ({
        fromMe: m.fromMe,
        type: m.type,
        date: m.date,
        text: m.text,
      })),
      followUpAt: prospect.followUpAt ?? null,
    };
  }, [prospect]);

  // Trigger phrases where the user explicitly tells the coach to schedule a
  // follow-up — we auto-apply the AI's suggested date in parallel with the
  // chat reply (no confirm chip). Voice/typed user action = explicit consent.
  const FOLLOWUP_TRIGGERS = useMemo(
    () =>
      /\b(left (me )?on read|on read|ghost(ed|ing)?|no reply|hasn[' ]?t replied|haven[' ]?t replied|didn[' ]?t reply|ignored (me )?|no response|went silent|cold|disappeared|left me hanging)\b/i,
    [],
  );

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);

    const autoFollowUp = FOLLOWUP_TRIGGERS.test(trimmed);

    try {
      // Run chat + (optional) follow-up suggestion in parallel
      const [chatRes, fuRes] = await Promise.all([
        chatFn({ data: { context: ctx, messages: next } }),
        autoFollowUp
          ? suggestFn({ data: { context: ctx } }).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (!chatRes.ok) {
        toast.error(chatRes.error);
        return;
      }
      setMessages([...next, { role: "assistant", content: chatRes.content }]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });

      // Auto-apply follow-up — no confirm needed, user explicitly asked
      if (autoFollowUp && fuRes && fuRes.ok) {
        setFollowUp(prospect.id, fuRes.followUpAt, fuRes.reason);
        toast.success(
          `Follow-up set · ${new Date(fuRes.followUpAt).toLocaleString([], {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          })}`,
        );
      }
    } catch (e) {
      toast.error(`Coach error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const askSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await suggestFn({ data: { context: ctx } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPendingFollowUp({ at: res.followUpAt, reason: res.reason });
    } catch (e) {
      toast.error(`AI error: ${(e as Error).message}`);
    } finally {
      setSuggesting(false);
    }
  };

  const applyFollowUp = () => {
    if (!pendingFollowUp) return;
    setFollowUp(prospect.id, pendingFollowUp.at, pendingFollowUp.reason);
    toast.success(
      `Follow-up set for ${new Date(pendingFollowUp.at).toLocaleString()}`,
    );
    setPendingFollowUp(null);
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopListening = useCallback(() => {
    if (mediaRef.current?.state === "recording") {
      try {
        mediaRef.current.stop();
      } catch {}
    }
  }, []);

  const startListening = useCallback(
    async (autoSend: boolean) => {
      if (listening || transcribing) {
        autoSendRef.current = autoSend;
        stopListening();
        return;
      }
      autoSendRef.current = autoSend;
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
          setListening(false);
          const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
          if (blob.size < 500) {
            toast.error("Too short. Hold the mic and speak.");
            return;
          }
          setTranscribing(true);
          try {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) {
              toast.error("Sign in first.");
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
            const text = (json.text ?? "").trim();
            if (!text) {
              toast.error("Didn't catch that. Try again.");
              return;
            }
            if (autoSendRef.current) {
              void send(text);
            } else {
              setInput((prev) => (prev ? prev + " " : "") + text);
            }
          } catch (err) {
            toast.error(`Mic: ${(err as Error).message}`);
          } finally {
            setTranscribing(false);
          }
        };
        mediaRef.current = recorder;
        recorder.start();
        setListening(true);
      } catch {
        toast.error("Microphone permission denied.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listening, transcribing, stopListening],
  );

  useEffect(() => {
    return () => stopListening();
  }, []);

  return (
    <div className="space-y-3">
      {/* Existing follow-up status */}
      {prospect.followUpAt && (
        <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            <span>
              Follow-up{" "}
              <span className="num font-semibold text-primary">
                {new Date(prospect.followUpAt).toLocaleString()}
              </span>
              {prospect.followUpReason && (
                <span className="text-muted-foreground"> · {prospect.followUpReason}</span>
              )}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={() => {
              setFollowUp(prospect.id, null, null);
              toast.message("Follow-up cleared");
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Chat transcript */}
      <div
        ref={scrollRef}
        className="max-h-[320px] min-h-[120px] space-y-2 overflow-y-auto rounded-md border border-border bg-surface p-3"
      >
        {messages.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Ask anything: "Did they leave me on read?" · "When should I follow up?" · "Draft my VN2"
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex w-full",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary/15 border border-primary/30"
                    : "bg-background border border-border",
                )}
              >
                <Badge
                  variant="outline"
                  className="mb-1 h-fit px-1 py-0 text-[9px] uppercase tracking-widest"
                >
                  {m.role === "user" ? "You" : "Coach"}
                </Badge>
                <div>{m.content}</div>
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Coach thinking…
          </div>
        )}
      </div>

      {/* Pending AI suggestion — needs confirmation */}
      {pendingFollowUp && (
        <div className="rounded-md border border-amber-400/60 bg-amber-400/5 p-3 text-xs">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span className="font-medium">AI suggests follow-up</span>
          </div>
          <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="datetime-local"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              value={toLocalInputValue(pendingFollowUp.at)}
              onChange={(e) =>
                setPendingFollowUp({
                  ...pendingFollowUp,
                  at: fromLocalInputValue(e.target.value),
                })
              }
            />
          </div>
          <Input
            value={pendingFollowUp.reason}
            onChange={(e) =>
              setPendingFollowUp({ ...pendingFollowUp, reason: e.target.value })
            }
            className="mb-2 h-8 text-xs"
            placeholder="Reason"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPendingFollowUp(null)}
            >
              Discard
            </Button>
            <Button size="sm" onClick={applyFollowUp}>
              <Check className="mr-1 h-3 w-3" /> Set follow-up
            </Button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              listening
                ? "Listening… say e.g. “Sarah left me on read”"
                : "Ask the coach about this prospect… (or tap the mic)"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            className={cn(listening && "border-primary ring-1 ring-primary/40")}
          />
          {listening && (
            <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Rec
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={listening ? "destructive" : "outline"}
            disabled={busy || transcribing}
            onClick={() => startListening(true)}
            title="Hold the mic, speak, then it auto-sends"
          >
            {transcribing ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Transcribing…
              </>
            ) : listening ? (
              <>
                <MicOff className="mr-1 h-3 w-3" /> Stop & send
              </>
            ) : (
              <>
                <Mic className="mr-1 h-3 w-3" /> Speak
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={suggesting || busy}
            onClick={askSuggest}
          >
            {suggesting ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <CalendarClock className="mr-1 h-3 w-3" />
            )}
            Suggest follow-up
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void send("Did they leave me on read? When should I follow up?")}
          >
            Left on read?
          </Button>
          <div className="ml-auto">
            <Button size="sm" disabled={!input.trim() || busy} onClick={() => void send(input)}>
              <Send className="mr-1 h-3 w-3" /> Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

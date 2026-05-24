import { useEffect, useMemo, useRef, useState } from "react";
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
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [pendingFollowUp, setPendingFollowUp] = useState<
    { at: string; reason: string } | null
  >(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- Voice dictation (Web Speech API) ----
  const recogRef = useRef<any>(null);
  const autoSendRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const speechSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

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

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chatFn({ data: { context: ctx, messages: next } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMessages([...next, { role: "assistant", content: res.content }]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
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

  const stopListening = () => {
    try {
      recogRef.current?.stop();
    } catch {}
  };

  const startListening = (autoSend: boolean) => {
    if (!speechSupported) {
      toast.error("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    if (listening) {
      autoSendRef.current = autoSend;
      stopListening();
      return;
    }
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    autoSendRef.current = autoSend;

    let finalText = "";
    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText) setInput((prev) => (prev ? prev + " " : "") + finalText.trim());
    };
    rec.onerror = (e: any) => {
      if (e.error !== "aborted" && e.error !== "no-speech") {
        toast.error(`Mic error: ${e.error}`);
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recogRef.current = null;
      if (autoSendRef.current && finalText.trim()) {
        const toSend = finalText.trim();
        setInput("");
        void send(toSend);
      }
    };

    recogRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch (err) {
      setListening(false);
      toast.error(`Couldn't start mic: ${(err as Error).message}`);
    }
  };

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
        <Textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the coach about this prospect…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
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

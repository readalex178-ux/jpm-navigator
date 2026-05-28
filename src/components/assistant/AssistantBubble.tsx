import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Trash2, Paperclip, Mic, MicOff } from "lucide-react";
import { parseProspectsCsv } from "@/lib/csvImport";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth/useAuth";
import { useAssistantThread } from "@/lib/assistant/useAssistantThread";
import { assistantChat } from "@/lib/assistant/assistant.functions";
import {
  AssistantResponseSchema,
  type Proposal,
  type ProposalRecord,
} from "@/lib/assistant/intents";
import { ProposalCard } from "./ProposalCard";

const uid = () => Math.random().toString(36).slice(2, 11);

export function AssistantBubble() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatFn = useServerFn(assistantChat);
  const prospects = useStore((s) => s.prospects);
  const { messages, loaded, append, patchProposal, clearAll } = useAssistantThread();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    rec.onresult = (e: any) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalText) {
        baseInputRef.current = (baseInputRef.current + " " + finalText).replace(/\s+/g, " ").trim();
      }
      const combined = (baseInputRef.current + (interim ? " " + interim : "")).trim();
      setInput(combined);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {}
    };
  }, []);

  const toggleVoice = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      try {
        rec.stop();
      } catch {}
      setListening(false);
    } else {
      baseInputRef.current = input;
      try {
        rec.start();
        setListening(true);
      } catch {}
    }
  };

  const onCsvSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await append("user", `📎 Uploaded ${file.name}`);
    try {
      const text = await file.text();
      const parsed = parseProspectsCsv(text);
      if (parsed.errors.length) {
        await append("assistant", `⚠️ ${parsed.errors.join(" ")}`);
        return;
      }
      if (!parsed.rows.length) {
        await append(
          "assistant",
          `No valid rows found in ${file.name}.${parsed.failures.length ? ` (${parsed.failures.length} skipped)` : ""}`,
        );
        return;
      }
      const proposal: ProposalRecord = {
        id: uid(),
        kind: "import_csv",
        fileName: file.name,
        rows: parsed.rows as unknown as Record<string, unknown>[],
        skippedCount: parsed.failures.length,
      };
      await append(
        "assistant",
        `Parsed **${parsed.rows.length}** prospect${parsed.rows.length === 1 ? "" : "s"} from ${file.name}${parsed.failures.length ? ` (${parsed.failures.length} rows skipped).` : "."} Review and approve which to add to your pipeline.`,
        [proposal],
      );
    } catch (err) {
      console.error("[assistant] csv parse failed", err);
      await append("assistant", "⚠️ Couldn't read that file. Make sure it's a valid CSV.");
    }
  };



  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  if (auth.status !== "authed") return null;

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const userMsg = await append("user", text);

    try {
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await chatFn({
        data: {
          message: text,
          history,
          prospects: prospects.slice(0, 200).map((p) => ({
            id: p.id,
            name: p.name,
            niche: p.niche,
            stage: p.stage,
            lastTouchAt: p.lastTouchAt,
          })),
        },
      });

      if (!res.ok) {
        await append("assistant", `⚠️ ${res.error}`);
        return;
      }

      let parsed;
      try {
        parsed = AssistantResponseSchema.parse(JSON.parse(res.content));
      } catch (e) {
        console.error("[assistant] parse failed", e, res.content);
        await append("assistant", res.content || "Sorry, I couldn't structure that.");
        return;
      }

      const proposals: ProposalRecord[] = (parsed.proposals as Proposal[])
        .filter((p) => p.kind !== "answer_only")
        .map((p) => ({ ...p, id: uid() } as ProposalRecord));
      await append("assistant", parsed.reply, proposals);
    } catch (e) {
      console.error("[assistant] send failed", e);
      await append("assistant", "⚠️ Something broke. Try again.");
    } finally {
      setSending(false);
      // unused but suppresses lint
      void userMsg;
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 sm:bottom-6 sm:right-6"
        aria-label="Open assistant"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-display">Assistant</SheetTitle>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Clear chat history?")) clearAll();
                    }}
                    aria-label="Clear history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tell me what you did — I'll route it to the right prospect.
            </p>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {!loaded && (
              <div className="flex justify-center pt-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {loaded && messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Try:</p>
                <ul className="space-y-1 text-xs">
                  <li>• "Sent VN to Sarah about the calendar offer"</li>
                  <li>• "Move James Chen to Calendar Sent"</li>
                  <li>• "New lead Anna Lopez from IG, fitness niche"</li>
                  <li>• "Who's overdue for follow-up?"</li>
                </ul>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-foreground/90 whitespace-pre-wrap">
                      {m.content}
                    </div>
                    {m.proposals.map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        onPatch={(patch) => patchProposal(m.id, p.id, patch)}
                      />
                    ))}
                  </>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onCsvSelected}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label="Upload CSV"
                title="Upload a CSV to import prospects"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              {voiceSupported && (
                <Button
                  size="icon"
                  variant={listening ? "default" : "ghost"}
                  onClick={toggleVoice}
                  disabled={sending}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  title={listening ? "Stop recording" : "Speak instead of typing"}
                  className={listening ? "animate-pulse" : ""}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="What did you just do? (or attach a CSV)"
                rows={2}
                className="resize-none"
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={send}
                disabled={!input.trim() || sending}
                aria-label="Send"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Enter to send · attach a CSV to import · nothing is saved until you click Apply
            </p>

          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

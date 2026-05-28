import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Trash2 } from "lucide-react";
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
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="What did you just do?"
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
              ⌘ + Enter to send · nothing is saved until you click Apply
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

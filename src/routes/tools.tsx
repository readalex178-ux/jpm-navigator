import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Sparkles, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  buildVN1Script,
  analyzePastedThread,
  type VN1ScriptResult,
  type PastedThreadResult,
} from "@/lib/ai/aiAssistants.functions";
import {
  OBJECTIONS,
  WARM_SIGNALS,
  PRESCREEN_SCRIPT,
  SKIP_TO_CALENDAR_SCRIPT,
  recommendPreScreen,
} from "@/lib/btf/playbook";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Tools — BTF Setter OS" },
      {
        name: "description",
        content:
          "BTF setter toolkit: VN1 script builder, paste-a-thread analyser, objection library, pre-screen assistant, warm signal alerts.",
      },
    ],
  }),
  component: ToolsPage,
});

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(label);
}

function ToolsPage() {
  return (
    <>
      <PageHeader
        title="Tools"
        subtitle="Everything you need at the moment of action."
      />
      <PageBody>
        <Tabs defaultValue="script">
          <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex h-auto w-max gap-1 p-1">
              <TabsTrigger value="script" className="whitespace-nowrap">VN Builder</TabsTrigger>
              <TabsTrigger value="thread" className="whitespace-nowrap">Thread Analyser</TabsTrigger>
              <TabsTrigger value="objections" className="whitespace-nowrap">Objections</TabsTrigger>
              <TabsTrigger value="prescreen" className="whitespace-nowrap">Pre-Screen</TabsTrigger>
              <TabsTrigger value="warm" className="whitespace-nowrap">Warm Signal</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="script" className="mt-4"><ScriptBuilderTab /></TabsContent>
          <TabsContent value="thread" className="mt-4"><ThreadAnalyserTab /></TabsContent>
          <TabsContent value="objections" className="mt-4"><ObjectionsTab /></TabsContent>
          <TabsContent value="prescreen" className="mt-4"><PreScreenTab /></TabsContent>
          <TabsContent value="warm" className="mt-4"><WarmSignalTab /></TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

/* ===================== 1. VN Builder ===================== */
function ScriptBuilderTab() {
  const fn = useServerFn(buildVN1Script);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<VN1ScriptResult | null>(null);

  const run = async () => {
    if (text.trim().length < 10) return toast.error("Paste a profile first.");
    setBusy(true); setRes(null);
    try {
      const r = await fn({ data: { profileText: text.trim() } });
      if (r.ok) setRes(r.result);
      else toast.error(r.error);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Profile input">
        <p className="mb-2 text-xs text-muted-foreground">
          Paste the prospect's LinkedIn profile — name, headline, about, and any recent posts. The more context, the sharper the opener.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste full profile content here…"
          className="min-h-[260px] text-xs"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
            Generate voice note
          </Button>
        </div>
      </Section>

      <Section
        title="Your voice-note opener"
        action={res && (
          <Button size="sm" variant="outline" onClick={() => copy(res.script, "Script copied")}>
            <Copy className="mr-1 h-3 w-3" /> Copy
          </Button>
        )}
      >
        {!res ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Your voice note will appear here — ≤150 words, no brackets, ready to record.
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <Badge variant="outline" className={cn(res.wordCount <= 150 ? "border-success text-success" : "border-destructive text-destructive")}>
                {res.wordCount} words
              </Badge>
              {res.firstName && <Badge variant="outline">First name: {res.firstName}</Badge>}
              {res.market && <Badge variant="outline">{res.market}</Badge>}
            </div>
            <div className="rounded-md bg-surface p-3 leading-relaxed whitespace-pre-wrap">
              {res.script}
            </div>
            {res.personalisationDetail && (
              <div className="text-[11px] text-muted-foreground">
                <span className="uppercase tracking-widest">Anchor:</span> {res.personalisationDetail}
              </div>
            )}
            {res.warnings.length > 0 && (
              <div className="rounded bg-amber-500/10 p-2 text-[11px] text-amber-500">
                ⚠ {res.warnings.join(" · ")}
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ===================== 2. Thread Analyser ===================== */
function ThreadAnalyserTab() {
  const fn = useServerFn(analyzePastedThread);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PastedThreadResult | null>(null);

  const run = async () => {
    if (text.trim().length < 5) return toast.error("Paste a conversation first.");
    setBusy(true); setRes(null);
    try {
      const r = await fn({ data: { threadText: text.trim() } });
      if (r.ok) setRes(r.result);
      else toast.error(r.error);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Paste the conversation / VN transcript">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Format: prefix lines with "Me:" or "Them:" — or paste a raw VN transcript.\n\nExample:\nMe: Hey John, figured I'd send a quick voice note...\nThem: Yeah man, sounds interesting — what do you guys actually do?\nMe: ...`}
          className="min-h-[260px] text-xs font-mono"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
            Analyse
          </Button>
        </div>
      </Section>

      <Section title="Next move">
        {!res ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Verdict, flags, and the exact next message will appear here.
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="rounded-md border border-primary/40 bg-primary/5 p-2 font-medium">
              {res.verdictLine}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">Stage: {res.stage}</Badge>
              {res.objection !== "none" && <Badge variant="outline" className="border-amber-500 text-amber-500">Objection: {res.objection}</Badge>}
              <Badge variant="outline">Conf {Math.round(res.confidence * 100)}%</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-success">Green flags</div>
                <ul className="list-inside list-disc">{res.greenFlags.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-destructive">Red flags</div>
                <ul className="list-inside list-disc">{res.redFlags.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            </div>
            <div className="rounded bg-surface p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Next move</div>
              <div>{res.nextMove}</div>
            </div>
            {res.draftMessage && (
              <div className="rounded-md bg-surface p-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ready to send</div>
                  <Button size="sm" variant="ghost" onClick={() => copy(res.draftMessage, "Draft copied")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="whitespace-pre-wrap text-sm">{res.draftMessage}</div>
              </div>
            )}
            <div className="text-[11px] text-muted-foreground italic">{res.reasoning}</div>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ===================== 3. Objection Library ===================== */
function ObjectionsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {OBJECTIONS.map((o) => (
        <Section
          key={o.id}
          title={o.label}
          action={
            <Button size="sm" variant="ghost" onClick={() => copy(o.response, `${o.label} copied`)}>
              <Copy className="h-3 w-3" />
            </Button>
          }
        >
          <div className="space-y-2 text-sm">
            <div className="text-xs italic text-muted-foreground">{o.trigger}</div>
            <div className="rounded-md bg-surface p-3 leading-relaxed">{o.response}</div>
          </div>
        </Section>
      ))}
    </div>
  );
}

/* ===================== 4. Pre-Screen Assistant ===================== */
function PreScreenTab() {
  const [dm, setDm] = useState(0);
  const [offer, setOffer] = useState(0);
  const [earning, setEarning] = useState(0);
  const [wants, setWants] = useState(0);
  const [tier, setTier] = useState<"DIY" | "DWY" | "DFY" | "unknown">("DWY");
  const [hasObj, setHasObj] = useState(false);

  const rec = recommendPreScreen({
    qualifiers: { decisionMaker: dm, hasOffer: offer, earningSomething: earning, wantsMore: wants },
    predictedTier: tier,
    hasObjection: hasObj,
  });

  const Pill = ({ v, setV, label }: { v: number; setV: (n: number) => void; label: string }) => (
    <div className="rounded-md border border-border p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex gap-1">
        {[
          { v: 1, l: "Yes" },
          { v: 0, l: "No" },
          { v: -1, l: "?" },
        ].map((b) => (
          <button
            key={b.v}
            onClick={() => setV(b.v)}
            className={cn(
              "rounded px-2 py-1 text-xs",
              v === b.v ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground",
            )}
          >
            {b.l}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Section title="Decide: pre-screen or skip straight to calendar?">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Pill v={dm} setV={setDm} label="Decision maker" />
          <Pill v={offer} setV={setOffer} label="Has offer" />
          <Pill v={earning} setV={setEarning} label="Earning already" />
          <Pill v={wants} setV={setWants} label="Wants more" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Tier:</span>
            {(["DIY", "DWY", "DFY", "unknown"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  "rounded px-2 py-1",
                  tier === t ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hasObj} onChange={(e) => setHasObj(e.target.checked)} />
            Live objection on the table
          </label>
        </div>

        <div
          className={cn(
            "mt-4 rounded-md border p-3 text-sm",
            rec.decision === "skip_to_calendar" && "border-success/40 bg-success/5 text-success",
            rec.decision === "use_prescreen" && "border-primary/40 bg-primary/5",
            rec.decision === "more_qualifying" && "border-amber-500/40 bg-amber-500/5 text-amber-500",
          )}
        >
          <div className="font-medium">
            {rec.decision === "skip_to_calendar" && "✅ Skip pre-screen — send calendar link"}
            {rec.decision === "use_prescreen" && "📞 Use the 5-min pre-screen"}
            {rec.decision === "more_qualifying" && "⏳ Keep qualifying — not call-ready"}
          </div>
          <div className="mt-1 text-xs">{rec.reason}</div>
        </div>
      </Section>

      <Section
        title="Pre-screen script (5 min)"
        action={<Button size="sm" variant="outline" onClick={() => copy(PRESCREEN_SCRIPT, "Pre-screen copied")}><Copy className="mr-1 h-3 w-3" /> Copy</Button>}
      >
        <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{PRESCREEN_SCRIPT}</pre>
      </Section>

      <Section
        title="Skip-to-calendar message"
        action={<Button size="sm" variant="outline" onClick={() => copy(SKIP_TO_CALENDAR_SCRIPT, "Calendar message copied")}><Copy className="mr-1 h-3 w-3" /> Copy</Button>}
      >
        <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{SKIP_TO_CALENDAR_SCRIPT}</pre>
      </Section>
    </div>
  );
}

/* ===================== 5. Warm Signal ===================== */
function WarmSignalTab() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const start = (id: string) => {
    setActiveId(id);
    setSecondsLeft(60);
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(iv); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-500 flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Warm signals (likes, comments, follows, story replies) decay fast. Tap a signal type the
          moment it lands — you have <span className="font-semibold">60 seconds</span> to reply
          before the iron cools.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {WARM_SIGNALS.map((w) => {
          const isActive = activeId === w.id;
          return (
            <Section
              key={w.id}
              title={w.label}
              action={
                isActive && secondsLeft > 0 ? (
                  <Badge variant="outline" className="border-amber-500 text-amber-500 gap-1">
                    <Clock className="h-3 w-3" /> {secondsLeft}s
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => start(w.id)}>
                    Got one — start 60s
                  </Button>
                )
              }
            >
              <div className="space-y-2 text-sm">
                <div className="text-xs italic text-muted-foreground">{w.trigger}</div>
                <div className="rounded-md bg-surface p-3 leading-relaxed">{w.script}</div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => copy(w.script, "Script copied")}>
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
              </div>
            </Section>
          );
        })}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  BTF_NON_NEGOTIABLES,
  CLIENT_COUNT,
  OFFER_TIERS,
  COMMISSION_RULES,
  PRIORITY_MARKETS,
  ICP_GREEN_FLAGS,
  ICP_RED_FLAGS,
  BUYING_SIGNALS_PROFILE,
  BUYING_SIGNALS_CONTENT,
  BUYING_SIGNALS_PAIN,
  KEYWORDS_TITLES,
  KEYWORDS_PAIN,
  DAILY_RHYTHM,
  LINKEDIN_RAMP,
  LINKEDIN_SEQUENCE,
  MASTER_VN1_SCRIPT,
  VN2_FOLLOWUP_SCRIPT,
  DAY12_FINAL_TEXT,
  EXAMPLE_VN_IRA,
  VN_SCRIPT_STRUCTURE,
  WHY_EACH_LINE_WORKS,
  TONE_MATCHING_RULES,
  AI_SCRIPT_GENERATOR_PROMPT,
  MARKET_VARIATIONS,
  THREE_PART_FLOW,
  QUALIFY_CHECK,
  LINKEDIN_KPI_TARGETS,
  PRO_TIPS,
  TRACKING_LOG_COLUMNS,
  MARKET_TESTING_RULES,
  OBJECTIONS,
  GHL_CHECKLIST_STEPS,
} from "@/lib/btf/playbook";

export const Route = createFileRoute("/playbook")({
  head: () => ({
    meta: [
      { title: "Playbook — BTF Setter OS" },
      { name: "description", content: "The full BTF Setter Hub reference: rules, scripts, sequences, market variations, KPI targets, and the AI script generator prompt." },
    ],
  }),
  component: PlaybookPage,
});

const copy = (text: string, label = "Copied") => {
  navigator.clipboard.writeText(text);
  toast.success(label);
};

function CopyBtn({ text, label }: { text: string; label?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => copy(text, label ?? "Copied")}>
      <Copy className="mr-1 h-3 w-3" /> Copy
    </Button>
  );
}

function PlaybookPage() {
  return (
    <>
      <PageHeader title="Playbook" subtitle="The full BTF Setter Hub — verbatim from JPM Media." />
      <PageBody>
        <Tabs defaultValue="rules">
          <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex h-auto w-max gap-1 p-1">
              <TabsTrigger value="rules" className="whitespace-nowrap">Non-Negotiables</TabsTrigger>
              <TabsTrigger value="offer" className="whitespace-nowrap">Offer & Commission</TabsTrigger>
              <TabsTrigger value="icp" className="whitespace-nowrap">ICP & Signals</TabsTrigger>
              <TabsTrigger value="rhythm" className="whitespace-nowrap">Daily Rhythm</TabsTrigger>
              <TabsTrigger value="sequence" className="whitespace-nowrap">LinkedIn Sequence</TabsTrigger>
              <TabsTrigger value="scripts" className="whitespace-nowrap">Scripts</TabsTrigger>
              <TabsTrigger value="ai" className="whitespace-nowrap">AI Generator</TabsTrigger>
              <TabsTrigger value="markets" className="whitespace-nowrap">Market Variations</TabsTrigger>
              <TabsTrigger value="call" className="whitespace-nowrap">On The Call</TabsTrigger>
              <TabsTrigger value="objections" className="whitespace-nowrap">Objections</TabsTrigger>
              <TabsTrigger value="kpi" className="whitespace-nowrap">KPI Targets</TabsTrigger>
              <TabsTrigger value="ghl" className="whitespace-nowrap">GHL Claim</TabsTrigger>
            </TabsList>
          </div>

          {/* ---------- Non-negotiables ---------- */}
          <TabsContent value="rules" className="mt-4 space-y-4">
            <Section title={`The rules — client count is always ${CLIENT_COUNT}`}>
              <ul className="space-y-3">
                {BTF_NON_NEGOTIABLES.map((r) => (
                  <li key={r.rule} className="rounded-md border border-border bg-surface p-3">
                    <div className="text-sm font-semibold">{r.rule}</div>
                    <div className="text-xs text-muted-foreground">{r.detail}</div>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Pro tips">
              <ul className="list-inside list-disc space-y-1.5 text-sm">
                {PRO_TIPS.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Section>
          </TabsContent>

          {/* ---------- Offer & Commission ---------- */}
          <TabsContent value="offer" className="mt-4 space-y-4">
            <Section title="Offer tiers & your cut">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    <tr><th className="text-left p-2">Tier</th><th className="text-left p-2">Price</th><th className="text-left p-2">Your cut</th><th className="text-left p-2">Notes</th></tr>
                  </thead>
                  <tbody>
                    {OFFER_TIERS.map((t) => (
                      <tr key={t.tier} className="border-t border-border">
                        <td className="p-2 font-semibold">{t.tier}</td>
                        <td className="p-2 num">${t.price.toLocaleString()}</td>
                        <td className="p-2 num">${t.commissionLow}–${t.commissionHigh}</td>
                        <td className="p-2 text-muted-foreground">{t.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            <Section title="Commission rules">
              <ul className="list-inside list-disc space-y-1.5 text-sm">
                {COMMISSION_RULES.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </Section>
          </TabsContent>

          {/* ---------- ICP ---------- */}
          <TabsContent value="icp" className="mt-4 space-y-4">
            <Section title="Priority markets (best reply rates)">
              <div className="flex flex-wrap gap-2">
                {PRIORITY_MARKETS.map((m) => <Badge key={m} className="bg-primary/15 text-primary">★ {m}</Badge>)}
              </div>
            </Section>
            <div className="grid gap-3 md:grid-cols-2">
              <Section title="✅ Green flags — target">
                <ul className="list-inside list-disc space-y-1 text-sm">{ICP_GREEN_FLAGS.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </Section>
              <Section title="❌ Red flags — avoid">
                <ul className="list-inside list-disc space-y-1 text-sm">{ICP_RED_FLAGS.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </Section>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Section title="Profile signals">
                <ul className="list-inside list-disc space-y-1 text-sm">{BUYING_SIGNALS_PROFILE.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </Section>
              <Section title="Content signals">
                <ul className="list-inside list-disc space-y-1 text-sm">{BUYING_SIGNALS_CONTENT.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </Section>
              <Section title="Pain signals">
                <ul className="list-inside list-disc space-y-1 text-sm">{BUYING_SIGNALS_PAIN.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </Section>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Section title="Keywords — titles / bio">
                <div className="flex flex-wrap gap-1.5 text-xs">{KEYWORDS_TITLES.map((k) => <Badge key={k} variant="outline">{k}</Badge>)}</div>
              </Section>
              <Section title="Keywords — pain">
                <div className="flex flex-wrap gap-1.5 text-xs">{KEYWORDS_PAIN.map((k) => <Badge key={k} variant="outline">{k}</Badge>)}</div>
              </Section>
            </div>
          </TabsContent>

          {/* ---------- Daily Rhythm ---------- */}
          <TabsContent value="rhythm" className="mt-4 space-y-3">
            {DAILY_RHYTHM.map((b) => (
              <Section key={b.block} title={`${b.block}${b.minutes ? ` · ${b.minutes}` : ""}`}>
                <ul className="list-inside list-disc space-y-1 text-sm">{b.items.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
              </Section>
            ))}
          </TabsContent>

          {/* ---------- Sequence ---------- */}
          <TabsContent value="sequence" className="mt-4 space-y-4">
            <Section title="Account limits & ramp">
              <ul className="space-y-2">
                {LINKEDIN_RAMP.map((r) => (
                  <li key={r.phase} className="rounded border border-border p-2 text-sm">
                    <span className="font-semibold">{r.phase}:</span> <span className="text-muted-foreground">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="The full sequence">
              <div className="space-y-2">
                {LINKEDIN_SEQUENCE.map((s) => (
                  <div key={s.day} className="rounded border border-border p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{s.day}</Badge>
                      <span className="font-semibold">{s.action}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Tone matching">
              <ul className="space-y-1.5 text-sm">
                {TONE_MATCHING_RULES.map((t) => (
                  <li key={t.trigger} className="rounded border border-border p-2">
                    <span className="font-semibold">{t.trigger}:</span> <span className="text-muted-foreground">{t.response}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </TabsContent>

          {/* ---------- Scripts ---------- */}
          <TabsContent value="scripts" className="mt-4 space-y-4">
            <Section title="🎤 Master Voice Note #1 — verbatim" action={<CopyBtn text={MASTER_VN1_SCRIPT} label="Master VN copied" />}>
              <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{MASTER_VN1_SCRIPT}</pre>
            </Section>
            <Section title="Day 7 follow-up (VN #2)" action={<CopyBtn text={VN2_FOLLOWUP_SCRIPT} label="VN2 copied" />}>
              <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{VN2_FOLLOWUP_SCRIPT}</pre>
            </Section>
            <Section title="Day 12 final text" action={<CopyBtn text={DAY12_FINAL_TEXT} label="Day 12 copied" />}>
              <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{DAY12_FINAL_TEXT}</pre>
            </Section>
            <Section title="VN script structure">
              <ul className="space-y-1.5 text-sm">
                {VN_SCRIPT_STRUCTURE.map((s) => (
                  <li key={s.step} className="rounded border border-border p-2">
                    <div className="font-semibold">{s.step}</div>
                    <div className="text-xs text-muted-foreground">{s.text}</div>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Why each line works">
              <ul className="space-y-2 text-sm">
                {WHY_EACH_LINE_WORKS.map((w) => (
                  <li key={w.line} className="rounded border border-border p-2">
                    <div className="font-semibold">{w.line}</div>
                    <div className="text-xs text-muted-foreground">{w.reason}</div>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Example — Ira Bodnar (118 words)" action={<CopyBtn text={EXAMPLE_VN_IRA} label="Example copied" />}>
              <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{EXAMPLE_VN_IRA}</pre>
            </Section>
          </TabsContent>

          {/* ---------- AI Prompt ---------- */}
          <TabsContent value="ai" className="mt-4 space-y-3">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              Paste this prompt into ChatGPT or Gemini, then paste the prospect's full LinkedIn profile copy right after it. The output is word-for-word ready to record.
            </div>
            <Section title="AI Script Generator prompt — verbatim" action={<CopyBtn text={AI_SCRIPT_GENERATOR_PROMPT} label="Prompt copied" />}>
              <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{AI_SCRIPT_GENERATOR_PROMPT}</pre>
            </Section>
          </TabsContent>

          {/* ---------- Market Variations ---------- */}
          <TabsContent value="markets" className="mt-4 space-y-3">
            <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
              {MARKET_TESTING_RULES.join(" · ")}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {MARKET_VARIATIONS.map((m) => (
                <Section key={m.industry} title={m.industry}>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Niche</span><div>{m.niche}</div></div>
                    <div><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Trust line</span><div className="italic">"{m.trustLine}"</div></div>
                    <div><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Pain line</span><div className="italic">"{m.painLine}"</div></div>
                    <div><span className="text-[10px] uppercase tracking-widest text-muted-foreground">VN tip</span><div className="text-muted-foreground">{m.vnTip}</div></div>
                  </div>
                </Section>
              ))}
            </div>
          </TabsContent>

          {/* ---------- On the call ---------- */}
          <TabsContent value="call" className="mt-4 space-y-3">
            <Section title="Qualifying — all 4 must be met">
              <ul className="space-y-1.5 text-sm">
                {QUALIFY_CHECK.map((q) => (
                  <li key={q.id} className="rounded border border-border p-2">
                    <div className="font-semibold">{q.label}</div>
                    <div className="text-xs text-muted-foreground">{q.detail}</div>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="The 3-part conversation flow">
              <ul className="space-y-2 text-sm">
                {THREE_PART_FLOW.map((p) => (
                  <li key={p.part} className="rounded border border-border p-3">
                    <div className="font-semibold">{p.part}</div>
                    <div className="mt-1 whitespace-pre-line text-muted-foreground">{p.body}</div>
                  </li>
                ))}
              </ul>
            </Section>
          </TabsContent>

          {/* ---------- Objections ---------- */}
          <TabsContent value="objections" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {OBJECTIONS.map((o) => (
                <Section key={o.id} title={o.label} action={<CopyBtn text={o.response} label={`${o.label} copied`} />}>
                  <div className="space-y-2 text-sm">
                    <div className="text-xs italic text-muted-foreground">{o.trigger}</div>
                    <div className="rounded-md bg-surface p-3 leading-relaxed">{o.response}</div>
                  </div>
                </Section>
              ))}
            </div>
          </TabsContent>

          {/* ---------- KPI ---------- */}
          <TabsContent value="kpi" className="mt-4 space-y-3">
            <Section title="LinkedIn targets">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    <tr><th className="text-left p-2">Metric</th><th className="text-left p-2">Target</th><th className="text-left p-2">Notes</th></tr>
                  </thead>
                  <tbody>
                    {LINKEDIN_KPI_TARGETS.map((k) => (
                      <tr key={k.metric} className="border-t border-border">
                        <td className="p-2 font-semibold">{k.metric}</td>
                        <td className="p-2 num">{k.target}</td>
                        <td className="p-2 text-muted-foreground">{k.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            <Section title="Daily tracking log columns">
              <div className="flex flex-wrap gap-1.5">
                {TRACKING_LOG_COLUMNS.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Copy these into your Google Sheet or Notion. The "VN or Text" column tracks which format drove the reply.</p>
            </Section>
          </TabsContent>

          {/* ---------- GHL ---------- */}
          <TabsContent value="ghl" className="mt-4">
            <Section title="GHL claim checklist — no claim = no commission">
              <ol className="list-inside list-decimal space-y-1.5 text-sm">
                {GHL_CHECKLIST_STEPS.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </Section>
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

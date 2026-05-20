import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section, StatCard } from "@/components/Page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Copy, Sparkles } from "lucide-react";
import { useStore, todayStr, daysSince } from "@/lib/store";
import { DAILY_TARGETS, WEEKLY_BENCHMARKS, PLATFORMS, platformEmoji, type Platform } from "@/lib/btf/types";
import { chat, AiNotConfiguredError } from "@/lib/ai/client";
import { toast } from "sonner";

export const Route = createFileRoute("/kpi")({
  head: () => ({
    meta: [
      { title: "KPI Tracker — BTF Setter OS" },
      { name: "description", content: "Daily and weekly setter metrics, scripts, and AI reports." },
    ],
  }),
  component: KpiPage,
});

function KpiPage() {
  return (
    <>
      <PageHeader title="KPI Tracker" subtitle="Hit your benchmarks. Track what's working." />
      <PageBody>
        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="eod">EOD</TabsTrigger>
            <TabsTrigger value="eow">EOW</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-4"><TodayTab /></TabsContent>
          <TabsContent value="weekly" className="mt-4"><WeeklyTab /></TabsContent>
          <TabsContent value="scripts" className="mt-4"><ScriptsTab /></TabsContent>
          <TabsContent value="eod" className="mt-4"><ReportTab kind="eod" /></TabsContent>
          <TabsContent value="eow" className="mt-4"><ReportTab kind="eow" /></TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

function TodayTab() {
  const kpiDays = useStore((s) => s.kpiDays);
  const upsert = useStore((s) => s.upsertKpiDay);

  const day = useMemo(() => {
    const date = todayStr();
    return (
      kpiDays.find((entry) => entry.date === date) ?? {
        date,
        vnSent: 0,
        connectionsSent: 0,
        connectionsAccepted: 0,
        replies: 0,
        activeConvos: 0,
        calendarsSent: 0,
        booked: 0,
        shows: 0,
        hours: 0,
        byPlatform: {},
      }
    );
  }, [kpiDays]);

  const set = (patch: Partial<typeof day>) => upsert({ ...day, ...patch, date: todayStr() });
  const replyRate = day.vnSent ? Math.round((day.replies / day.vnSent) * 100) : 0;
  const showRate = day.booked ? Math.round((day.shows / day.booked) * 100) : 0;

  const fields: { key: keyof typeof day; label: string; target?: string }[] = [
    { key: "vnSent", label: "Voice notes sent", target: `Target: LI ${DAILY_TARGETS.vnLinkedIn} / IG ${DAILY_TARGETS.vnInstagram}` },
    { key: "connectionsSent", label: "Connection requests", target: `Target: ${DAILY_TARGETS.connections}` },
    { key: "connectionsAccepted", label: "Connections accepted", target: "Target: 30% acceptance" },
    { key: "replies", label: "Replies received" },
    { key: "activeConvos", label: "Active conversations" },
    { key: "calendarsSent", label: "Calendar links sent" },
    { key: "booked", label: "Calls booked" },
    { key: "shows", label: "Shows" },
    { key: "hours", label: "Hours worked" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Reply rate" value={`${replyRate}%`} accent hint={`Target ${DAILY_TARGETS.replyRate}%`} />
        <StatCard label="Show rate" value={`${showRate}%`} hint={`Target ${DAILY_TARGETS.showRate}%`} />
        <StatCard label="VNs" value={day.vnSent} />
        <StatCard label="Booked" value={day.booked} accent />
      </div>
      <Section title="Log today">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">{f.label}</Label>
              <Input
                type="number"
                min={0}
                value={Number(day[f.key] ?? 0)}
                onChange={(e) => set({ [f.key]: Number(e.target.value) || 0 } as any)}
              />
              {f.target && <div className="text-[10px] text-muted-foreground">{f.target}</div>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function WeeklyTab() {
  const prospects = useStore((s) => s.prospects);
  const counts = useMemo(() => {
    const out: Partial<Record<Platform, number>> = {};
    prospects.forEach((p) => {
      if ((p.stage === "Call Booked" || p.stage === "Closed") && daysSince(p.stageEnteredAt) <= 7) {
        out[p.platform] = (out[p.platform] ?? 0) + 1;
      }
    });
    return out;
  }, [prospects]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const target = Object.values(WEEKLY_BENCHMARKS).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Calls this week" value={total} accent />
        <StatCard label="Weekly target" value={target} />
        <StatCard label="To goal" value={Math.max(0, target - total)} />
      </div>
      <Section title="Per-platform vs benchmark">
        <div className="space-y-3">
          {PLATFORMS.filter((p) => p.value !== "tiktok").map((p) => {
            const got = counts[p.value] ?? 0;
            const tgt = WEEKLY_BENCHMARKS[p.value];
            const pct = tgt > 0 ? Math.min(100, (got / tgt) * 100) : 0;
            return (
              <div key={p.value}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{p.emoji} {p.label}</span>
                  <span className="num text-xs text-muted-foreground">{got}/{tgt}</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function ScriptsTab() {
  const scripts = useStore((s) => s.scripts);
  const add = useStore((s) => s.addScript);
  const [variation, setVariation] = useState("");
  const [market, setMarket] = useState("");
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [replied, setReplied] = useState(false);
  const [booked, setBooked] = useState(false);

  const byVar = useMemo(() => {
    const m: Record<string, { sent: number; replied: number; booked: number }> = {};
    scripts.forEach((s) => {
      const k = `${s.variation} · ${s.platform}`;
      m[k] ||= { sent: 0, replied: 0, booked: 0 };
      m[k].sent++;
      if (s.replied) m[k].replied++;
      if (s.booked) m[k].booked++;
    });
    return m;
  }, [scripts]);

  return (
    <div className="space-y-4">
      <Section title="Log script use">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Input placeholder="Variation / hook" value={variation} onChange={(e) => setVariation(e.target.value)} className="lg:col-span-2" />
          <Input placeholder="Market" value={market} onChange={(e) => setMarket(e.target.value)} />
          <Input placeholder="Niche" value={niche} onChange={(e) => setNiche(e.target.value)} />
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.emoji} {p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <Checkbox checked={replied} onCheckedChange={(v) => setReplied(!!v)} /> Replied
            </label>
            <label className="flex items-center gap-1.5">
              <Checkbox checked={booked} onCheckedChange={(v) => setBooked(!!v)} /> Booked
            </label>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => {
            if (!variation) return;
            add({ date: new Date().toISOString(), variation, market, niche, platform, replied, booked });
            setVariation(""); setMarket(""); setNiche(""); setReplied(false); setBooked(false);
          }}>Log</Button>
        </div>
      </Section>

      <Section title="What's working">
        {Object.keys(byVar).length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No scripts logged yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr><th className="py-2">Variation</th><th>Sent</th><th>Reply %</th><th>Book %</th></tr>
            </thead>
            <tbody className="num">
              {Object.entries(byVar).map(([k, v]) => (
                <tr key={k} className="border-t border-border">
                  <td className="py-2 font-sans">{k}</td>
                  <td>{v.sent}</td>
                  <td>{Math.round((v.replied / v.sent) * 100)}%</td>
                  <td>{Math.round((v.booked / v.sent) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function ReportTab({ kind }: { kind: "eod" | "eow" }) {
  const settings = useStore((s) => s.settings);
  const kpiDays = useStore((s) => s.kpiDays);
  const prospects = useStore((s) => s.prospects);
  const commissions = useStore((s) => s.commissions);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  const day = useMemo(() => {
    const date = todayStr();
    return (
      kpiDays.find((entry) => entry.date === date) ?? {
        date,
        vnSent: 0,
        connectionsSent: 0,
        connectionsAccepted: 0,
        replies: 0,
        activeConvos: 0,
        calendarsSent: 0,
        booked: 0,
        shows: 0,
        hours: 0,
        byPlatform: {},
      }
    );
  }, [kpiDays]);

  const generate = async () => {
    setBusy(true);
    try {
      const week = kpiDays
        .filter((k) => daysSince(k.date) <= 7)
        .reduce(
          (a, k) => ({
            vnSent: a.vnSent + k.vnSent,
            replies: a.replies + k.replies,
            booked: a.booked + k.booked,
            shows: a.shows + k.shows,
          }),
          { vnSent: 0, replies: 0, booked: 0, shows: 0 },
        );
      const pipeline = `Active prospects by stage:\n${
        Array.from(new Set(prospects.map((p) => p.stage)))
          .map((s) => `- ${s}: ${prospects.filter((p) => p.stage === s).length}`)
          .join("\n")
      }`;
      const promptUser =
        kind === "eod"
          ? `Today's data:\nVNs sent: ${day.vnSent}\nReplies: ${day.replies}\nBooked: ${day.booked}\nShows: ${day.shows}\nActive convos: ${day.activeConvos}\n\n${pipeline}\n\nWrite an EOD report (markdown). Sections: Today's numbers, Reply rate analysis, Patterns noticed, Tomorrow's priorities. Keep tactical.`
          : `Last 7 days:\nVNs: ${week.vnSent}, Replies: ${week.replies}, Booked: ${week.booked}, Shows: ${week.shows}\n\n${pipeline}\n\nWrite an EOW report (markdown). Sections: Wins, Challenges, Patterns by niche/platform, Ideas for next week.`;
      const text = await chat(settings, [{ role: "user", content: promptUser }]);
      setOut(text);
    } catch (e) {
      toast.error(e instanceof AiNotConfiguredError ? e.message : `AI error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title={kind === "eod" ? "EOD report" : "EOW report"}
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
            Generate
          </Button>
          {out && (
            <Button size="sm" variant="outline" onClick={() => {
              navigator.clipboard.writeText(out);
              toast.success("Copied");
            }}>
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
          )}
        </div>
      }
    >
      {out ? (
        <pre className="whitespace-pre-wrap rounded-md bg-surface p-4 text-sm leading-relaxed">{out}</pre>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Generate an AI {kind.toUpperCase()} report from today's KPIs and your pipeline.
        </div>
      )}
    </Section>
  );
}

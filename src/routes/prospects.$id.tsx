import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Trash2, Sparkles, Loader2 } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  STAGES,
  SIGNAL_LABELS,
  platformEmoji,
  type Stage,
  type BuyingSignals,
  type ActivityType,
  type ReplyType,
} from "@/lib/btf/types";
import { useStore, daysSince, todayStr } from "@/lib/store";
import { chat, chatJson, AiNotConfiguredError } from "@/lib/ai/client";
import { toast } from "sonner";

export const Route = createFileRoute("/prospects/$id")({
  head: () => ({
    meta: [
      { title: "Prospect — BTF Setter OS" },
    ],
  }),
  component: ProspectDetail,
});

function ProspectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const prospect = useStore((s) => s.prospects.find((p) => p.id === id));
  const moveStage = useStore((s) => s.moveStage);
  const setSignals = useStore((s) => s.setSignals);
  const setBant = useStore((s) => s.setBant);
  const setQualScore = useStore((s) => s.setQualScore);
  const logActivity = useStore((s) => s.logActivity);
  const logVN = useStore((s) => s.logVN);
  const deleteProspect = useStore((s) => s.deleteProspect);
  const settings = useStore((s) => s.settings);

  const [actType, setActType] = useState<ActivityType>("VN");
  const [actNote, setActNote] = useState("");
  const [vnVar, setVnVar] = useState("");
  const [vnReply, setVnReply] = useState<ReplyType>("none");
  const [aiAction, setAiAction] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);

  const stageDays = useMemo(
    () => (prospect ? daysSince(prospect.stageEnteredAt) : 0),
    [prospect],
  );

  if (!prospect) {
    return (
      <PageBody>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p>Prospect not found.</p>
          <Button asChild variant="link"><Link to="/prospects">Back to prospects</Link></Button>
        </div>
      </PageBody>
    );
  }

  const runAi = async (kind: "next" | "reply" | "score") => {
    setAiBusy(true);
    setAiAction("");
    try {
      const ctx = `Prospect: ${prospect.name}
Platform: ${prospect.platform}
Niche: ${prospect.niche}
Stage: ${prospect.stage} (${stageDays}d in stage)
Lead type: ${prospect.leadType}
Target tier: ${prospect.tier}
Bio: ${prospect.bio}
Buying signals: ${Object.entries(prospect.signals).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}
Recent activities:
${prospect.activities.slice(0, 5).map((a) => `- ${a.date.slice(0, 10)} ${a.type}: ${a.notes}`).join("\n") || "(none)"}`;

      if (kind === "next") {
        const out = await chat(settings, [{ role: "user", content: `${ctx}\n\nGive the exact next action and 2–3 talking points. Keep it under 120 words.` }]);
        setAiAction(out);
      } else if (kind === "reply") {
        const last = prospect.activities[0]?.notes || "(no recent message)";
        const out = await chat(settings, [{ role: "user", content: `${ctx}\n\nLast message from prospect: "${last}"\n\nWrite a paste-ready reply. Match their format. End with one question.` }]);
        setAiAction(out);
      } else {
        const out = await chatJson<{
          bant: { need: number; timeline: number; authority: number; budget: number };
          score: number;
          tier: "DIY" | "DWY" | "DFY";
          reasoning: string;
        }>(settings, [{
          role: "user",
          content: `${ctx}\n\nScore this prospect using BANT in BTF order (need, timeline, authority, budget) each 0–2. Recommend tier (DIY/DWY/DFY). Return JSON: {bant:{need,timeline,authority,budget}, score:0-100, tier, reasoning}.`,
        }]);
        setBant(prospect.id, out.bant as any);
        setQualScore(prospect.id, out.score);
        setAiAction(`Score: ${out.score}/100 · Tier: ${out.tier}\n\n${out.reasoning}`);
      }
    } catch (e) {
      toast.error(e instanceof AiNotConfiguredError ? e.message : `AI error: ${(e as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={prospect.name}
        subtitle={`${platformEmoji(prospect.platform)} ${prospect.niche || "—"} · ${prospect.leadType}`}
      >
        <Button variant="ghost" size="sm" asChild>
          <Link to="/prospects"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
        {prospect.profileUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={prospect.profileUrl} target="_blank" rel="noreferrer">
              Profile <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm("Delete this prospect?")) {
              deleteProspect(prospect.id);
              navigate({ to: "/prospects" });
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </PageHeader>

      <PageBody className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section
            title="AI Co-pilot"
            action={
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runAi("next")}>
                  {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Next action
                </Button>
                <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runAi("reply")}>
                  Reply
                </Button>
                <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runAi("score")}>
                  Score
                </Button>
              </div>
            }
          >
            {aiAction ? (
              <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{aiAction}</pre>
            ) : (
              <div className="text-sm text-muted-foreground">Ask the co-pilot for the next move, a reply, or a fresh BANT score.</div>
            )}
          </Section>

          <Section title="Activity log">
            <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
              <Select value={actType} onValueChange={(v) => setActType(v as ActivityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["VN", "text", "email", "comment", "like", "call", "note"] as ActivityType[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={actNote} onChange={(e) => setActNote(e.target.value)} placeholder="Notes (paste their message, etc.)" />
              <Button onClick={() => {
                if (!actNote) return;
                logActivity(prospect.id, { date: new Date().toISOString(), type: actType, notes: actNote });
                setActNote("");
              }}>Log</Button>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {prospect.activities.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">No activity yet.</li>
              )}
              {prospect.activities.map((a) => (
                <li key={a.id} className="flex gap-3 py-2 text-sm">
                  <Badge variant="outline" className="h-fit text-[10px]">{a.type}</Badge>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground num">{a.date.slice(0, 10)}</div>
                    <div>{a.notes}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Voice notes">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
              <Input value={vnVar} onChange={(e) => setVnVar(e.target.value)} placeholder="Variation / hook used" />
              <Select value={vnReply} onValueChange={(v) => setVnReply(v as ReplyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reply</SelectItem>
                  <SelectItem value="text">Text back</SelectItem>
                  <SelectItem value="VN">VN back</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => {
                if (!vnVar) return;
                logVN(prospect.id, { date: new Date().toISOString(), variation: vnVar, reply: vnReply });
                setVnVar("");
                setVnReply("none");
              }}>Log VN</Button>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {prospect.vnLog.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">No VNs logged.</li>
              )}
              {prospect.vnLog.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="num text-xs text-muted-foreground">{v.date.slice(0, 10)}</span>
                  <span className="flex-1 truncate">{v.variation}</span>
                  <Badge variant={v.reply === "none" ? "outline" : "secondary"}>{v.reply}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Stage">
            <Select value={prospect.stage} onValueChange={(v) => moveStage(prospect.id, v as Stage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="mt-2 text-xs text-muted-foreground num">{stageDays}d in stage</div>
          </Section>

          <Section title="Qualification">
            <div className="space-y-3">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="uppercase tracking-widest text-muted-foreground">Score</span>
                  <span className="num font-display font-bold text-primary">{prospect.qualScore}/100</span>
                </div>
                <Slider
                  value={[prospect.qualScore]}
                  max={100}
                  step={5}
                  onValueChange={(v) => setQualScore(prospect.id, v[0])}
                />
              </div>
              {(["need", "timeline", "authority", "budget"] as const).map((k) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{k}</span>
                  <Select
                    value={String(prospect.bant[k])}
                    onValueChange={(v) => setBant(prospect.id, { ...prospect.bant, [k]: Number(v) as 0 | 1 | 2 })}
                  >
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Buying signals">
            <div className="space-y-2">
              {(Object.keys(SIGNAL_LABELS) as (keyof BuyingSignals)[]).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={prospect.signals[k]}
                    onCheckedChange={(v) => setSignals(prospect.id, { ...prospect.signals, [k]: !!v })}
                  />
                  {SIGNAL_LABELS[k]}
                </label>
              ))}
            </div>
          </Section>

          <Section title="Bio">
            <Textarea
              value={prospect.bio}
              readOnly
              rows={5}
              placeholder="No bio notes."
              className="resize-none"
            />
            <div className="mt-2 text-xs text-muted-foreground num">
              Last touch: {daysSince(prospect.lastTouchAt)}d ago · Created {prospect.createdAt.slice(0, 10)} · Today {todayStr()}
            </div>
          </Section>
        </div>
      </PageBody>
    </>
  );
}

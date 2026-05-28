import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Sparkles,
  Loader2,
  Pencil,
  Mic,
  Copy,
  ArrowRight,
} from "lucide-react";
import { ProspectDrawer } from "@/components/ProspectDrawer";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ConversationLog, buildConversation } from "@/components/ConversationLog";
import { ProspectAnalyserHistory } from "@/components/ProspectAnalyserHistory";
import { ProspectCoachChat } from "@/components/ProspectCoachChat";
import { ProfileQualifierBox } from "@/components/linkedin/ProfileQualifierBox";
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
import { nextMoveFromConversation, type NextMoveResult } from "@/lib/ai/aiAssistants.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/prospects/$id")({
  head: () => ({
    meta: [{ title: "Prospect — BTF Setter OS" }],
  }),
  component: ProspectDetail,
});

const ACTIVITY_TYPES: ActivityType[] = ["VN", "text", "email", "comment", "like", "call", "note"];

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
  const updateProspect = useStore((s) => s.updateProspect);
  const addProspectAnalysis = useStore((s) => s.addProspectAnalysis);
  const settings = useStore((s) => s.settings);

  // Composer state
  const [msgDirection, setMsgDirection] = useState<"them" | "me">("them");
  const [msgType, setMsgType] = useState<ActivityType>("text");
  const [msgText, setMsgText] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Legacy composers (kept for backwards compatibility)
  const [actType, setActType] = useState<ActivityType>("VN");
  const [actNote, setActNote] = useState("");
  const [vnVar, setVnVar] = useState("");
  const [vnReply, setVnReply] = useState<ReplyType>("none");

  // AI co-pilot state
  const [coPilotResult, setCoPilotResult] = useState<NextMoveResult | null>(null);
  const [aiAction, setAiAction] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Sticky notes — debounced auto-save to prospect.notes.
  const [notesDraft, setNotesDraft] = useState(prospect?.notes ?? "");
  const notesInitRef = useRef(false);
  useEffect(() => {
    if (!prospect) return;
    if (!notesInitRef.current) {
      setNotesDraft(prospect.notes ?? "");
      notesInitRef.current = true;
    }
  }, [prospect]);
  useEffect(() => {
    if (!prospect) return;
    if (notesDraft === (prospect.notes ?? "")) return;
    const t = setTimeout(() => {
      updateProspect(prospect.id, { notes: notesDraft });
    }, 500);
    return () => clearTimeout(t);
  }, [notesDraft, prospect, updateProspect]);

  const callNextMove = useServerFn(nextMoveFromConversation);

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

  const saveMessage = () => {
    const text = msgText.trim();
    if (!text) return;
    const date = new Date().toISOString();
    const fromMe = msgDirection === "me";
    logActivity(prospect.id, { date, type: msgType, notes: text, fromMe });
    if (msgType === "VN" && fromMe) {
      logVN(prospect.id, { date, variation: text.slice(0, 80), reply: "none" });
    }
    setMsgText("");
    toast.success(fromMe ? "Logged your message" : "Logged their message");
  };

  const handleTranscribe = async (file: File) => {
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("You must be signed in to transcribe.");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json()) as { ok: boolean; text?: string; error?: string };
      if (!json.ok) throw new Error(json.error || "Transcription failed");
      setMsgType("VN");
      setMsgText((prev) => (prev ? `${prev}\n\n${json.text ?? ""}` : (json.text ?? "")));
      toast.success("Transcribed");
    } catch (e) {
      toast.error(`Transcribe failed: ${(e as Error).message}`);
    } finally {
      setTranscribing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runCoPilot = async () => {
    setAiBusy(true);
    setCoPilotResult(null);
    try {
      const conv = buildConversation(prospect.activities, prospect.vnLog);
      const signals = Object.entries(prospect.signals)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await callNextMove({
        data: {
          prospectName: prospect.name,
          platform: prospect.platform,
          niche: prospect.niche,
          stage: prospect.stage,
          tier: prospect.tier,
          bio: prospect.bio,
          signals,
          messages: conv.map((m) => ({
            fromMe: m.fromMe,
            type: m.type,
            date: m.date,
            text: m.text,
          })),
        },
      });
      if (!res.ok) throw new Error(res.error);
      setCoPilotResult(res.result);
      // Sync AI's re-scoring into the prospect so it shows up on the prospects
      // list, drawer, pipeline, etc. User-driven action (button click) so it
      // does not violate the no-automation rule.
      setBant(prospect.id, res.result.bantSuggestion as typeof prospect.bant);
      setQualScore(prospect.id, res.result.qualScoreSuggestion);
      addProspectAnalysis(prospect.id, {
        stageAtTime: prospect.stage,
        verdictLine: res.result.verdictLine,
        suggestedStage: res.result.stage,
        nextMove: res.result.nextMove,
        draftMessage: res.result.draftMessage,
        suggestedActivityType: res.result.suggestedActivityType,
        reasoning: res.result.reasoning,
        confidence: res.result.confidence,
      });
    } catch (e) {
      toast.error(`AI error: ${(e as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const runLegacyAi = async (kind: "reply" | "score") => {
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
${prospect.activities.slice(0, 5).map((a) => `- ${a.date.slice(0, 10)} ${a.fromMe === false ? "THEM" : "ME"} ${a.type}: ${a.notes}`).join("\n") || "(none)"}`;
      if (kind === "reply") {
        const last = prospect.activities.find((a) => a.fromMe === false)?.notes || prospect.activities[0]?.notes || "(no recent message)";
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

  const useDraftAsMessage = () => {
    if (!coPilotResult?.draftMessage) return;
    setMsgDirection("me");
    const t = coPilotResult.suggestedActivityType?.toLowerCase();
    if (t && (ACTIVITY_TYPES as string[]).includes(t)) {
      setMsgType(t as ActivityType);
    }
    setMsgText(coPilotResult.draftMessage);
    toast.message("Loaded into composer", { description: "Review and hit Log to record it." });
  };

  const replyableStages: Stage[] = ["Found", "Connected", "VN1 Sent", "VN2 Sent"];
  const showReplyChip =
    msgDirection === "them" && replyableStages.includes(prospect.stage);

  return (
    <>
      <PageHeader
        title={prospect.name}
        subtitle={`${platformEmoji(prospect.platform)} ${prospect.niche || "—"} · ${prospect.leadType} · Added ${new Date(prospect.createdAt).toLocaleDateString()}`}
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
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1 h-4 w-4" /> Edit
        </Button>
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
          <Section title="Sticky notes" action={<span className="text-[10px] uppercase tracking-widest text-muted-foreground">Auto-saves</span>}>
            <Textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Quick thoughts that don't fit the activity log — e.g. mentioned rebrand, follow up in 3 weeks."
              className="resize-none bg-amber-400/5"
            />
          </Section>

          <Section title="Conversation">
            <ConversationLog activities={prospect.activities} vnLog={prospect.vnLog} />

            <div className="mt-4 space-y-2 rounded-md border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs uppercase tracking-widest ${msgDirection === "them" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                    onClick={() => setMsgDirection("them")}
                  >From them</button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs uppercase tracking-widest ${msgDirection === "me" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                    onClick={() => setMsgDirection("me")}
                  >From me</button>
                </div>
                <Select value={msgType} onValueChange={(v) => setMsgType(v as ActivityType)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleTranscribe(f);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={transcribing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {transcribing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mic className="mr-1 h-3 w-3" />}
                  {transcribing ? "Transcribing…" : "Transcribe voice note"}
                </Button>
              </div>
              <Textarea
                rows={3}
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder={msgDirection === "them" ? "Paste what they sent (text or VN transcript)…" : "What you sent / are about to send…"}
              />
              <div className="flex items-center justify-between gap-2">
                {showReplyChip && (
                  <button
                    type="button"
                    className="rounded-full border border-amber-400/60 px-2 py-1 text-[10px] uppercase tracking-widest text-amber-400 hover:bg-amber-400/10"
                    onClick={() => moveStage(prospect.id, "Replied")}
                  >Move to Replied</button>
                )}
                <div className="ml-auto">
                  <Button size="sm" onClick={saveMessage} disabled={!msgText.trim()}>
                    Log message
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="AI Co-pilot"
            action={
              <div className="flex gap-1">
                <Button size="sm" disabled={aiBusy} onClick={runCoPilot}>
                  {aiBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                  What do I send next?
                </Button>
                <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runLegacyAi("reply")}>
                  Quick reply
                </Button>
                <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runLegacyAi("score")}>
                  Score
                </Button>
              </div>
            }
          >
            {coPilotResult ? (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-surface p-3">
                  <div className="mb-1 text-sm font-medium">{coPilotResult.verdictLine}</div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <Badge variant="outline">{prospect.stage} → {coPilotResult.stage}</Badge>
                    <span>conf {Math.round(coPilotResult.confidence * 100)}%</span>
                    <span>·</span>
                    <span>{coPilotResult.suggestedActivityType}</span>
                  </div>
                  <div className="mt-2 text-sm">{coPilotResult.nextMove}</div>
                  {coPilotResult.reasoning && (
                    <div className="mt-2 text-xs text-muted-foreground">{coPilotResult.reasoning}</div>
                  )}
                </div>
                {coPilotResult.draftMessage && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Draft message</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          navigator.clipboard.writeText(coPilotResult.draftMessage);
                          toast.success("Copied");
                        }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={useDraftAsMessage}>
                          <ArrowRight className="mr-1 h-3 w-3" /> Use as my next message
                        </Button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">{coPilotResult.draftMessage}</pre>
                  </div>
                )}
                {coPilotResult.stage && coPilotResult.stage !== prospect.stage && STAGES.includes(coPilotResult.stage as Stage) && (
                  <Button size="sm" variant="outline" onClick={() => moveStage(prospect.id, coPilotResult.stage as Stage)}>
                    Move to {coPilotResult.stage}
                  </Button>
                )}
              </div>
            ) : aiAction ? (
              <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{aiAction}</pre>
            ) : (
              <div className="text-sm text-muted-foreground">
                Hit "What do I send next?" — the co-pilot reads the whole conversation above and writes the next message for you.
              </div>
            )}

            <div className="mt-4 border-t border-border pt-3">
              <ProspectAnalyserHistory prospectId={prospect.id} />
            </div>
          </Section>

          <Section title="Coach chat & follow-up">
            <ProspectCoachChat prospect={prospect} />
          </Section>

          <Section title="Activity log">
            <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
              <Select value={actType} onValueChange={(v) => setActType(v as ActivityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={actNote} onChange={(e) => setActNote(e.target.value)} placeholder="Notes (paste their message, etc.)" />
              <Button onClick={() => {
                if (!actNote) return;
                logActivity(prospect.id, { date: new Date().toISOString(), type: actType, notes: actNote, fromMe: true });
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
                  <Badge variant={a.fromMe === false ? "secondary" : "outline"} className="h-fit text-[10px]">
                    {a.fromMe === false ? "Them" : "Me"}
                  </Badge>
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

      <ProspectDrawer open={editOpen} onOpenChange={setEditOpen} editing={prospect} />
    </>
  );
}

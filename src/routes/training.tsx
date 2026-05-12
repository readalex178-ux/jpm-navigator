import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { SCENARIOS, type Scenario } from "@/lib/ai/btfFramework";
import { useStore } from "@/lib/store";
import { chat, chatJson, AiNotConfiguredError } from "@/lib/ai/client";
import { toast } from "sonner";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Training — BTF Setter OS" },
      { name: "description", content: "BTF roleplay scenarios with AI prospect simulation." },
    ],
  }),
  component: TrainingPage,
});

type Turn = { role: "prospect" | "setter"; text: string };

function TrainingPage() {
  const settings = useStore((s) => s.settings);
  const sessions = useStore((s) => s.training);
  const addTraining = useStore((s) => s.addTraining);
  const updateTraining = useStore((s) => s.updateTraining);

  const [active, setActive] = useState<Scenario | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<{ grade: string; strengths: string[]; improvements: string[]; frameworkScore: number } | null>(null);

  const start = (s: Scenario) => {
    const session = addTraining({ scenarioId: s.id, date: new Date().toISOString(), transcript: [] });
    setActive(s);
    setSessionId(session.id);
    setTranscript([]);
    setGrade(null);
  };

  const send = async () => {
    if (!msg.trim() || !active) return;
    const newTurns: Turn[] = [...transcript, { role: "setter", text: msg.trim() }];
    setTranscript(newTurns);
    setMsg("");
    setBusy(true);
    try {
      const out = await chat(settings, [
        { role: "system", content: `ROLEPLAY MODE. You are the prospect in this BTF scenario: "${active.title}". ${active.promptToProspect} Stay in character. Reply in 1–3 sentences max. Don't break character.` },
        ...newTurns.map((t) => ({ role: t.role === "setter" ? "user" as const : "assistant" as const, content: t.text })),
      ]);
      const next: Turn[] = [...newTurns, { role: "prospect", text: out }];
      setTranscript(next);
      if (sessionId) updateTraining(sessionId, { transcript: next });
    } catch (e) {
      toast.error(e instanceof AiNotConfiguredError ? e.message : `AI error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (!active || transcript.length === 0) return;
    setGrading(true);
    try {
      const out = await chatJson<{
        grade: "A" | "B" | "C" | "D";
        strengths: string[];
        improvements: string[];
        frameworkScore: number;
      }>(settings, [{
        role: "user",
        content: `Grade this BTF setter roleplay. Scenario: ${active.title}. Transcript:\n${transcript.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n")}\n\nReturn JSON: {grade:"A|B|C|D", strengths:[...], improvements:[...], frameworkScore: 0-100}. Score against BTF framework: tone, ends with one question, no pitching, villain frame, format match.`,
      }]);
      setGrade(out);
      if (sessionId) updateTraining(sessionId, { ...out });
    } catch (e) {
      toast.error(e instanceof AiNotConfiguredError ? e.message : `AI error: ${(e as Error).message}`);
    } finally {
      setGrading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Training Mode"
        subtitle="Roleplay BTF scenarios. AI plays the prospect."
      >
        {active && (
          <Button variant="outline" size="sm" onClick={() => { setActive(null); setSessionId(null); setTranscript([]); setGrade(null); }}>
            Exit scenario
          </Button>
        )}
      </PageHeader>

      <PageBody className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Section title="Scenarios">
            <div className="space-y-1">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => start(s)}
                  className={`w-full rounded-md p-2 text-left text-sm hover:bg-surface-elevated ${active?.id === s.id ? "bg-surface-elevated" : ""}`}
                >
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.setup}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Past sessions">
            {sessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sessions yet.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {sessions.slice(0, 8).map((s) => {
                  const sc = SCENARIOS.find((x) => x.id === s.scenarioId);
                  return (
                    <li key={s.id} className="flex items-center justify-between">
                      <span className="truncate">{sc?.title ?? s.scenarioId}</span>
                      {s.grade && <Badge variant="outline" className="text-[10px]">{s.grade}</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        <div>
          {!active ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              Pick a scenario to start.
            </div>
          ) : (
            <Section
              title={active.title}
              action={
                <Button size="sm" variant="outline" onClick={endSession} disabled={grading || transcript.length === 0}>
                  {grading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  End & grade
                </Button>
              }
            >
              <div className="mb-3 rounded-md bg-surface p-3 text-xs text-muted-foreground">{active.setup}</div>
              <div className="space-y-2">
                {transcript.map((t, i) => (
                  <div key={i} className={`flex ${t.role === "setter" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${t.role === "setter" ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>
                      <div className="mb-0.5 text-[10px] uppercase tracking-widest opacity-70">{t.role}</div>
                      {t.text}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-surface-elevated px-3 py-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type your reply as the setter..."
                  disabled={busy}
                />
                <Button onClick={send} disabled={busy || !msg.trim()}>Send</Button>
              </div>

              {grade && (
                <div className="mt-4 rounded-md border border-primary/40 bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-2xl font-bold text-primary">Grade: {grade.grade}</div>
                    <div className="num text-sm text-muted-foreground">Framework: {grade.frameworkScore}/100</div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-widest text-success">Strengths</div>
                      <ul className="list-disc pl-4 text-sm">{grade.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-widest text-primary">Improve</div>
                      <ul className="list-disc pl-4 text-sm">{grade.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>
      </PageBody>
    </>
  );
}

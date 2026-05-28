import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Copy,
  Download,
  Linkedin as LinkedinIcon,
  Loader2,
  Send,
  Sparkles,
  XCircle,
  Save,
} from "lucide-react";
import { useStore, daysSince, todayStr } from "@/lib/store";
import { postToExtension } from "@/lib/extension/bridge";
import { ACTION_META, buildPrompt, type LinkedinAction } from "@/lib/ai/linkedinPrompts";
import { chat, AiNotConfiguredError } from "@/lib/ai/client";
import { useThreadAnalysis } from "@/lib/ai/useThreadAnalysis";
import { AnalyzerStrip } from "@/components/linkedin/AnalyzerStrip";
import { AnalyzerHistoryTimeline } from "@/components/linkedin/AnalyzerHistoryTimeline";
import { InboxTriageDot, InboxTriageVerdict } from "@/components/linkedin/InboxTriageDot";
import { ProfileQualifierBox } from "@/components/linkedin/ProfileQualifierBox";
import { ProspectStateButton } from "@/components/linkedin/ProspectStateButton";
import { TemplatesSheet } from "@/components/linkedin/TemplatesSheet";
import {
  isThreadUnread,
  replyAgeBucket,
  formatReplyAge,
  lastMessageAt,
} from "@/lib/btf/threadStatus";
import type { NextAction } from "@/lib/ai/analyzerSchema";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/linkedin")({
  head: () => ({
    meta: [
      { title: "LinkedIn Co-Pilot — BTF Setter OS" },
      {
        name: "description",
        content:
          "Live LinkedIn conversation co-pilot. AI generates connects, replies, follow-ups, and voice note scripts using the BTF framework.",
      },
    ],
  }),
  component: LinkedInPage,
});

function downloadExtension() {
  fetch("/btf-linkedin-extension.zip")
    .then((res) => {
      if (!res.ok) throw new Error("Download failed");
      return res.blob();
    })
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "btf-linkedin-extension.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(() => toast.error("Could not download extension. Try again."));
}

function LinkedInPage() {
  const settings = useStore((s) => s.settings);
  const threads = useStore((s) => s.linkedinThreads);
  const profiles = useStore((s) => s.linkedinProfiles);
  const prospects = useStore((s) => s.prospects);
  const threadProspectMap = useStore((s) => s.threadProspectMap);
  const pairingCode = useStore((s) => s.pairingCode);
  const extConnected = useStore((s) => s.extensionConnected);
  const linkThread = useStore((s) => s.linkThreadToProspect);
  const addProspect = useStore((s) => s.addProspect);
  const logActivity = useStore((s) => s.logActivity);
  const upsertKpiDay = useStore((s) => s.upsertKpiDay);
  const getKpiDay = useStore((s) => s.getKpiDay);
  const addVnScript = useStore((s) => s.addVnScript);
  const threadReads = useStore((s) => s.linkedinThreadReads);
  const markThreadRead = useStore((s) => s.markThreadRead);
  const markThreadUnread = useStore((s) => s.markThreadUnread);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [action, setAction] = useState<LinkedinAction>("reply");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // Cross-route handoff: /prospects "Analyze" button drops a target in sessionStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("btf:analyze");
    if (!raw) return;
    sessionStorage.removeItem("btf:analyze");
    try {
      const target = JSON.parse(raw) as {
        threadId?: string;
        prospectId?: string;
        profileUrl?: string;
        profileText?: string;
      };
      if (target.threadId) {
        setActiveThreadId(target.threadId);
      } else if (target.profileText) {
        // defer one tick so ProfileQualifierBox is mounted
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("btf:qualify-profile", {
              detail: {
                text: target.profileText,
                profileUrl: target.profileUrl,
                prospectId: target.prospectId,
                autoRun: true,
              },
            }),
          );
        }, 0);
      }
    } catch {
      // ignore malformed handoff
    }
  }, []);

  const threadList = useMemo(() => {
    return Object.values(threads).sort((a, b) => (b.scrapedAt > a.scrapedAt ? 1 : -1));
  }, [threads]);

  const activeThread = activeThreadId ? threads[activeThreadId] : threadList[0];
  const activeProfile = activeThread?.participantProfileUrl
    ? profiles[activeThread.participantProfileUrl]
    : undefined;
  const linkedProspectId = activeThread ? threadProspectMap[activeThread.threadId] : undefined;
  const linkedProspect = linkedProspectId
    ? prospects.find((p) => p.id === linkedProspectId)
    : undefined;

  const {
    analysis,
    loading: analyzing,
    error: analyzeError,
    refresh: refreshAnalysis,
  } = useThreadAnalysis(activeThread?.threadId ?? null);

  // NO AUTO-ADD. Per the no-automation rule (mem://constraints/no-automation),
  // we never silently add prospects or move stages based on AI output.
  // The user must click "Add to pipeline" (rendered elsewhere) to commit.
  const autoLinkedRef = useRef<Set<string>>(new Set());
  void autoLinkedRef;

  const useAnalyzerDraft = (next: NextAction, text: string) => {
    setDraft(text);
    // pre-select the closest Co-Pilot action so manual regenerate matches
    const map: Partial<Record<NextAction, LinkedinAction>> = {
      send_connection: "connect",
      voice_note_1: "vn",
      voice_note_2: "vn",
      text_followup: "followup",
      breakup: "followup",
      objection_response: "objection",
      send_calendar_link: "reply",
      book_call: "reply",
    };
    const mapped = map[next];
    if (mapped) setAction(mapped);
    toast.success("Draft loaded into Co-Pilot. Edit then Insert.");
  };

  const generate = async () => {
    if (!activeThread && action !== "connect") {
      toast.error("Open a LinkedIn conversation first.");
      return;
    }
    setBusy(true);
    setDraft("");
    try {
      const prompt = buildPrompt(action, {
        thread: activeThread,
        profile: activeProfile,
        prospect: linkedProspect,
        daysSinceTouch: linkedProspect ? daysSince(linkedProspect.lastTouchAt) : undefined,
      });
      const out = await chat(settings, [{ role: "user", content: prompt }]);
      setDraft(out.trim());
    } catch (e) {
      toast.error(
        e instanceof AiNotConfiguredError ? e.message : `AI error: ${(e as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const insertIntoLinkedIn = () => {
    if (!draft.trim() || !activeThread) return;
    postToExtension({
      kind: "app:insert",
      pairingCode,
      threadId: activeThread.threadId,
      text: draft.trim(),
    });
    toast.success("Inserted into LinkedIn reply box. Press Send when ready.");
    if (linkedProspectId) {
      logActivity(linkedProspectId, {
        date: new Date().toISOString(),
        type: action === "vn" ? "VN" : action === "connect" ? "comment" : "text",
        notes: draft.trim().slice(0, 280),
      });
      const today = getKpiDay(todayStr());
      const patch =
        action === "vn"
          ? { vnSent: today.vnSent + 1 }
          : action === "connect"
            ? { connectionsSent: today.connectionsSent + 1 }
            : { activeConvos: today.activeConvos + 1 };
      upsertKpiDay({ date: todayStr(), ...patch });
    }
  };

  const copyDraft = () => {
    if (!draft.trim()) return;
    navigator.clipboard.writeText(draft.trim());
    toast.success("Copied to clipboard.");
  };

  const saveAsVnScript = () => {
    if (!draft.trim() || !activeThread) return;
    addVnScript({
      date: new Date().toISOString(),
      prospectId: linkedProspectId,
      prospectName: activeThread.participantName,
      niche: linkedProspect?.niche,
      scenario: ACTION_META[action].label,
      text: draft.trim(),
      used: false,
    });
    toast.success("Saved to script vault.");
  };

  const linkOrCreateProspect = () => {
    if (!activeThread) return;
    const existing = prospects.find(
      (p) =>
        p.name.toLowerCase() === activeThread.participantName.toLowerCase() ||
        (p.profileUrl && activeThread.participantProfileUrl === p.profileUrl),
    );
    if (existing) {
      linkThread(activeThread.threadId, existing.id);
      toast.success(`Linked to ${existing.name}`);
      return;
    }
    const created = addProspect({
      name: activeThread.participantName,
      profileUrl: activeThread.participantProfileUrl ?? "",
      platform: "linkedin",
      bio: activeProfile?.about ?? activeProfile?.headline ?? "",
      stage: "Replied",
    });
    linkThread(activeThread.threadId, created.id);
    toast.success(`Created prospect: ${created.name}`);
  };

  return (
    <>
      <PageHeader
        title="LinkedIn Co-Pilot"
        subtitle="Live conversation mirror. AI suggests next moves on the BTF framework."
      >
        <ExtensionStatus
          connected={extConnected}
          code={pairingCode}
          onDownload={downloadExtension}
        />
      </PageHeader>

      <PageBody className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px] lg:p-4">
        {/* INBOX */}
        <Section title={`Inbox (${threadList.length})`}>
          {threadList.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {extConnected
                ? "Open a LinkedIn message thread in your browser. It will appear here within seconds."
                : "Install the extension and pair it to start mirroring threads."}
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-1 pr-2">
                {threadList.map((t) => {
                  const linked = !!threadProspectMap[t.threadId];
                  const isActive = (activeThread?.threadId ?? threadList[0]?.threadId) === t.threadId;
                  return (
                    <button
                      key={t.threadId}
                      onClick={() => setActiveThreadId(t.threadId)}
                      className={cn(
                        "w-full rounded-md border border-transparent p-2 text-left text-sm hover:bg-surface-elevated",
                        isActive && "border-primary/40 bg-surface-elevated",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <InboxTriageDot threadId={t.threadId} />
                          <span className="truncate font-medium">{t.participantName}</span>
                        </span>
                        {linked && (
                          <Badge variant="outline" className="text-[9px]">
                            linked
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.lastMessagePreview ?? "—"}
                      </div>
                      <InboxTriageVerdict threadId={t.threadId} />
                      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t.messages.length} msg
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </Section>

        {/* CONVERSATION */}
        <Section
          title={activeThread?.participantName ?? "Conversation"}
          action={
            activeThread && (
              <div className="flex items-center gap-2">
                {activeThread.participantProfileUrl && (
                  <Button asChild size="sm" variant="ghost">
                    <a
                      href={activeThread.participantProfileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1"
                    >
                      <LinkedinIcon className="h-3 w-3" />
                      Open
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={linkOrCreateProspect}>
                  {linkedProspect ? "Re-link" : "Link to prospect"}
                </Button>
              </div>
            )
          }
        >
          {!activeThread ? (
            <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Select or open a conversation to see it here.
            </div>
          ) : (
            <>
              <AnalyzerStrip
                analysis={analysis}
                loading={analyzing}
                error={analyzeError}
                onRefresh={refreshAnalysis}
                onUseDraft={useAnalyzerDraft}
              />
              <ProspectStateButton thread={activeThread} prospectStage={linkedProspect?.stage} />
              <AnalyzerHistoryTimeline threadId={activeThread.threadId} />
              {activeProfile && (
                <div className="mb-3 rounded-md bg-surface p-3 text-xs">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Profile context
                  </div>
                  <div className="mt-1 font-medium">{activeProfile.headline ?? "—"}</div>
                  {activeProfile.location && (
                    <div className="text-muted-foreground">{activeProfile.location}</div>
                  )}
                  {activeProfile.about && (
                    <div className="mt-1 line-clamp-3 text-muted-foreground">
                      {activeProfile.about}
                    </div>
                  )}
                </div>
              )}
              {linkedProspect && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{linkedProspect.stage}</Badge>
                  <Badge variant="outline">{linkedProspect.tier}</Badge>
                  <span className="text-muted-foreground">
                    Qual {linkedProspect.qualScore}/100 · {daysSince(linkedProspect.lastTouchAt)}d
                    since touch
                  </span>
                </div>
              )}
              <ScrollArea className="h-[55vh]">
                <div className="space-y-2 pr-2">
                  {activeThread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.sender === "me" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                          m.sender === "me"
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface-elevated",
                        )}
                      >
                        <div className="mb-0.5 text-[10px] uppercase tracking-widest opacity-70">
                          {m.sender === "me" ? "You" : activeThread.participantName} · {m.timestamp}
                        </div>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </Section>

        {/* CO-PILOT */}
        <div className="space-y-4">
        <Section title="AI Co-Pilot">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(ACTION_META) as LinkedinAction[]).map((a) => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={cn(
                  "rounded-md border border-border bg-surface p-2 text-left text-xs hover:border-primary/40",
                  action === a && "border-primary bg-surface-elevated",
                )}
              >
                <div className="font-medium">{ACTION_META[a].label}</div>
                <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                  {ACTION_META[a].description}
                </div>
              </button>
            ))}
          </div>

          <Button
            className="mt-3 w-full"
            onClick={generate}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3 w-3" />
            )}
            Generate {ACTION_META[action].label}
          </Button>

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="AI draft appears here. Edit before sending."
            className="mt-3 min-h-[180px] font-mono text-xs"
          />

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={insertIntoLinkedIn}
              disabled={!draft.trim() || !extConnected}
              title={!extConnected ? "Pair the extension first" : "Insert into LinkedIn reply box"}
            >
              <Send className="mr-1 h-3 w-3" />
              Insert
            </Button>
            <Button size="sm" variant="outline" onClick={copyDraft} disabled={!draft.trim()}>
              <Copy className="mr-1 h-3 w-3" />
              Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={saveAsVnScript}
              disabled={!draft.trim() || !activeThread}
            >
              <Save className="mr-1 h-3 w-3" />
              Vault
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => {
              const link = settings.calendarLink;
              if (!link) {
                toast.error("Set your calendar link in Settings first.");
                return;
              }
              const name = activeThread?.participantName?.split(" ")[0] ?? "there";
              setDraft(
                `Hey ${name} — here's the link to grab a 15-min slot, no pressure: ${link}\n\nLet me know if any of those times work for you.`,
              );
              toast.success("Calendar-link template loaded.");
            }}
          >
            📅 Send calendar link
          </Button>
        </Section>
        <ProfileQualifierBox />
        </div>
      </PageBody>
    </>
  );
}

function ExtensionStatus({
  connected,
  code,
  onDownload,
}: {
  connected: boolean;
  code: string;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          "gap-1 text-[10px]",
          connected ? "border-success text-success" : "border-destructive text-destructive",
        )}
        title={
          connected
            ? "The extension is live and pushing LinkedIn profile/thread data into the app."
            : "Install the extension, pair it, then open a LinkedIn profile or DM thread."
        }
      >
        {connected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {connected ? "Extension connected" : "Extension not paired"}
      </Badge>
      <Badge variant="outline" className="font-mono text-[10px] tracking-widest">
        Pair code: {code || "—"}
      </Badge>
      <Button size="sm" variant="outline" onClick={onDownload}>
        <Download className="mr-1 h-3 w-3" />
        Extension
      </Button>
    </div>
  );
}

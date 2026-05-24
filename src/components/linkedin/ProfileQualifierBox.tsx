import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Copy, X } from "lucide-react";
import { Section } from "@/components/Page";
import { qualifyProfile, type ProfileQualifierResult } from "@/lib/ai/aiAssistants.functions";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { SIGNAL_LABELS, EMPTY_SIGNALS, type BuyingSignals } from "@/lib/btf/types";
import { cn } from "@/lib/utils";

const ICP_COLOR = {
  green: "border-success text-success",
  yellow: "border-amber-400 text-amber-500",
  red: "border-destructive text-destructive",
} as const;

const FLAG = (v: number) => (v === 1 ? "✓" : v === 0 ? "✗" : "?");

export function ProfileQualifierBox() {
  const fn = useServerFn(qualifyProfile);
  const addProspect = useStore((s) => s.addProspect);
  const prospects = useStore((s) => s.prospects);
  const pendingProfileQualification = useStore((s) => s.pendingProfileQualification);
  const clearPendingProfileQualification = useStore((s) => s.clearPendingProfileQualification);
  const [text, setText] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ProfileQualifierResult | null>(null);
  const [autoAdded, setAutoAdded] = useState(false);

  const runWith = async (input: string) => {
    const trimmed = input.trim();
    if (trimmed.length < 10) {
      toast.error("Paste a profile first.");
      return;
    }
    setBusy(true);
    setRes(null);
    setAutoAdded(false);
    try {
      const r = await fn({ data: { profileText: trimmed } });
      if (r.ok) {
        setRes(r.result);
        if (r.result.verdict === "SEND_VN") {
          const extractedName = r.result.extracted?.fullName?.trim();
          const fallbackName =
            trimmed.split("\n").find((l) => l.trim().length > 1)?.trim().slice(0, 80) ?? "New prospect";
          const nameLine = extractedName && extractedName.length > 1 ? extractedName : fallbackName;
          const bioText =
            r.result.extracted?.bio?.trim() ||
            r.result.extracted?.headline?.trim() ||
            trimmed.slice(0, 800);
          const url = profileUrl.trim();
          const dup = prospects.find(
            (p) =>
              p.name.trim().toLowerCase() === nameLine.toLowerCase() ||
              (url && p.profileUrl && p.profileUrl.toLowerCase() === url.toLowerCase()),
          );
          if (!dup) {
            const created = addProspect({
              name: nameLine,
              profileUrl: url,
              platform: "linkedin",
              bio: bioText,
              niche: r.result.market,
              tier: r.result.predictedTier === "unknown" ? "DWY" : r.result.predictedTier,
              stage: "Found",
              signals: { ...EMPTY_SIGNALS, ...(r.result.buyingSignals ?? {}) } as BuyingSignals,
            });
            setAutoAdded(true);
            toast.success(`Added ${created.name} to pipeline (Found)`);
          } else {
            setAutoAdded(true);
          }
        }
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const run = () => runWith(text);

  // External trigger: any caller can dispatch a window event with profile text
  // (e.g. extension scrape of a LinkedIn profile, or "Analyze" button from /prospects).
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ text: string; profileUrl?: string; autoRun?: boolean }>).detail;
      if (!detail?.text) return;
      setText(detail.text);
      if (detail.profileUrl) setProfileUrl(detail.profileUrl);
      setRes(null);
      if (detail.autoRun !== false) void runWith(detail.text);
    };
    window.addEventListener("btf:qualify-profile", handler);
    return () => window.removeEventListener("btf:qualify-profile", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingProfileQualification?.text) return;
    const hasThread = Object.values(useStore.getState().linkedinThreads).some(
      (t) => t.participantProfileUrl === pendingProfileQualification.profileUrl,
    );
    if (hasThread) {
      clearPendingProfileQualification();
      return;
    }

    const capturedText = pendingProfileQualification.text;
    const capturedUrl = pendingProfileQualification.profileUrl;
    setText(capturedText);
    setProfileUrl(capturedUrl);
    setRes(null);
    toast.success(`Profile captured: ${pendingProfileQualification.name} — qualifying…`);
    clearPendingProfileQualification();
    // Extension sync is an explicit user action ("Sync this profile" / opening
    // a profile in the side panel), so auto-run the BTF Setter qualifier.
    void runWith(capturedText);
  }, [clearPendingProfileQualification, pendingProfileQualification]);

  const copyVerdict = () => {
    if (!res) return;
    const body = [
      res.verdictLine,
      `Market: ${res.market}  ·  ICP: ${res.icpMatch}  ·  Tier: ${res.predictedTier}`,
      `Qualifiers: DM ${FLAG(res.qualification.decisionMaker)} · Offer ${FLAG(res.qualification.hasOffer)} · Earning ${FLAG(res.qualification.earningSomething)} · Wants more ${FLAG(res.qualification.wantsMore)}`,
      `Hook: ${res.personalisationHook}`,
      `Opening line: ${res.suggestedFirstLine}`,
    ].join("\n");
    navigator.clipboard.writeText(body);
    toast.success("Copied verdict");
  };

  const createProspect = () => {
    if (!res) return;
    const extractedName = res.extracted?.fullName?.trim();
    const fallbackName = text.split("\n").find((l) => l.trim().length > 1)?.trim().slice(0, 80) ?? "New prospect";
    const nameLine = extractedName && extractedName.length > 1 ? extractedName : fallbackName;
    const bioText =
      res.extracted?.bio?.trim() || res.extracted?.headline?.trim() || text.slice(0, 800);
    const created = addProspect({
      name: nameLine,
      profileUrl: profileUrl.trim(),
      platform: "linkedin",
      bio: bioText,
      niche: res.market,
      tier: res.predictedTier === "unknown" ? "DWY" : res.predictedTier,
      stage: res.verdict === "SEND_VN" ? "Found" : "Cold",
      signals: { ...EMPTY_SIGNALS, ...(res.buyingSignals ?? {}) } as BuyingSignals,
    });
    toast.success(`Prospect created: ${created.name}`);
  };

  return (
    <Section
      title="Paste-a-profile verdict"
      action={
        res ? (
          <Button size="sm" variant="ghost" onClick={() => { setRes(null); setText(""); setProfileUrl(""); }}>
            <X className="mr-1 h-3 w-3" /> Clear
          </Button>
        ) : null
      }
    >
      {!res ? (
        <>
          <Input
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder="LinkedIn profile URL (https://linkedin.com/in/…)"
            className="mb-2 text-xs"
          />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste raw LinkedIn profile (name, headline, about, recent activity) — get an instant ✅/❌ verdict before sending a connection."
            className="min-h-[120px] text-xs"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={run} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Qualify
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-2 text-xs">
          <div
            className={cn(
              "rounded-md border p-2 font-medium",
              res.verdict === "SEND_VN" && "border-success/40 bg-success/5 text-success",
              res.verdict === "SKIP" && "border-destructive/40 bg-destructive/5 text-destructive",
              res.verdict === "MAYBE" && "border-amber-400/40 bg-amber-400/5 text-amber-500",
            )}
          >
            {res.verdictLine}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono">SCORE {res.score}/100</Badge>
            <Badge
              variant="outline"
              className={cn(
                res.fit === "STRONG" && "border-success text-success",
                res.fit === "DECENT" && "border-amber-400 text-amber-500",
                res.fit === "WEAK" && "border-muted-foreground text-muted-foreground",
                res.fit === "AVOID" && "border-destructive text-destructive",
              )}
            >
              FIT: {res.fit}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                res.priorityMarket?.match
                  ? "border-success text-success"
                  : "border-muted text-muted-foreground",
              )}
            >
              ★ Priority: {res.priorityMarket?.match ? `Yes — ${res.priorityMarket.name}` : "No"}
            </Badge>
            <Badge variant="outline" className={cn("uppercase", ICP_COLOR[res.icpMatch])}>
              ICP {res.icpMatch}
            </Badge>
            <Badge variant="outline">{res.market}</Badge>
            <Badge variant="outline">Tier: {res.predictedTier}</Badge>
            <Badge variant="outline">Conf {Math.round(res.confidence * 100)}%</Badge>
          </div>

          {res.summary && (
            <div className="rounded bg-surface p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Summary</div>
              <div>{res.summary}</div>
            </div>
          )}

          <div>
            <span className="text-muted-foreground">4 qualifiers:</span>{" "}
            DM {FLAG(res.qualification.decisionMaker)} ·{" "}
            Offer {FLAG(res.qualification.hasOffer)} ·{" "}
            Earning {FLAG(res.qualification.earningSomething)} ·{" "}
            Wants more {FLAG(res.qualification.wantsMore)}
          </div>

          {res.extracted && (res.extracted.fullName || res.extracted.headline) && (
            <div className="rounded bg-surface p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Extracted</div>
              {res.extracted.fullName && <div><strong>{res.extracted.fullName}</strong></div>}
              {res.extracted.headline && <div className="text-muted-foreground">{res.extracted.headline}</div>}
            </div>
          )}

          {res.buyingSignals && (
            <div className="rounded bg-surface p-2">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Buying signals
              </div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(SIGNAL_LABELS) as Array<keyof typeof SIGNAL_LABELS>).map((k) => {
                  const on = Boolean(res.buyingSignals?.[k]);
                  return (
                    <Badge
                      key={k}
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        on ? "border-success text-success" : "border-muted text-muted-foreground opacity-60",
                      )}
                    >
                      {on ? "✓" : "·"} {SIGNAL_LABELS[k]}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-1 sm:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-success">Green</div>
              <ul className="list-inside list-disc text-[11px]">
                {res.greenFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-destructive">Red</div>
              <ul className="list-inside list-disc text-[11px]">
                {res.redFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>

          <div className="rounded bg-surface p-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Tier reason</div>
            <div>{res.predictedTierReason}</div>
          </div>

          <div className="rounded bg-surface p-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Hook</div>
            <div className="italic">"{res.personalisationHook}"</div>
          </div>

          <div className="rounded bg-surface p-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Opening line</div>
            <div>{res.suggestedFirstLine}</div>
          </div>

          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={copyVerdict}>
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
            {res.verdict !== "SKIP" && !autoAdded && (
              <Button size="sm" variant="outline" onClick={createProspect}>
                + Add as prospect
              </Button>
            )}
            {autoAdded && (
              <Badge variant="outline" className="border-success text-success">
                ✓ In pipeline
              </Badge>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

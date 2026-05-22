import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth/useAuth";
import { pullAll, pushAll } from "./sync.functions";
import { EMPTY_SIGNALS } from "@/lib/btf/types";
import { toast } from "sonner";

/**
 * Bi-directional sync between Zustand and Supabase.
 *  - On login: pull all rows and replace local store.
 *  - On any store change (debounced 1.5s): push full snapshot back.
 *
 * Single-user CRM — data volume is tiny, so full snapshot push is simpler
 * and safer than a diff-based approach.
 */
export function useSupabaseSync() {
  const auth = useAuth();
  const hydratedFromRemote = useRef(false);
  const lastUserId = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPulling = useRef(false);

  // PULL on login
  useEffect(() => {
    if (auth.status !== "authed" || !auth.user) return;
    if (lastUserId.current === auth.user.id) return;
    lastUserId.current = auth.user.id;
    hydratedFromRemote.current = false;
    isPulling.current = true;

    (async () => {
      try {
        const remote = await pullAll();

        // Smart pull: if remote is empty but local has data, KEEP local
        // and let the debounced push mirror it to cloud. Prevents wiping
        // localStorage-only data on first login.
        const remoteEmpty =
          (remote.prospects?.length ?? 0) === 0 &&
          (remote.kpi?.length ?? 0) === 0 &&
          (remote.scripts?.length ?? 0) === 0 &&
          (remote.training?.length ?? 0) === 0 &&
          (remote.analyses?.length ?? 0) === 0;
        const localState = useStore.getState();
        const localHasData =
          localState.prospects.length > 0 ||
          localState.kpiDays.length > 0 ||
          localState.scripts.length > 0 ||
          localState.training.length > 0 ||
          localState.vnScripts.length > 0 ||
          Object.keys(localState.prospectAnalyses).length > 0;
        if (remoteEmpty && localHasData) {
          hydratedFromRemote.current = true;
          toast.success("Local data detected — backing up to cloud…");
          // bump a noop set to trigger the push subscription
          useStore.setState({ ...localState });
          isPulling.current = false;
          return;
        }

        const prospects = remote.prospects.map((p: any) => ({
          id: p.id,
          name: p.name,
          profileUrl: p.profile_url ?? "",
          platform: p.platform,
          niche: p.niche ?? "",
          bio: p.bio ?? "",
          leadType: p.lead_type,
          tier: p.tier,
          stage: p.stage,
          qualScore: p.qual_score,
          bant: p.bant ?? { need: 0, timeline: 0, authority: 0, budget: 0 },
          signals: { ...EMPTY_SIGNALS, ...(p.signals ?? {}) },
          activities: p.activities ?? [],
          vnLog: p.vn_log ?? [],
          createdAt: p.created_at,
          stageEnteredAt: p.stage_entered_at,
          lastTouchAt: p.last_touch_at,
        }));

        const kpiDays = remote.kpi.map((k: any) => ({
          date: k.date,
          vnSent: k.vn_sent,
          connectionsSent: k.connections_sent,
          connectionsAccepted: k.connections_accepted,
          replies: k.replies,
          activeConvos: k.active_convos,
          calendarsSent: k.calendars_sent,
          booked: k.booked,
          shows: k.shows,
          hours: Number(k.hours),
          byPlatform: k.by_platform ?? {},
        }));

        const scripts = remote.scripts
          .filter((s: any) => s.category === "script-log")
          .map((s: any) => ({
            id: s.id,
            date: s.date ?? new Date().toISOString().slice(0, 10),
            variation: s.content,
            market: s.scenario ?? "",
            niche: s.niche ?? "",
            platform: (s.prospect_name as any) ?? "linkedin",
            replied: s.outcome === "reply",
            booked: s.outcome === "booked",
          }));

        const vnScripts = remote.scripts
          .filter((s: any) => s.category === "vn-script")
          .map((s: any) => ({
            id: s.id,
            date: s.date ?? new Date().toISOString().slice(0, 10),
            prospectId: s.prospect_id ?? undefined,
            prospectName: s.prospect_name ?? "",
            niche: s.niche ?? undefined,
            scenario: s.scenario ?? "",
            text: s.content,
            used: s.used,
            outcome: s.outcome as any,
          }));

        const training = remote.training.map((t: any) => ({
          id: t.id,
          scenarioId: t.scenario,
          date: t.created_at ?? new Date().toISOString(),
          transcript: t.transcript ?? [],
          grade: (t.persona as any) ?? undefined,
          strengths: [],
          improvements: [],
          frameworkScore: t.score ?? undefined,
        }));

        const prospectAnalyses: Record<string, any[]> = {};
        for (const a of remote.analyses as any[]) {
          (prospectAnalyses[a.prospect_id] ??= []).push({
            id: a.id,
            createdAt: a.created_at,
            stageAtTime: a.stage_at_time,
            verdictLine: a.verdict_line,
            suggestedStage: a.suggested_stage ?? "",
            nextMove: a.next_move ?? "",
            draftMessage: a.draft_message ?? "",
            suggestedActivityType: a.suggested_activity_type ?? "",
            reasoning: a.reasoning ?? "",
            confidence: Number(a.confidence ?? 0),
          });
        }

        useStore.setState({
          prospects,
          kpiDays,
          scripts,
          training,
          vnScripts,
          prospectAnalyses,
        });

        hydratedFromRemote.current = true;
      } catch (e) {
        console.error("[sync] pull failed", e);
        toast.error(`Sync failed: ${(e as Error).message}`);
      } finally {
        isPulling.current = false;
      }
    })();
  }, [auth.status, auth.user]);

  // PUSH on store change (debounced)
  useEffect(() => {
    if (auth.status !== "authed") return;
    const unsub = useStore.subscribe((state, prev) => {
      if (!hydratedFromRemote.current || isPulling.current) return;
      // Only watch persisted domains
      if (
        state.prospects === prev.prospects &&
        state.kpiDays === prev.kpiDays &&
        state.scripts === prev.scripts &&
        state.training === prev.training &&
        state.vnScripts === prev.vnScripts &&
        state.prospectAnalyses === prev.prospectAnalyses
      ) return;

      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(async () => {
        try {
          const s = useStore.getState();
          await pushAll({
            data: {
              prospects: s.prospects.map((p) => ({
                id: p.id,
                name: p.name,
                profile_url: p.profileUrl || null,
                platform: p.platform,
                niche: p.niche || null,
                bio: p.bio || null,
                lead_type: p.leadType,
                tier: p.tier,
                stage: p.stage,
                qual_score: p.qualScore,
                bant: p.bant,
                signals: p.signals,
                activities: p.activities,
                vn_log: p.vnLog,
                created_at: p.createdAt,
                stage_entered_at: p.stageEnteredAt,
                last_touch_at: p.lastTouchAt,
              })),
              kpi: s.kpiDays.map((k) => ({
                date: k.date,
                vn_sent: k.vnSent,
                connections_sent: k.connectionsSent,
                connections_accepted: k.connectionsAccepted,
                replies: k.replies,
                active_convos: k.activeConvos,
                calendars_sent: k.calendarsSent,
                booked: k.booked,
                shows: k.shows,
                hours: k.hours,
                by_platform: k.byPlatform ?? {},
              })),
              scripts: [
                ...s.scripts.map((x) => ({
                  id: x.id,
                  name: `Script ${x.date}`,
                  content: x.variation,
                  category: "script-log",
                  prospect_name: x.platform,
                  niche: x.niche,
                  scenario: x.market,
                  used: true,
                  outcome: x.booked ? "booked" : x.replied ? "reply" : null,
                  date: x.date,
                })),
                ...s.vnScripts.map((x) => ({
                  id: x.id,
                  name: `VN ${x.prospectName}`,
                  content: x.text,
                  category: "vn-script",
                  prospect_id: x.prospectId ?? null,
                  prospect_name: x.prospectName,
                  niche: x.niche ?? null,
                  scenario: x.scenario,
                  used: x.used,
                  outcome: x.outcome ?? null,
                  date: x.date,
                })),
              ],
              training: s.training.map((t) => ({
                id: t.id,
                scenario: t.scenarioId,
                persona: t.grade ?? null,
                transcript: t.transcript,
                score: t.frameworkScore ?? null,
                notes: null,
              })),
              analyses: Object.entries(s.prospectAnalyses).flatMap(([pid, arr]) =>
                arr.map((a) => ({
                  id: a.id,
                  prospect_id: pid,
                  stage_at_time: a.stageAtTime,
                  verdict_line: a.verdictLine,
                  suggested_stage: a.suggestedStage,
                  next_move: a.nextMove,
                  draft_message: a.draftMessage,
                  suggested_activity_type: a.suggestedActivityType,
                  reasoning: a.reasoning,
                  confidence: a.confidence,
                  created_at: a.createdAt,
                })),
              ),
            },
          });
        } catch (e) {
          console.error("[sync] push failed", e);
          toast.error(`Cloud sync failed: ${(e as Error).message}`);
        }
      }, 1500);
    });
    return () => {
      unsub();
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [auth.status]);
}

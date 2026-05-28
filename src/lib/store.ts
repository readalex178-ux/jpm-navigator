import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type Prospect,
  type KpiDay,
  type ScriptLog,
  type TrainingSession,
  type Commission,
  type Settings,
  type Stage,
  type Activity,
  type VNEntry,
  type BuyingSignals,
  type BANT,
  DEFAULT_SETTINGS,
  EMPTY_SIGNALS,
} from "./btf/types";
import type { ScrapedThread, ScrapedProfile } from "./extension/types";
import type { CachedAnalysis } from "./ai/analyzerSchema";

export type VNScript = {
  id: string;
  date: string;
  prospectId?: string;
  prospectName: string;
  niche?: string;
  scenario: string;
  text: string;
  used: boolean;
  outcome?: "reply" | "booked" | "ghosted";
};

const uid = () => Math.random().toString(36).slice(2, 11);
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

type State = {
  prospects: Prospect[];
  kpiDays: KpiDay[];
  scripts: ScriptLog[];
  training: TrainingSession[];
  commissions: Commission[];
  settings: Settings;
  hydrated: boolean;
  // LinkedIn extension bridge state
  pairingCode: string;
  extensionConnected: boolean;
  extensionLastSeen: string | null;
  pendingProfileQualification: {
    text: string;
    profileUrl: string;
    name: string;
    capturedAt: string;
  } | null;
  linkedinThreads: Record<string, ScrapedThread>;
  linkedinProfiles: Record<string, ScrapedProfile>;
  threadProspectMap: Record<string, string>; // threadId -> prospectId
  vnScripts: VNScript[];
  analyses: Record<string, CachedAnalysis>; // threadId -> latest analysis
  analysisHistory: Record<string, CachedAnalysis[]>; // threadId -> chronological history (oldest first)
  prospectAnalyses: Record<string, ProspectAnalysisEntry[]>; // prospectId -> chronological
  /** Transient: when set, GhlClaimModal opens for this prospect. */
  ghlPromptProspectId: string | null;
  /** threadId -> ISO timestamp the user last opened/marked-read that thread. */
  linkedinThreadReads: Record<string, string>;
};

export type ProspectAnalysisEntry = {
  id: string;
  createdAt: string;
  stageAtTime: string;
  verdictLine: string;
  suggestedStage: string;
  nextMove: string;
  draftMessage: string;
  suggestedActivityType: string;
  reasoning: string;
  confidence: number;
};

type Actions = {
  addProspect: (p: Partial<Prospect> & { name: string }) => Prospect;
  updateProspect: (id: string, patch: Partial<Prospect>) => void;
  deleteProspect: (id: string) => void;
  /** Returns a deep-ish copy of `id` with cleared identity fields (name/url/handle).
   * Activity/VN logs are NOT copied — only static qualification metadata. */
  duplicateProspect: (id: string, overrides?: Partial<Prospect>) => Prospect | null;
  moveStage: (id: string, stage: Stage) => void;
  logActivity: (id: string, a: Omit<Activity, "id">) => void;
  logVN: (id: string, v: Omit<VNEntry, "id">) => void;
  setSignals: (id: string, s: BuyingSignals) => void;
  setBant: (id: string, b: BANT) => void;
  setQualScore: (id: string, score: number) => void;
  setFollowUp: (id: string, at: string | null, reason?: string | null) => void;

  upsertKpiDay: (patch: Partial<KpiDay> & { date: string }) => void;
  getKpiDay: (date: string) => KpiDay;

  addScript: (s: Omit<ScriptLog, "id">) => void;

  addTraining: (s: Omit<TrainingSession, "id">) => TrainingSession;
  updateTraining: (id: string, patch: Partial<TrainingSession>) => void;

  addCommission: (c: Omit<Commission, "id">) => void;
  removeCommission: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;

  // LinkedIn / extension
  setPairingCode: (code: string) => void;
  setExtensionConnected: (connected: boolean) => void;
  setPendingProfileQualification: (payload: State["pendingProfileQualification"]) => void;
  clearPendingProfileQualification: () => void;
  upsertLinkedinThread: (t: ScrapedThread) => void;
  upsertLinkedinProfile: (p: ScrapedProfile) => void;
  linkThreadToProspect: (threadId: string, prospectId: string) => void;
  addVnScript: (s: Omit<VNScript, "id">) => VNScript;
  updateVnScript: (id: string, patch: Partial<VNScript>) => void;
  removeVnScript: (id: string) => void;
  upsertAnalysis: (a: CachedAnalysis) => void;
  clearAnalysis: (threadId: string) => void;

  addProspectAnalysis: (prospectId: string, entry: Omit<ProspectAnalysisEntry, "id" | "createdAt">) => void;
  clearProspectAnalyses: (prospectId: string) => void;

  importJson: (data: Partial<State>) => void;
  exportJson: () => string;

  setGhlPromptProspectId: (id: string | null) => void;
  togglePin: (id: string) => void;
  markThreadRead: (threadId: string) => void;
  markThreadUnread: (threadId: string) => void;
};

const blankKpi = (date: string): KpiDay => ({
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
});

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      prospects: [],
      kpiDays: [],
      scripts: [],
      training: [],
      commissions: [],
      settings: DEFAULT_SETTINGS,
      hydrated: false,
      pairingCode: "",
      extensionConnected: false,
      extensionLastSeen: null,
      pendingProfileQualification: null,
      linkedinThreads: {},
      linkedinProfiles: {},
      threadProspectMap: {},
      vnScripts: [],
      analyses: {},
      analysisHistory: {},
      prospectAnalyses: {},
      ghlPromptProspectId: null,
      linkedinThreadReads: {},

      addProspect: (p) => {
        const prospect: Prospect = {
          id: uid(),
          name: p.name,
          profileUrl: p.profileUrl ?? "",
          platform: p.platform ?? "linkedin",
          niche: p.niche ?? "",
          bio: p.bio ?? "",
          leadType: p.leadType ?? "Direct",
          tier: p.tier ?? "DWY",
          stage: p.stage ?? "Found",
          qualScore: p.qualScore ?? 0,
          bant: p.bant ?? { need: 0, timeline: 0, authority: 0, budget: 0 },
          signals: p.signals ?? { ...EMPTY_SIGNALS },
          activities: p.activities ?? [],
          vnLog: p.vnLog ?? [],
          createdAt: p.createdAt ?? now(),
          stageEnteredAt: p.stageEnteredAt ?? p.createdAt ?? now(),
          lastTouchAt: p.lastTouchAt ?? p.createdAt ?? now(),
        };
        set({ prospects: [prospect, ...get().prospects] });
        return prospect;
      },
      updateProspect: (id, patch) =>
        set({ prospects: get().prospects.map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      deleteProspect: (id) =>
        set({ prospects: get().prospects.filter((x) => x.id !== id) }),
      duplicateProspect: (id, overrides) => {
        const src = get().prospects.find((x) => x.id === id);
        if (!src) return null;
        const copy: Prospect = {
          ...src,
          id: uid(),
          name: overrides?.name ?? `${src.name} (copy)`,
          profileUrl: overrides?.profileUrl ?? "",
          activities: [],
          vnLog: [],
          createdAt: now(),
          stageEnteredAt: now(),
          lastTouchAt: now(),
          notes: undefined,
          followUpAt: undefined,
          followUpReason: undefined,
          pinned: false,
          ghlClaimed: false,
          ghlRemindAt: undefined,
          ...overrides,
        };
        set({ prospects: [copy, ...get().prospects] });
        return copy;
      },
      moveStage: (id, stage) => {
        const prev = get().prospects.find((x) => x.id === id);
        set({
          prospects: get().prospects.map((x) =>
            x.id === id ? { ...x, stage, stageEnteredAt: now() } : x,
          ),
        });
        // Auto-wire KPI counters on user-driven stage moves.
        const date = today();
        const day = get().kpiDays.find((k) => k.date === date) ?? blankKpi(date);
        const bumped: Partial<KpiDay> & { date: string } = { date };
        if (stage === "Connected") bumped.connectionsAccepted = day.connectionsAccepted + 1;
        if (stage === "VN1 Sent" || stage === "VN2 Sent") bumped.vnSent = day.vnSent + 1;
        if (stage === "Replied") bumped.replies = day.replies + 1;
        if (stage === "Calendar Sent") bumped.calendarsSent = day.calendarsSent + 1;
        if (stage === "Call Booked") bumped.booked = day.booked + 1;
        if (Object.keys(bumped).length > 1) {
          const exists = get().kpiDays.find((k) => k.date === date);
          if (exists) {
            set({ kpiDays: get().kpiDays.map((k) => (k.date === date ? { ...k, ...bumped } : k)) });
          } else {
            set({ kpiDays: [{ ...blankKpi(date), ...bumped }, ...get().kpiDays] });
          }
        }
        // Win celebration + GHL prompt on Call Booked (only on actual transition).
        if (stage === "Call Booked" && prev && prev.stage !== "Call Booked") {
          if (typeof window !== "undefined") {
            void import("./confetti").then((m) => m.celebrateWin()).catch(() => {});
          }
          set({ ghlPromptProspectId: id });
        }
      },
      logActivity: (id, a) =>
        set({
          prospects: get().prospects.map((x) =>
            x.id === id
              ? {
                  ...x,
                  activities: [{ id: uid(), ...a }, ...x.activities],
                  lastTouchAt: a.date,
                }
              : x,
          ),
        }),
      logVN: (id, v) => {
        set({
          prospects: get().prospects.map((x) =>
            x.id === id
              ? { ...x, vnLog: [{ id: uid(), ...v }, ...x.vnLog], lastTouchAt: v.date }
              : x,
          ),
        });
        // VN logged = bump today's vn_sent (user action).
        const date = today();
        const exists = get().kpiDays.find((k) => k.date === date);
        if (exists) {
          set({ kpiDays: get().kpiDays.map((k) => (k.date === date ? { ...k, vnSent: k.vnSent + 1 } : k)) });
        } else {
          set({ kpiDays: [{ ...blankKpi(date), vnSent: 1 }, ...get().kpiDays] });
        }
      },
      setSignals: (id, signals) =>
        set({ prospects: get().prospects.map((x) => (x.id === id ? { ...x, signals } : x)) }),
      setBant: (id, bant) =>
        set({ prospects: get().prospects.map((x) => (x.id === id ? { ...x, bant } : x)) }),
      setQualScore: (id, qualScore) =>
        set({ prospects: get().prospects.map((x) => (x.id === id ? { ...x, qualScore } : x)) }),
      setFollowUp: (id, at, reason) =>
        set({
          prospects: get().prospects.map((x) =>
            x.id === id
              ? { ...x, followUpAt: at ?? undefined, followUpReason: reason ?? undefined }
              : x,
          ),
        }),

      upsertKpiDay: (patch) => {
        const existing = get().kpiDays.find((k) => k.date === patch.date);
        if (existing) {
          set({
            kpiDays: get().kpiDays.map((k) => (k.date === patch.date ? { ...k, ...patch } : k)),
          });
        } else {
          set({ kpiDays: [{ ...blankKpi(patch.date), ...patch }, ...get().kpiDays] });
        }
      },
      getKpiDay: (date) => get().kpiDays.find((k) => k.date === date) ?? blankKpi(date),

      addScript: (s) => set({ scripts: [{ id: uid(), ...s }, ...get().scripts] }),

      addTraining: (s) => {
        const session: TrainingSession = { id: uid(), ...s };
        set({ training: [session, ...get().training] });
        return session;
      },
      updateTraining: (id, patch) =>
        set({ training: get().training.map((x) => (x.id === id ? { ...x, ...patch } : x)) }),

      addCommission: (c) => set({ commissions: [{ id: uid(), ...c }, ...get().commissions] }),
      removeCommission: (id) =>
        set({ commissions: get().commissions.filter((x) => x.id !== id) }),

      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

      setPairingCode: (code) => set({ pairingCode: code }),
      setExtensionConnected: (connected) =>
        set({ extensionConnected: connected, extensionLastSeen: connected ? now() : get().extensionLastSeen }),
      setPendingProfileQualification: (payload) => set({ pendingProfileQualification: payload }),
      clearPendingProfileQualification: () => set({ pendingProfileQualification: null }),
      upsertLinkedinThread: (t) =>
        set({
          linkedinThreads: { ...get().linkedinThreads, [t.threadId]: t },
          extensionLastSeen: now(),
        }),
      upsertLinkedinProfile: (p) =>
        set({
          linkedinProfiles: { ...get().linkedinProfiles, [p.profileUrl]: p },
          extensionLastSeen: now(),
        }),
      linkThreadToProspect: (threadId, prospectId) =>
        set({ threadProspectMap: { ...get().threadProspectMap, [threadId]: prospectId } }),
      addVnScript: (s) => {
        const script: VNScript = { id: uid(), ...s };
        set({ vnScripts: [script, ...get().vnScripts] });
        return script;
      },
      updateVnScript: (id, patch) =>
        set({ vnScripts: get().vnScripts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      removeVnScript: (id) =>
        set({ vnScripts: get().vnScripts.filter((x) => x.id !== id) }),
      upsertAnalysis: (a) => {
        const prevHistory = get().analysisHistory[a.threadId] ?? [];
        const last = prevHistory[prevHistory.length - 1];
        // If the new analysis is based on the same last message, replace the last entry (re-analysis of same state).
        // Otherwise append as a new historical point.
        const nextHistory =
          last && last.basedOnLastMessageAt === a.basedOnLastMessageAt
            ? [...prevHistory.slice(0, -1), a]
            : [...prevHistory, a];
        // Cap history at 20 entries per thread to bound storage.
        const capped = nextHistory.slice(-20);
        set({
          analyses: { ...get().analyses, [a.threadId]: a },
          analysisHistory: { ...get().analysisHistory, [a.threadId]: capped },
        });
      },
      clearAnalysis: (threadId) => {
        const next = { ...get().analyses };
        const nextHist = { ...get().analysisHistory };
        delete next[threadId];
        delete nextHist[threadId];
        set({ analyses: next, analysisHistory: nextHist });
      },

      addProspectAnalysis: (prospectId, entry) => {
        const prev = get().prospectAnalyses[prospectId] ?? [];
        const next = [...prev, { id: uid(), createdAt: now(), ...entry }].slice(-20);
        set({ prospectAnalyses: { ...get().prospectAnalyses, [prospectId]: next } });
      },
      clearProspectAnalyses: (prospectId) => {
        const next = { ...get().prospectAnalyses };
        delete next[prospectId];
        set({ prospectAnalyses: next });
      },



      setGhlPromptProspectId: (id) => set({ ghlPromptProspectId: id }),
      togglePin: (id) =>
        set({
          prospects: get().prospects.map((x) =>
            x.id === id ? { ...x, pinned: !x.pinned } : x,
          ),
        }),

      importJson: (data) => set({ ...get(), ...data }),
      exportJson: () => {
        const { prospects, kpiDays, scripts, training, commissions, settings, vnScripts } = get();
        return JSON.stringify(
          { prospects, kpiDays, scripts, training, commissions, settings, vnScripts, exportedAt: now() },
          null,
          2,
        );
      },
    }),
    {
      name: "btf-setter-os:v1",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : (undefined as any))),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
      skipHydration: true,
    },
  ),
);

export const todayStr = today;

// Helpers
export const daysSince = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return Math.max(0, Math.floor(d));
};

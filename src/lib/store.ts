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
  linkedinThreads: Record<string, ScrapedThread>;
  linkedinProfiles: Record<string, ScrapedProfile>;
  threadProspectMap: Record<string, string>; // threadId -> prospectId
  vnScripts: VNScript[];
  analyses: Record<string, CachedAnalysis>; // threadId -> latest analysis
  analysisHistory: Record<string, CachedAnalysis[]>; // threadId -> chronological history (oldest first)
  prospectAnalyses: Record<string, ProspectAnalysisEntry[]>; // prospectId -> chronological
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
  moveStage: (id: string, stage: Stage) => void;
  logActivity: (id: string, a: Omit<Activity, "id">) => void;
  logVN: (id: string, v: Omit<VNEntry, "id">) => void;
  setSignals: (id: string, s: BuyingSignals) => void;
  setBant: (id: string, b: BANT) => void;
  setQualScore: (id: string, score: number) => void;

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
      linkedinThreads: {},
      linkedinProfiles: {},
      threadProspectMap: {},
      vnScripts: [],
      analyses: {},
      analysisHistory: {},
      prospectAnalyses: {},

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
          createdAt: now(),
          stageEnteredAt: now(),
          lastTouchAt: now(),
        };
        set({ prospects: [prospect, ...get().prospects] });
        return prospect;
      },
      updateProspect: (id, patch) =>
        set({ prospects: get().prospects.map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      deleteProspect: (id) =>
        set({ prospects: get().prospects.filter((x) => x.id !== id) }),
      moveStage: (id, stage) =>
        set({
          prospects: get().prospects.map((x) =>
            x.id === id ? { ...x, stage, stageEnteredAt: now() } : x,
          ),
        }),
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
      logVN: (id, v) =>
        set({
          prospects: get().prospects.map((x) =>
            x.id === id
              ? { ...x, vnLog: [{ id: uid(), ...v }, ...x.vnLog], lastTouchAt: v.date }
              : x,
          ),
        }),
      setSignals: (id, signals) =>
        set({ prospects: get().prospects.map((x) => (x.id === id ? { ...x, signals } : x)) }),
      setBant: (id, bant) =>
        set({ prospects: get().prospects.map((x) => (x.id === id ? { ...x, bant } : x)) }),
      setQualScore: (id, qualScore) =>
        set({ prospects: get().prospects.map((x) => (x.id === id ? { ...x, qualScore } : x)) }),

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

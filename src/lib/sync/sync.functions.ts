import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sync layer: bulk pull-and-replace for the single-user CRM dataset.
 * Data volumes are small (single setter, <1000 rows per table) so a full
 * upsert-per-save strategy keeps things dead simple — no diffing.
 *
 * Read shape mirrors the Zustand store. Field names are snake_case at the
 * Supabase boundary, mapped to camelCase in the client adapter.
 */

const BantSchema = z.object({
  budget: z.number().int().min(0).max(2).default(0),
  authority: z.number().int().min(0).max(2).default(0),
  need: z.number().int().min(0).max(2).default(0),
  timeline: z.number().int().min(0).max(2).default(0),
}).partial().default({});

const SignalsSchema = z.record(z.string().max(60), z.boolean()).default({});

const ByPlatformSchema = z
  .record(
    z.string().max(40),
    z.record(z.string().max(40), z.number().min(0).max(1_000_000)),
  )
  .default({});

// Free-form but bounded — transcripts/activities/vn_log can vary across versions.
const BoundedJson = z.unknown().refine(
  (v) => {
    try {
      return JSON.stringify(v ?? null).length <= 200_000;
    } catch {
      return false;
    }
  },
  { message: "payload too large" },
);

const ProspectRow = z.object({
  id: z.string().max(64),
  name: z.string().min(1).max(200),
  profile_url: z.string().max(1000).nullable().optional(),
  platform: z.string().max(40),
  niche: z.string().max(400).nullable().optional(),
  bio: z.string().max(8000).nullable().optional(),
  lead_type: z.string().max(40),
  tier: z.string().max(20),
  stage: z.string().max(40),
  qual_score: z.number().min(0).max(100),
  bant: BantSchema,
  signals: SignalsSchema,
  notes: z.string().max(20_000).nullable().optional(),
  created_at: z.string().max(40),
  stage_entered_at: z.string().max(40),
  last_touch_at: z.string().max(40),
  follow_up_at: z.string().max(40).nullable().optional(),
  follow_up_reason: z.string().max(400).nullable().optional(),
  activities: BoundedJson.optional(),
  vn_log: BoundedJson.optional(),
});

const KpiRow = z.object({
  date: z.string().max(40),
  vn_sent: z.number().int().min(0).max(100_000),
  connections_sent: z.number().int().min(0).max(100_000),
  connections_accepted: z.number().int().min(0).max(100_000),
  replies: z.number().int().min(0).max(100_000),
  active_convos: z.number().int().min(0).max(100_000),
  calendars_sent: z.number().int().min(0).max(100_000),
  booked: z.number().int().min(0).max(100_000),
  shows: z.number().int().min(0).max(100_000),
  hours: z.number().min(0).max(24 * 7),
  by_platform: ByPlatformSchema,
});

const ScriptRow = z.object({
  id: z.string().max(64),
  name: z.string().min(1).max(200),
  content: z.string().max(20_000),
  category: z.string().max(80).nullable().optional(),
  prospect_id: z.string().max(64).nullable().optional(),
  prospect_name: z.string().max(200).nullable().optional(),
  niche: z.string().max(200).nullable().optional(),
  scenario: z.string().max(400).nullable().optional(),
  used: z.boolean(),
  outcome: z.string().max(80).nullable().optional(),
  date: z.string().max(40).nullable().optional(),
});

const TranscriptEntrySchema = z.object({
  role: z.string().max(40).optional(),
  speaker: z.string().max(40).optional(),
  text: z.string().max(8_000).optional(),
  content: z.string().max(8_000).optional(),
  at: z.string().max(40).optional(),
  ts: z.union([z.string().max(40), z.number()]).optional(),
}).passthrough();

const TrainingRow = z.object({
  id: z.string().max(64),
  scenario: z.string().max(400),
  persona: z.string().max(200).nullable().optional(),
  transcript: z.array(TranscriptEntrySchema).max(500).default([]),
  score: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
});

const AnalysisRow = z.object({
  id: z.string().max(64),
  prospect_id: z.string().max(64),
  stage_at_time: z.string().max(40),
  verdict_line: z.string().max(400),
  suggested_stage: z.string().max(40).nullable().optional(),
  next_move: z.string().max(800).nullable().optional(),
  draft_message: z.string().max(4_000).nullable().optional(),
  suggested_activity_type: z.string().max(40).nullable().optional(),
  reasoning: z.string().max(4_000).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  created_at: z.string().max(40).optional(),
});

const SyncPayload = z.object({
  prospects: z.array(ProspectRow).max(5_000),
  kpi: z.array(KpiRow).max(2_000),
  scripts: z.array(ScriptRow).max(2_000),
  training: z.array(TrainingRow).max(2_000),
  analyses: z.array(AnalysisRow).max(10_000),
});

export const pullAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [p, k, s, t, a] = await Promise.all([
      supabase.from("prospects").select("*").eq("user_id", userId),
      supabase.from("kpi_entries").select("*").eq("user_id", userId),
      supabase.from("scripts").select("*").eq("user_id", userId),
      supabase.from("training_sessions").select("*").eq("user_id", userId),
      supabase.from("prospect_analyses").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    ]);
    for (const r of [p, k, s, t, a]) if (r.error) throw new Error(r.error.message);
    return {
      prospects: p.data ?? [],
      kpi: k.data ?? [],
      scripts: s.data ?? [],
      training: t.data ?? [],
      analyses: a.data ?? [],
    };
  });

export const pushAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SyncPayload.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const idMap = new Map<string, string>();
    const toUuid = (id: string | null | undefined) => {
      if (!id) return id ?? null;
      if (UUID_RE.test(id)) return id;
      let v = idMap.get(id);
      if (!v) {
        v = crypto.randomUUID();
        idMap.set(id, v);
      }
      return v;
    };

    const stamp = (rows: any[]) => rows.map((r) => ({ ...r, user_id: userId }));
    const fixIds = (r: any) => ({ ...r, id: toUuid(r.id) });
    const fixProspectRef = (r: any) =>
      r.prospect_id !== undefined ? { ...r, prospect_id: toUuid(r.prospect_id) } : r;
    const stripProspect = (r: any) => {
      const { activities, vn_log, ...rest } = r;
      return rest;
    };

    // Map local nanoid-style ids to UUIDs before insert; resolve prospect refs.
    const prospects = stamp(data.prospects).map(fixIds).map(stripProspect);
    const scripts = stamp(data.scripts).map(fixIds).map(fixProspectRef);
    const training = stamp(data.training).map(fixIds);
    const analyses = stamp(data.analyses).map(fixIds).map(fixProspectRef);

    const tables = [
      { name: "prospects" as const, rows: prospects },
      { name: "kpi_entries" as const, rows: stamp(data.kpi) },
      { name: "scripts" as const, rows: scripts },
      { name: "training_sessions" as const, rows: training },
      { name: "prospect_analyses" as const, rows: analyses },
    ];

    for (const t of tables) {
      const del = await supabase.from(t.name).delete().eq("user_id", userId);
      if (del.error) throw new Error(`${t.name} delete: ${del.error.message}`);
      if (t.rows.length) {
        const ins = await supabase.from(t.name).insert(t.rows);
        if (ins.error) throw new Error(`${t.name} insert: ${ins.error.message}`);
      }
    }
    return { ok: true };
  });

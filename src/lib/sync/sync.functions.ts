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

const ProspectRow = z.object({
  id: z.string(),
  name: z.string(),
  profile_url: z.string().nullable().optional(),
  platform: z.string(),
  niche: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  lead_type: z.string(),
  tier: z.string(),
  stage: z.string(),
  qual_score: z.number(),
  bant: z.any(),
  signals: z.any(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  stage_entered_at: z.string(),
  last_touch_at: z.string(),
  // soft extras packed into notes JSON if needed later
  activities: z.any().optional(),
  vn_log: z.any().optional(),
});

const KpiRow = z.object({
  date: z.string(),
  vn_sent: z.number(),
  connections_sent: z.number(),
  connections_accepted: z.number(),
  replies: z.number(),
  active_convos: z.number(),
  calendars_sent: z.number(),
  booked: z.number(),
  shows: z.number(),
  hours: z.number(),
  by_platform: z.any(),
});

const ScriptRow = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  category: z.string().nullable().optional(),
  prospect_id: z.string().nullable().optional(),
  prospect_name: z.string().nullable().optional(),
  niche: z.string().nullable().optional(),
  scenario: z.string().nullable().optional(),
  used: z.boolean(),
  outcome: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
});

const TrainingRow = z.object({
  id: z.string(),
  scenario: z.string(),
  persona: z.string().nullable().optional(),
  transcript: z.any(),
  score: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const AnalysisRow = z.object({
  id: z.string(),
  prospect_id: z.string(),
  stage_at_time: z.string(),
  verdict_line: z.string(),
  suggested_stage: z.string().nullable().optional(),
  next_move: z.string().nullable().optional(),
  draft_message: z.string().nullable().optional(),
  suggested_activity_type: z.string().nullable().optional(),
  reasoning: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  created_at: z.string().optional(),
});

const SyncPayload = z.object({
  prospects: z.array(ProspectRow),
  kpi: z.array(KpiRow),
  scripts: z.array(ScriptRow),
  training: z.array(TrainingRow),
  analyses: z.array(AnalysisRow),
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

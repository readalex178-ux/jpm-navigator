import type { Prospect } from "@/lib/btf/types";

/**
 * Conversation-aware AI context builder (#46).
 * Pure client helper: takes a Prospect and turns it into a tight,
 * model-friendly context block any AI call site can pass through.
 *
 * Keep the format stable — multiple server fns parse this implicitly
 * via the LLM, so changes here change every grounded prompt.
 */
export function buildProspectContext(p: Prospect): string {
  const lines: string[] = [];
  lines.push(`# Prospect: ${p.name}`);
  lines.push(`platform=${p.platform} | tier=${p.tier} | lead=${p.leadType}`);
  lines.push(`stage=${p.stage} (entered ${fmt(p.stageEnteredAt)}) | qualScore=${p.qualScore}`);
  if (p.niche) lines.push(`niche=${p.niche}`);
  if (p.bio) lines.push(`bio=${truncate(p.bio, 400)}`);

  const b = p.bant;
  lines.push(`BANT: need=${b.need} timeline=${b.timeline} authority=${b.authority} budget=${b.budget} (each /2)`);

  const sig = Object.entries(p.signals)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);
  lines.push(`signals_present=${sig.length ? sig.join(",") : "none"}`);

  if (p.followUpAt) lines.push(`follow_up_planned=${p.followUpAt} (${p.followUpReason ?? ""})`);
  lines.push(`last_touch=${fmt(p.lastTouchAt)}`);

  const recentVns = p.vnLog.slice(-3);
  if (recentVns.length) {
    lines.push(`recent_vns:`);
    for (const v of recentVns) {
      lines.push(`  - ${fmt(v.date)} variation=${v.variation} reply=${v.reply}`);
    }
  }

  const recentActs = p.activities.slice(-6);
  if (recentActs.length) {
    lines.push(`recent_activity (newest last):`);
    for (const a of recentActs) {
      const dir = a.fromMe === false ? "←from-prospect" : "→from-me";
      lines.push(`  - ${fmt(a.date)} ${a.type} ${dir} ${truncate(a.notes, 160)}`);
    }
  }

  if (p.notes) lines.push(`sticky_notes: ${truncate(p.notes, 400)}`);

  return lines.join("\n");
}

/** Extract prior VN opener texts for a prospect from the VN script vault. */
export function priorOpenersFor(
  prospectId: string,
  vnScripts: Array<{ prospectId?: string; text: string }>,
  limit = 10,
): string[] {
  return vnScripts
    .filter((s) => s.prospectId === prospectId && s.text?.trim().length)
    .slice(0, limit)
    .map((s) => s.text);
}

function fmt(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

import { STAGE_AGE_LIMIT, type Prospect, type Stage } from "@/lib/btf/types";

export type DueFollowUp = {
  prospect: Prospect;
  dueAt: string; // ISO
  source: "explicit" | "stage-age";
  reason: string;
  overdueDays: number; // 0 = due today, >0 = overdue
};

const MS_DAY = 86_400_000;

/**
 * Compute the list of prospects that need attention right now.
 * Combines two signals:
 *   1. Explicit followUpAt set by the user (or AI suggestion they confirmed).
 *   2. Stage-age threshold from STAGE_AGE_LIMIT — a passive fallback so nothing
 *      slips through if the user never set a reminder.
 *
 * No automation: this is read-only. Surfaces reminders only.
 */
export function getDueFollowUps(
  prospects: Prospect[],
  now: Date = new Date(),
): DueFollowUp[] {
  const nowMs = now.getTime();
  const out: DueFollowUp[] = [];
  for (const p of prospects) {
    // "Found" = haven't connected yet. No follow-up nags until a real
    // connection exists (user moves them out of Found).
    if (p.stage === "Found") continue;
    if (p.followUpAt) {
      const dueMs = new Date(p.followUpAt).getTime();
      if (!Number.isNaN(dueMs) && dueMs <= nowMs) {
        out.push({
          prospect: p,
          dueAt: p.followUpAt,
          source: "explicit",
          reason: p.followUpReason || "Follow-up scheduled",
          overdueDays: Math.max(0, Math.floor((nowMs - dueMs) / MS_DAY)),
        });
        continue;
      }
    }
    const limit = STAGE_AGE_LIMIT[p.stage as Stage];
    if (limit != null) {
      const enteredMs = new Date(p.stageEnteredAt).getTime();
      const ageDays = Math.floor((nowMs - enteredMs) / MS_DAY);
      if (ageDays >= limit) {
        out.push({
          prospect: p,
          dueAt: new Date(enteredMs + limit * MS_DAY).toISOString(),
          source: "stage-age",
          reason: `${p.stage} for ${ageDays}d (limit ${limit}d)`,
          overdueDays: ageDays - limit,
        });
      }
    }
  }
  // Most overdue first; tie-break by qual score.
  out.sort(
    (a, b) =>
      b.overdueDays - a.overdueDays ||
      b.prospect.qualScore - a.prospect.qualScore,
  );
  return out;
}

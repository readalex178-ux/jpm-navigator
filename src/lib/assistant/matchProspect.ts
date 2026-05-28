import type { Prospect } from "@/lib/btf/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

/** Returns prospects that match the query.
 * - exact name (case-insensitive) → single match
 * - otherwise, every prospect whose name CONTAINS any query token (3+ chars)
 */
export function matchProspects(query: string, prospects: Prospect[]): Prospect[] {
  const q = norm(query);
  if (!q) return [];
  const exact = prospects.filter((p) => norm(p.name) === q);
  if (exact.length === 1) return exact;
  const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) {
    return prospects.filter((p) => norm(p.name).startsWith(q)).slice(0, 6);
  }
  const matches = prospects.filter((p) => {
    const n = norm(p.name);
    return tokens.every((t) => n.includes(t));
  });
  // de-dup w/ exact, prefer those whose first name matches
  return matches.slice(0, 6);
}

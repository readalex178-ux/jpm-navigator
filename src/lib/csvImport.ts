import type { Platform, Prospect, Stage, Tier, LeadType } from "./btf/types";
import { PLATFORMS, STAGES } from "./btf/types";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim().length));
}

const validPlatforms = new Set(PLATFORMS.map((p) => p.value));
const validStages = new Set<string>(STAGES as readonly string[]);
const validTiers = new Set(["DIY", "DWY", "DFY"]);
const validLeadTypes = new Set(["Direct", "Referral", "Inbound", "Reactivation"]);

export type ParsedProspect = Partial<Prospect> & { name: string };

export function parseProspectsCsv(text: string): { rows: ParsedProspect[]; errors: string[] } {
  const errors: string[] = [];
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], errors: ["File is empty."] };
  const headers = grid[0].map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n.toLowerCase());
      if (i !== -1) return i;
    }
    return -1;
  };
  const cols = {
    name: idx(["name", "full name", "prospect"]),
    platform: idx(["platform"]),
    profileUrl: idx(["profile url", "url", "link"]),
    niche: idx(["niche", "industry"]),
    leadType: idx(["lead type", "type"]),
    tier: idx(["tier"]),
    stage: idx(["stage", "status"]),
    qualScore: idx(["qual score", "score"]),
    need: idx(["need"]),
    timeline: idx(["timeline"]),
    authority: idx(["authority"]),
    budget: idx(["budget"]),
    bio: idx(["bio", "notes", "description"]),
  };
  if (cols.name === -1) {
    return { rows: [], errors: ["Missing required column: Name"] };
  }
  const rows: ParsedProspect[] = [];
  for (let r = 1; r < grid.length; r++) {
    const get = (i: number) => (i >= 0 ? (grid[r][i] ?? "").trim() : "");
    const name = get(cols.name);
    if (!name) { errors.push(`Row ${r + 1}: missing name, skipped.`); continue; }
    const platform = get(cols.platform).toLowerCase();
    const stage = get(cols.stage);
    const tier = get(cols.tier).toUpperCase();
    const leadType = get(cols.leadType);
    const numOr = (v: string, d: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };
    rows.push({
      name,
      platform: (validPlatforms.has(platform as Platform) ? platform : "linkedin") as Platform,
      profileUrl: get(cols.profileUrl),
      niche: get(cols.niche),
      bio: get(cols.bio),
      leadType: (validLeadTypes.has(leadType) ? leadType : "Direct") as LeadType,
      tier: (validTiers.has(tier) ? tier : "DWY") as Tier,
      stage: (validStages.has(stage) ? stage : "Found") as Stage,
      qualScore: Math.max(0, Math.min(100, numOr(get(cols.qualScore), 0))),
      bant: {
        need: numOr(get(cols.need), 0),
        timeline: numOr(get(cols.timeline), 0),
        authority: numOr(get(cols.authority), 0),
        budget: numOr(get(cols.budget), 0),
      },
    });
  }
  return { rows, errors };
}

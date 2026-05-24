import type { Platform, Prospect, Stage, Tier, LeadType, Activity, VNEntry } from "./btf/types";
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
const validLeadTypes = new Set(["Direct", "Lead Magnet", "Engagement", "Re-Engagement", "Ad Lead", "No Show", "No Close"]);

export type ParsedProspect = Partial<Prospect> & { name: string };

const uid = () => Math.random().toString(36).slice(2, 11);
const yes = (v: string) => /^(y|yes|true|1|x|✓)$/i.test(v.trim());

/** "18/05/2026" or "2026-05-18" -> ISO datetime; falls back to undefined. */
function parseDate(v: string): string | undefined {
  const s = v.trim();
  if (!s) return undefined;
  let d: Date | null = null;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    d = new Date(Date.UTC(year, Number(mm) - 1, Number(dd)));
  } else {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) d = new Date(t);
  }
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
}

/** Map free-form tracker stage labels to canonical Stage. */
function mapStage(raw: string): Stage {
  const s = raw.trim().toLowerCase();
  if (!s) return "Found";
  if (validStages.has(raw)) return raw as Stage;
  if (/request|pending|sent|invite/.test(s) && !/vn/.test(s)) return "Found";
  if (/accept|connect/.test(s)) return "Connected";
  if (/vn ?2|vn2/.test(s)) return "VN2 Sent";
  if (/vn ?1|vn1|voice/.test(s)) return "VN1 Sent";
  if (/repl/.test(s)) return "Replied";
  if (/calendar|booking link/.test(s)) return "Calendar Sent";
  if (/book|call set/.test(s)) return "Call Booked";
  if (/no.?show/.test(s)) return "No Show";
  if (/nurtur/.test(s)) return "Nurturing";
  if (/re.?eng/.test(s)) return "Re-Engaged";
  if (/clos/.test(s)) return "Closed";
  if (/cold|dead|not int|uninter/.test(s)) return "Cold";
  return "Found";
}

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
    date: idx(["date", "created", "created at"]),
    platform: idx(["platform"]),
    profileUrl: idx(["profile url", "url", "link"]),
    niche: idx(["niche / market", "niche", "industry", "market"]),
    leadType: idx(["outreach type", "lead type", "type"]),
    tier: idx(["tier"]),
    stage: idx(["stage", "status"]),
    qualScore: idx(["qual score", "score"]),
    need: idx(["need"]),
    timeline: idx(["timeline"]),
    authority: idx(["authority"]),
    budget: idx(["budget"]),
    bio: idx(["bio", "description"]),
    notes: idx(["notes", "note"]),
    vn1: idx(["vn1 sent", "vn1"]),
    vn2: idx(["vn2 sent", "vn2"]),
    replied: idx(["replied?", "replied", "reply"]),
    booked: idx(["booked?", "booked"]),
    followUp: idx(["follow-up due", "follow up due", "followup due"]),
  };
  if (cols.name === -1) return { rows: [], errors: ["Missing required column: Name"] };

  const rows: ParsedProspect[] = [];
  for (let r = 1; r < grid.length; r++) {
    const get = (i: number) => (i >= 0 ? (grid[r][i] ?? "").trim() : "");
    const name = get(cols.name);
    if (!name) { errors.push(`Row ${r + 1}: missing name, skipped.`); continue; }
    const platform = get(cols.platform).toLowerCase();
    const stageRaw = get(cols.stage);
    const tier = get(cols.tier).toUpperCase();
    const leadTypeRaw = get(cols.leadType);
    const numOr = (v: string, d: number) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
    const bant012 = (v: string): 0 | 1 | 2 => Math.max(0, Math.min(2, Math.round(numOr(v, 0)))) as 0 | 1 | 2;

    const createdAt = parseDate(get(cols.date));
    const notesText = get(cols.notes) || get(cols.bio);
    const followUp = get(cols.followUp);

    // Derive stage from flags if explicit stage is weak.
    let stage = mapStage(stageRaw);
    const vn1Flag = yes(get(cols.vn1));
    const vn2Flag = yes(get(cols.vn2));
    const repliedFlag = yes(get(cols.replied));
    const bookedFlag = yes(get(cols.booked));
    if (bookedFlag) stage = "Call Booked";
    else if (vn2Flag) stage = "VN2 Sent";
    else if (repliedFlag && stage !== "VN2 Sent") stage = "Replied";
    else if (vn1Flag && stage === "Found") stage = "VN1 Sent";

    // Build activity + VN log from the flags so the timeline reflects history.
    const dateBase = createdAt ?? new Date().toISOString();
    const activities: Activity[] = [];
    const vnLog: VNEntry[] = [];
    if (vn1Flag) {
      vnLog.push({ id: uid(), date: dateBase, variation: "VN1", reply: repliedFlag ? "VN" : "none" });
      activities.push({ id: uid(), date: dateBase, type: "VN", notes: "VN1 sent (import)", fromMe: true });
    }
    if (repliedFlag) activities.push({ id: uid(), date: dateBase, type: "note", notes: "Prospect replied (import)", fromMe: false });
    if (vn2Flag) {
      vnLog.push({ id: uid(), date: dateBase, variation: "VN2", reply: "none" });
      activities.push({ id: uid(), date: dateBase, type: "VN", notes: "VN2 sent (import)", fromMe: true });
    }
    if (bookedFlag) activities.push({ id: uid(), date: dateBase, type: "note", notes: "Call booked (import)", fromMe: true });
    if (followUp) activities.push({ id: uid(), date: dateBase, type: "note", notes: `Follow-up due: ${followUp}`, fromMe: true });

    rows.push({
      name,
      platform: (validPlatforms.has(platform as Platform) ? platform : "linkedin") as Platform,
      profileUrl: get(cols.profileUrl),
      niche: get(cols.niche),
      bio: notesText,
      leadType: (validLeadTypes.has(leadTypeRaw) ? leadTypeRaw : "Direct") as LeadType,
      tier: (validTiers.has(tier) ? tier : "DWY") as Tier,
      stage,
      qualScore: Math.max(0, Math.min(100, numOr(get(cols.qualScore), 0))),
      bant: {
        need: bant012(get(cols.need)),
        timeline: bant012(get(cols.timeline)),
        authority: bant012(get(cols.authority)),
        budget: bant012(get(cols.budget)),
      },
      activities,
      vnLog,
      createdAt,
      stageEnteredAt: createdAt,
      lastTouchAt: createdAt,
    });
  }
  return { rows, errors };
}

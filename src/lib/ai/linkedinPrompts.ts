import type { ScrapedThread, ScrapedProfile } from "../extension/types";
import type { Prospect } from "../btf/types";

export type LinkedinAction = "connect" | "reply" | "followup" | "vn" | "objection";

export const ACTION_META: Record<LinkedinAction, { label: string; description: string }> = {
  connect: {
    label: "Connection note",
    description: "Sub-300 char invite that references a specific signal.",
  },
  reply: {
    label: "DM reply",
    description: "Matches their format/length/tone, ends with one question.",
  },
  followup: {
    label: "Follow-up",
    description: "Picks the next BTF sequence step based on time since last touch.",
  },
  vn: {
    label: "Voice note script",
    description: "30–60s spoken format with pacing cues, talking points only.",
  },
  objection: {
    label: "Objection handler",
    description: "BTF rebuttal for price/info/system/timing pushback.",
  },
};

const profileBlock = (p?: ScrapedProfile) => {
  if (!p) return "PROFILE: not yet scraped.";
  return `PROFILE:
Name: ${p.name}
Headline: ${p.headline ?? "—"}
Role: ${p.currentRole ?? "—"}
Location: ${p.location ?? "—"}
About: ${p.about ?? "—"}`;
};

const threadBlock = (t?: ScrapedThread) => {
  if (!t || !t.messages.length) return "THREAD: no conversation yet.";
  const lines = t.messages
    .slice(-12)
    .map((m) => `${m.sender === "me" ? "ME" : "PROSPECT"} (${m.timestamp}): ${m.text}`)
    .join("\n");
  return `THREAD with ${t.participantName}:
${lines}`;
};

const prospectBlock = (p?: Prospect) => {
  if (!p) return "LINKED PROSPECT: none.";
  return `LINKED PROSPECT:
Stage: ${p.stage} · Tier: ${p.tier} · LeadType: ${p.leadType}
Niche: ${p.niche}
BANT: need ${p.bant.need}/2, timeline ${p.bant.timeline}/2, authority ${p.bant.authority}/2, budget ${p.bant.budget}/2
Qual score: ${p.qualScore}/100`;
};

export function buildPrompt(
  action: LinkedinAction,
  ctx: { thread?: ScrapedThread; profile?: ScrapedProfile; prospect?: Prospect; daysSinceTouch?: number },
): string {
  const base = `${profileBlock(ctx.profile)}

${threadBlock(ctx.thread)}

${prospectBlock(ctx.prospect)}`;

  switch (action) {
    case "connect":
      return `${base}

TASK: Write a LinkedIn connection request note. HARD LIMIT 280 characters. Reference ONE specific detail from their profile (headline/role/about). No pitch. End with a soft hook (curiosity question or compliment + observation). Match their tone. Output ONLY the note text — no preface, no quotes.`;

    case "reply":
      return `${base}

TASK: Write the next DM reply. Match the prospect's last message format and length. End with EXACTLY one question that advances toward a call. No pitch. No emojis unless they used them. Output ONLY the message text.`;

    case "followup":
      return `${base}

TIME SINCE LAST TOUCH: ${ctx.daysSinceTouch ?? "unknown"} days.

TASK: Write a follow-up message. Pick the right BTF sequence step (Day 3 = soft check-in VN style, Day 7 = value drop / villain frame on ads, Day 12 = direct text "still want me to send the loom?"). Escalate value, never desperation. Output ONLY the message.`;

    case "vn":
      return `${base}

TASK: Write a 30–60 second VOICE NOTE SCRIPT. Format as spoken talking points with pacing cues in brackets like [pause], [smile], [lower energy], [hit harder]. NEVER reads like a script being read — sounds conversational. Open with their name + one specific observation. Middle: villain frame on slow ads/referrals-only. Close: ask if they want to see how it works on a 15-min call. Output ONLY the script with cues inline.`;

    case "objection":
      return `${base}

TASK: Detect the objection in the prospect's last 1–2 messages (price, "send info", "have a system", "not now", or other). State the objection in one line at the top: "OBJECTION: <type>". Then write the BTF rebuttal — short, doesn't fight, reframes, ends with one question that re-opens. Output the OBJECTION line then the message.`;
  }
}

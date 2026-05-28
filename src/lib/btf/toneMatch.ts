import type { Prospect } from "@/lib/btf/types";

export type ToneStatus = "matching" | "warm" | "cold" | "unknown";

export type ToneVerdict = {
  status: ToneStatus;
  label: string;
  /** One-sentence "why this status" diagnosis */
  reason: string;
  /** Concrete wording / format guidance for the next touch */
  suggestion: string;
  /** Optional opener the setter can lift verbatim */
  openerExample?: string;
};

const MS_DAY = 86_400_000;

/**
 * Read prospect signals (VN replies, last activity sender, recency) and return
 * a structured tone-match verdict. Pure read-only — no state mutation.
 *
 * Rules (mirrors src/lib/ai/btfFramework.ts):
 *   - They VN → you VN
 *   - They text → send ONE more VN (most reply text out of habit)
 *   - They text again → switch to text
 *   - After 2 VNs from you with text-only replies → match their format
 *   - No reply 3+ days after your last touch → cold, change pattern
 */
export function getToneVerdict(p: Prospect, now: Date = new Date()): ToneVerdict {
  const vns = p.vnLog ?? [];
  const lastVN = vns[0];
  const myVNCount = vns.length;
  const theirTextReplies = vns.filter((v) => v.reply === "text").length;
  const theirVNReplies = vns.filter((v) => v.reply === "VN").length;

  // Activity-based recency
  const acts = p.activities ?? [];
  const lastAct = acts[0];
  const lastFromProspect = acts.find((a) => a.fromMe === false);
  const daysSinceTouch = Math.floor((now.getTime() - new Date(p.lastTouchAt).getTime()) / MS_DAY);
  const daysSinceTheirReply = lastFromProspect
    ? Math.floor((now.getTime() - new Date(lastFromProspect.date).getTime()) / MS_DAY)
    : null;

  // ---- Cold: they've ghosted us ----
  if (daysSinceTouch >= 3 && (!daysSinceTheirReply || daysSinceTheirReply >= 3)) {
    return {
      status: "cold",
      label: "Cold",
      reason: `${daysSinceTouch}d since last touch${daysSinceTheirReply != null ? `, ${daysSinceTheirReply}d since they last replied` : " and no reply on record"}. Pattern is dead.`,
      suggestion:
        "Break the format. If you were sending VNs, send ONE short text. If text, drop a single 7-second VN with a fresh angle — reference something specific from their profile or last reply, not the same offer.",
      openerExample:
        "Hey {name} — wasn't sure if my last note landed. Quick one: still {their goal}? If not the right time just say so, no stress.",
    };
  }

  // ---- They text after 2+ VNs from us → switch ----
  if (myVNCount >= 2 && theirTextReplies >= 2 && theirVNReplies === 0) {
    return {
      status: "warm",
      label: "Text them",
      reason: `You've sent ${myVNCount} VNs and they've replied with text ${theirTextReplies}× without ever sending a VN back. They prefer typing.`,
      suggestion:
        "Switch to text. Match their length and casing — short = short, lowercase = lowercase. Keep it skimmable, one question max, calendar link only if they've shown clear intent.",
    };
  }

  // ---- They VN'd us → mirror VN ----
  if (lastVN?.reply === "VN" || theirVNReplies >= 1) {
    return {
      status: "matching",
      label: "VN back",
      reason: `They sent ${theirVNReplies} VN${theirVNReplies === 1 ? "" : "s"} back. Format is locked in.`,
      suggestion:
        "Reply with a VN. Match their energy and pace — if they were 20s, you go 20-30s. Open by referencing the specific thing they said, not a generic 'great to hear from you'.",
      openerExample:
        "Hey {name} — picking up on what you said about {their point}, here's the move I'd run...",
    };
  }

  // ---- They text once after a VN → send ONE more VN, then match ----
  if (lastVN?.reply === "text" && myVNCount <= 1) {
    return {
      status: "warm",
      label: "One more VN",
      reason:
        "They replied with text after your VN — most do this out of habit. Rule: send one more VN before switching format.",
      suggestion:
        "Send ONE more VN, short (15-25s). Acknowledge their text reply by name, then ask the one qualifying question that earns the calendar.",
    };
  }

  // ---- No reply yet to your last VN, still inside the patience window ----
  if (lastVN && lastVN.reply === "none" && daysSinceTouch < 3) {
    return {
      status: "warm",
      label: "Wait + nudge",
      reason: `Last VN sent ${daysSinceTouch}d ago, no reply yet — still inside the 3-day patience window.`,
      suggestion:
        "Don't double-tap. If they don't reply by day 3, switch format (text if you VN'd, VN if you texted) with a specific reference to their last public post or update.",
    };
  }

  // ---- No VNs logged yet, just text/comments ----
  if (myVNCount === 0 && lastAct) {
    const fromMe = lastAct.fromMe !== false;
    return {
      status: "unknown",
      label: "No VN baseline yet",
      reason: `No VNs on record. Last touch was ${fromMe ? "from you" : "from them"} (${lastAct.type}).`,
      suggestion:
        "Send the first VN to establish a baseline. Their reply format on a VN is what tells you whether to stay on voice or move to text.",
    };
  }

  return {
    status: "unknown",
    label: "Read the room",
    reason: "Not enough signal to lock a pattern yet.",
    suggestion:
      "Open with a VN. Their reply format sets the tone — VN back = stay on voice, text back = one more VN then mirror.",
  };
}

// BTF playbook constants — canonical objection / re-engagement / warm-signal / pre-screen copy.
// Single source of truth for the Objection Handler, Re-engagement Alerts, Warm Signal Alert,
// and Pre-Screen Call Assistant features.

export type ObjectionId =
  | "no_time"
  | "already_have_system"
  | "how_much"
  | "is_this_sales"
  | "not_interested"
  | "send_info";

export const OBJECTIONS: { id: ObjectionId; label: string; trigger: string; response: string }[] = [
  {
    id: "no_time",
    label: "No time",
    trigger: "“I don't have time / too busy right now.”",
    response:
      "Totally get it — this would literally be 15 minutes. No pitch, no pressure. Just a quick look to see if it's even relevant for where you're at. If it's not, you've lost 15 minutes. If it is, it could change how you bring in clients for the next 12 months. Want me to send a couple of times?",
  },
  {
    id: "already_have_system",
    label: "Already have a system",
    trigger: "“We already have something in place / I've got my own system.”",
    response:
      "That's great — honestly most people we talk to do too. This isn't about replacing what's working, it's specifically for people who want to add a conversation-led layer on top of what they're already running. Out of curiosity, what's your current system bringing in per month right now?",
  },
  {
    id: "how_much",
    label: "How much does it cost",
    trigger: "“What does it cost / how much is it?”",
    response:
      "Good question — the advisor goes over pricing on the call because there are a few different options depending on where you're at and how hands-on you want us to be. The call itself is free, 15 minutes, no pressure. Want me to send some times?",
  },
  {
    id: "is_this_sales",
    label: "Is this a sales call",
    trigger: "“Is this a sales call?”",
    response:
      "Fair question — it's more of a fit call. They ask you some questions about your business, show you how the system works, and you decide if it makes sense. No pitch, no hard close. If it's a fit, great. If not, you walk away with a clearer picture of your acquisition setup.",
  },
  {
    id: "not_interested",
    label: "Not interested",
    trigger: "“Not interested / not for me.”",
    response:
      "Totally fair — no worries at all. Out of curiosity, what's your current focus for bringing in clients? Always good to know what's actually working out there.",
  },
  {
    id: "send_info",
    label: "Send me info",
    trigger: "“Can you send me more info / a link / a deck?”",
    response:
      "Happy to — honestly the quickest way is a 15-minute call, it'll make more sense in context. But I can send something over in the meantime. What's most important for you right now — more leads, better quality leads, or higher show rate?",
  },
];

/* =========================
 * Re-engagement (5–10 days no reply)
 * ========================= */
export type ReengageVariant = {
  id: string;
  label: string;
  windowDays: string; // descriptive
  text: string;
};

export const REENGAGE_SCRIPTS: ReengageVariant[] = [
  {
    id: "soft_bump",
    label: "Soft bump (Day 5–7)",
    windowDays: "5-7",
    text: "Hey — totally get if this got buried. Just wanted to bump my last note to the top of your inbox in case it slipped past. Worth a quick look or should I leave you to it?",
  },
  {
    id: "value_drop",
    label: "Value drop (Day 7–10)",
    windowDays: "7-10",
    text: "Hey — no stress on the silence, I know inboxes are brutal. Quick context in case it's useful: we've been seeing the founders we work with book 4–8 qualified calls a week purely off conversation outreach, no ads. If that's even mildly interesting, happy to walk you through how it works on a 15-min call. If not, all good.",
  },
  {
    id: "breakup",
    label: "Break-up (Day 10+)",
    windowDays: "10+",
    text: "Hey — going to leave it here so I'm not clogging your inbox. If pipeline ever becomes a priority, my door's open. Wishing you a strong rest of the quarter either way.",
  },
];

/* =========================
 * Warm signal inbound (act within 60s)
 * ========================= */
export type WarmSignal = {
  id: string;
  label: string;
  trigger: string;
  script: string;
};

export const WARM_SIGNALS: WarmSignal[] = [
  {
    id: "story_reply",
    label: "Story reply / DM reaction",
    trigger: "They replied to your story or reacted to a post.",
    script:
      "Hey — appreciate you jumping in on that. Quick voice note feels easier than typing a wall of text. We've been working with 19 founders helping them bring in clients through more direct, one-on-one conversations without leaning on ads. Curious — what's been working for you lately on the client acquisition side?",
  },
  {
    id: "post_comment",
    label: "Post comment",
    trigger: "They commented on your content.",
    script:
      "Hey — really appreciated your take on that post. I had a feeling you'd resonate with it. Out of curiosity, what's your current focus for bringing in clients right now? Always interested in what's working for people in your world.",
  },
  {
    id: "profile_view",
    label: "Profile view / connection accept",
    trigger: "They viewed your profile or accepted your connect.",
    script:
      "Hey — thanks for the connect. Figured I'd send a quick voice note instead of a wall of text. We've been working with 19 founders and service providers helping them bring in clients through more direct, one-on-one conversations — no paid ads, no overly complicated funnels. Open to me telling you how it works?",
  },
  {
    id: "follow",
    label: "New follow",
    trigger: "They followed you.",
    script:
      "Hey — appreciate the follow. Saw what you do and figured I'd reach out properly. We help founders in your space bring in clients through one-on-one conversations rather than paid ads. Worth a quick chat?",
  },
];

/* =========================
 * Pre-Screen Call Assistant
 * ========================= */

export type PreScreenDecision = "use_prescreen" | "skip_to_calendar" | "more_qualifying";

export function recommendPreScreen(input: {
  qualifiers: { decisionMaker: number; hasOffer: number; earningSomething: number; wantsMore: number };
  predictedTier: "DIY" | "DWY" | "DFY" | "unknown";
  hasObjection: boolean;
}): { decision: PreScreenDecision; reason: string } {
  const q = input.qualifiers;
  const yesCount = [q.decisionMaker, q.hasOffer, q.earningSomething, q.wantsMore].filter((v) => v === 1).length;
  const unknownCount = [q.decisionMaker, q.hasOffer, q.earningSomething, q.wantsMore].filter((v) => v === -1).length;

  if (input.hasObjection) {
    return {
      decision: "more_qualifying",
      reason: "Live objection on the table — handle that first, don't move to booking yet.",
    };
  }
  if (yesCount === 4 && input.predictedTier !== "DIY") {
    return {
      decision: "skip_to_calendar",
      reason: "All 4 qualifiers green and tier is DWY/DFY — send the calendar link directly, don't add friction.",
    };
  }
  if (yesCount >= 3 && unknownCount <= 1) {
    return {
      decision: "use_prescreen",
      reason: "Strong fit but 1 unknown — a 5-min pre-screen confirms it before the closer's slot is burned.",
    };
  }
  return {
    decision: "more_qualifying",
    reason: "Fewer than 3 confirmed qualifiers — keep the conversation going before offering any call.",
  };
}

export const PRESCREEN_SCRIPT = `PRE-SCREEN CALL SCRIPT (5 minutes, casual, conversational)

Opener
"Hey [first name], thanks for jumping on. This is super quick — just want to make sure we're a fit before I waste your time with the full call. Cool?"

1. Confirm authority
"Just to double-check — are you the one making the call on bringing on something like this, or is there a partner involved?"

2. Confirm offer + revenue
"Tell me a bit about what you're selling right now and roughly what kind of clients you're bringing in monthly."

3. Confirm intent
"What's pushing you to look at this now versus six months from now?"

4. Confirm budget reality (soft)
"Without getting into pricing yet — for context, our options range from a self-serve at around $1k up to a full done-for-you at around $12k. Is that the ballpark you'd consider if it solved the problem?"

5. Book the real call
"Cool — based on that you're a fit. Let me grab you a slot with [closer name] this week. They'll walk through how it actually works and the right option for where you're at. Does Wednesday at 2 or Thursday at 11 work?"`;

export const SKIP_TO_CALENDAR_SCRIPT = `SKIP-PRE-SCREEN MESSAGE (drop calendar link straight in)

"Cool — based on what you've shared you're definitely a fit. Here's the link to grab a 15-min slot with [closer name]: {{CALENDAR_LINK}}

Pick whatever works — they'll walk you through how it actually works and the right option for where you're at. No pitch, no pressure."`;

/* =========================
 * GHL Claim Checklist
 * ========================= */
export const GHL_CHECKLIST_STEPS = [
  "Find the contact in GHL by name or LinkedIn URL",
  "Add setter attribution (your name in the setter field)",
  "Move the pipeline stage to Call Booked",
  "Add a closer note with context (objection raised, tier predicted, hook used)",
  "Confirm the set in the #sets Slack channel with prospect name + time",
] as const;

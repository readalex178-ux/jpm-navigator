// BTF playbook constants — single source of truth for every script, rule,
// sequence, market variation, KPI target, and objection handler in the
// Behind the Funnel Setter Hub. Verbatim content from the internal BTF
// Setter Hub reference doc by JPM Media.

/** Locked at 19 across every script. Do NOT change. */
export const CLIENT_COUNT = 19;

/** Non-negotiable rules — applied across every VN/text the app suggests, drafts or audits. */
export const BTF_NON_NEGOTIABLES: { rule: string; detail: string }[] = [
  { rule: "Voice first — always.", detail: "First DM after connecting is ALWAYS a voice note. VN before text, every time." },
  { rule: "Never pitch the offer in VN1.", detail: "No product name, no podcast mention, no pricing. Curiosity only." },
  { rule: "Never ask for a call in VN1.", detail: "Soft close only: 'open to hearing how it works?' — not 'book a call'." },
  { rule: "Client count is always 19.", detail: "Every script references 19 founders / service providers. Do not change this number." },
  { rule: "Never two VNs in a row if they're texting back.", detail: "Send one more VN after their first text — if they text again, match and switch to text." },
  { rule: "Never leave a reply dry.", detail: "Every reply gets a reply. Nothing falls through the cracks." },
  { rule: "One question per message — always.", detail: "Two questions = silence." },
  { rule: "Always have a next step.", detail: "Never leave an exchange open-ended." },
  { rule: "Personalise every send.", detail: "60 seconds of research pays every time. No exceptions." },
  { rule: "Max 150 words on any VN.", detail: "Hard stop — LinkedIn VN feature has a 60-second timer." },
];


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
  "Find the contact in GHL by name or LinkedIn URL — create one if they don't exist with name, platform, how you connected.",
  "Add yourself as the setter in the setter attribution field — this ties the booking back to you for commission.",
  "Move them to the 'Call Booked' pipeline stage. Do not skip this step.",
  "Add a closer note with context: platform used, pain point, objection raised, tier predicted, hook used. 2–3 sentences.",
  "Confirm the booking in the #sets Slack channel with your daily LinkedIn connections screenshot: 'booked one, claimed in GHL.'",
] as const;

/* =========================
 * OFFER TIERS & COMMISSION
 * ========================= */
export const OFFER_TIERS = [
  { tier: "DIY" as const, price: 997, commissionLow: 50, commissionHigh: 100, notes: "Good for volume, easy convo" },
  { tier: "DWY" as const, price: 2997, commissionLow: 150, commissionHigh: 300, notes: "Mid-ticket, stronger close rate" },
  { tier: "DFY" as const, price: 11997, commissionLow: 600, commissionHigh: 1200, notes: "Best commission, qualify harder" },
];

export const COMMISSION_RULES = [
  "Commission is paid monthly. Rate is 10% of the deal value for every call you book that closes.",
  "You MUST claim your set in GHL immediately after booking — no GHL claim = no commission, no exceptions.",
  "Maintain your own personal tracker in Google Sheets or Notion as a backup.",
  "GHL (official) + your own log (personal) is the correct setup.",
];

/* =========================
 * ICP — GREEN FLAGS / RED FLAGS / PRIORITY MARKETS
 * ========================= */
export const PRIORITY_MARKETS = [
  "AI Consultants",
  "AI Educators",
  "Community Builders",
  "Fractional Executives",
];

export const ICP_GREEN_FLAGS = [
  "Coaches / consultants in bio or headline",
  "Posts about expertise (even low engagement)",
  "Sells services $500–$20K+ per client",
  "1–10 employees / solo founder",
  "English-speaking (US, CA, UK, AU, NZ)",
  "Active: posted in last 30 days",
  "No clear client acquisition system visible",
  "★ AI Consultants / AI Educators",
  "★ Community Builders",
  "★ Fractional Executives",
];

export const ICP_RED_FLAGS = [
  "E-commerce / product businesses",
  "Pure job seekers (employee mindset)",
  "MLM / network marketing",
  "Already running strong outbound",
  "Under 500 followers + completely inactive",
  "Non-English or outside target regions",
  "B2C only (fitness clients, students)",
];

export const BUYING_SIGNALS_PROFILE = [
  "Featured section with a program or offer",
  "Services page or 'Open to' flag on LinkedIn",
  "Booking link or Linktree in bio",
  "'I help [X]' in bio",
];
export const BUYING_SIGNALS_CONTENT = [
  "Posts that say 'referrals only' or 'word of mouth'",
  "Talks about struggling to get clients",
  "Shares client results (proof of offer)",
  "Posts about growing their business",
];
export const BUYING_SIGNALS_PAIN = [
  "'Slow month' type posts",
  "'Looking to scale' or 'need more clients'",
  "'Inconsistent income' language",
  "No visible outbound system",
];

export const KEYWORDS_TITLES = [
  "Business Coach", "Life Coach", "Executive Coach", "Marketing Consultant",
  "Sales Consultant", "Fractional CMO", "Fractional CFO", "Advisor",
  "Founder", "Speaker", "AI Consultant", "AI Educator", "Community Builder",
];
export const KEYWORDS_PAIN = [
  "referrals only", "word of mouth", "slow month", "struggling to get clients",
  "inconsistent income", "need more clients", "want to scale", "grow my business",
];

/* =========================
 * DAILY RHYTHM
 * ========================= */
export const DAILY_RHYTHM: { block: string; minutes?: string; items: string[] }[] = [
  {
    block: "Morning",
    minutes: "15–30 min",
    items: [
      "Open LinkedIn and check every active thread before you do anything else",
      "Reply to every message that came in — voice note if they're engaging, text if text-only",
      "If someone asked a question or showed interest, move them forward immediately",
    ],
  },
  {
    block: "Outreach Block",
    items: [
      "Max out your connection requests (25/day weeks 1–2, then scale)",
      "Use the keyword list to find the right prospects — don't just connect randomly",
      "Blank invite only — no message with the connection request",
    ],
  },
  {
    block: "Voice Notes Block",
    items: [
      "Check who accepted your requests from yesterday and today",
      "Use the AI Script Generator to prep your personalised script before recording",
      "Read the script out loud once before hitting record",
      "Send it. Imperfect and sent beats perfect sitting in drafts.",
    ],
  },
  {
    block: "Throughout the Day",
    items: [
      "Check LinkedIn every couple of hours — conversations move fast",
      "When someone's ready to book, get the calendar link in front of them immediately",
      "Log every new conversation in the tracking sheet at end of day",
    ],
  },
];

/* =========================
 * LINKEDIN OUTREACH SEQUENCE
 * ========================= */
export const LINKEDIN_RAMP = [
  { phase: "Weeks 1–2", detail: "25 connections/day maximum. Stay conservative while your account warms up." },
  { phase: "After 2 weeks", detail: "Push to find your limit. LinkedIn warns you when you've hit your cap — stop there." },
  { phase: "Hard cap", detail: "Roughly 100–150 requests/week. LinkedIn tracks weekly volume, not just daily." },
  { phase: "If restricted", detail: "Slow down immediately. Do not push through warnings." },
];

export const LINKEDIN_SEQUENCE = [
  { day: "Day 1", action: "Blank connection request", detail: "No note. Blank invite converts better. Personalisation comes in the voice note after they accept." },
  { day: "Day 3", action: "🎤 Voice Note #1", detail: "First DM is ALWAYS a voice note. Use the Master Script. Reference something specific. 55 seconds max. Soft CTA." },
  { day: "Day 7", action: "🎤 Voice Note #2", detail: "If no reply. Brief callback + new social proof or curiosity angle. Under 30 seconds. Example: 'One of our clients in [niche] just hit 15K from cold outreach — thought of you.'" },
  { day: "Day 12", action: "Final text", detail: "If still no reply. One short text, leave door open, then move on." },
];

/* =========================
 * MASTER SCRIPTS — VERBATIM
 * ========================= */

/** The full Master Voice Note #1 script — verbatim from the doc. */
export const MASTER_VN1_SCRIPT = `Hey [Name], hope you're doing well. I thought I'd send a quick voice note so you wouldn't have to read a whole essay.

I wanted to reach out because I saw you're [insert what they're building/doing], and I thought there could be a pretty interesting fit here.

We've been working a lot in the lead gen and funnel development space, and we've developed a system that helps businesses get clients through more meaningful conversations, build a stronger foundation for inbound leads, and also build credibility in the market, which is obviously huge in spaces where trust matters before someone buys.

The reason we built it this way is because I've just seen such a massive influx of people pushing super expensive paid ad campaigns, bloated retainers, and all these lead gen tactics that make growth feel way more complicated and expensive than it should be. So we wanted to create something that was a lot more cost effective, but still actually helped bring the right people in the door.

We've already implemented this with 19 other [industry], and since you're in a space that depends heavily on trust and credibility before someone makes a decision, I really think this kind of approach could work well for you. Especially in terms of getting more qualified conversations going while keeping your costs down.

Would be happy to share a bit more if that sounds useful. Happy to chat.`;

/** Day 7 follow-up VN — verbatim. */
export const VN2_FOLLOWUP_SCRIPT = `Hey [Name] — just circling back on the voice note I sent the other day. One of our clients in [niche] just hit 15K from cold outreach with this system — thought of you. Worth a quick look?`;

/** Day 12 final text — verbatim. */
export const DAY12_FINAL_TEXT = `Hey [Name] — wanted to follow up one last time. If timing's off, completely fine. Happy to reconnect whenever it makes sense.`;

/** Worked example — Ira Bodnar VN (118 words). */
export const EXAMPLE_VN_IRA = `Hey Ira, figured I'd send a quick voice note so you didn't have to read a whole book here.

Came across your profile — the work you're doing with Ryze AI is interesting, specifically the angle that most marketers are still copy-pasting data into ChatGPT while you're wiring Claude directly into live ad accounts to actually execute, not just advise. That's a different level.

We've been working with 19 founders and service providers helping them bring in clients through more direct, one-on-one conversations — without relying on paid ads or anything overly complicated.

It's worked really well especially for founders in the AI and martech space where there's a lot of noise and credibility matters before anyone commits.

Let me know if you're open to hearing how it works?`;

/* =========================
 * VN SCRIPT STRUCTURE & WHY-EACH-LINE-WORKS
 * ========================= */
export const VN_SCRIPT_STRUCTURE = [
  { step: "1. Hook", text: `"Hey [First name], figured I'd send a quick voice note so you didn't have to read a whole book here."` },
  { step: "2. Personalisation", text: "2–3 sentences referencing something specific from their profile." },
  { step: "3. Bridge", text: `"We've been working with 19 founders and service providers helping them bring in clients through more direct, one-on-one conversations — without relying on paid ads or anything overly complicated."` },
  { step: "4. Relevance", text: "1 sentence connecting briefly to their world." },
  { step: "5. Close (Default)", text: `"Let me know if you're open to hearing how it works?"` },
  { step: "5. Close (Qualifying)", text: `Use ONLY if they clearly have a strong inbound pipeline: "Just curious — how are you currently bringing in most of your clients?"` },
];

export const WHY_EACH_LINE_WORKS = [
  { line: "Opener (3–5 sec)", reason: "The moment they hear a real voice, you've separated yourself from 95% of outreach. 'Voice note instead of an essay' sets a low-effort expectation — they relax before you say anything about business." },
  { line: "Why You're Reaching Out (5–8 sec)", reason: "'Interesting fit' is intentionally vague — it creates curiosity without making a claim. They want to know what the fit is. That curiosity is the open door. Don't over-explain." },
  { line: "The Context (10–15 sec)", reason: "You're speaking directly to what they care about: getting clients, building credibility, being trusted in their market. 'Trust matters before someone buys' mirrors back something they already believe." },
  { line: "Contrast / Villain Frame (5–8 sec)", reason: "Name the things they've been sold that didn't work. Almost every founder has been pitched expensive ads or a bloated retainer. When you call that out, they instantly think 'yes, exactly.'" },
  { line: "Social Proof + Soft CTA (8–10 sec)", reason: "'19 other [industry]' gives social proof without bragging. Close is soft on purpose: 'happy to share a bit more' not 'book a call with me.' You're not asking them to commit to anything — just to keep talking." },
];

/* =========================
 * TONE MATCHING RULES
 * ========================= */
export const TONE_MATCHING_RULES = [
  { trigger: "They reply by VN", response: "Match it. Reply with a voice note. Keep energy going." },
  { trigger: "They reply by text", response: "Don't switch yet — send one more voice note. Most reply by text out of habit." },
  { trigger: "They text again", response: "Now match them. Switch to text. The convo is still alive." },
  { trigger: "They're ready to book", response: "Send calendar link by text regardless of medium. A link is cleaner to click." },
  { trigger: "After 2 VNs if still texting", response: "Switch to matching their format. You've done your job." },
];

/* =========================
 * AI SCRIPT GENERATOR PROMPT — paste verbatim into ChatGPT / Gemini
 * ========================= */
export const AI_SCRIPT_GENERATOR_PROMPT = `You are writing a personalised LinkedIn voice-note script for a setter at Behind the Funnel (BTF). I will paste the prospect's full LinkedIn profile copy directly after this prompt.

HARD RULES — do NOT break any of these:
- Max 150 words. Hard stop. LinkedIn VN has a 60-second timer.
- Script only. No explanation, no preamble. Just the words, start to finish.
- Ready to record. No brackets, no placeholders, no blanks to fill in.
- Casual & human. Zero filler. No corporate speak. Write like a real person.
- One specific observation from their profile — not generic.
- Never pitch the offer. No product name. No podcast mention. Curiosity only.
- Client count = 19. Always. Do not change this number.

STRUCTURE (in this order):
1. HOOK — "Hey [First name], figured I'd send a quick voice note so you didn't have to read a whole book here."
2. PERSONALISATION — 2–3 sentences referencing something specific from their profile.
3. BRIDGE — "We've been working with 19 founders and service providers helping them bring in clients through more direct, one-on-one conversations — without relying on paid ads or anything overly complicated."
4. RELEVANCE — 1 sentence connecting briefly to their world.
5. CLOSE (default) — "Let me know if you're open to hearing how it works?"
   CLOSE (qualifying, only if they clearly have a strong inbound pipeline) — "Just curious — how are you currently bringing in most of your clients?"

Now write the script using the pasted profile below. Output the script only — no headers, no labels, no notes.`;

/* =========================
 * MARKET VARIATIONS — niche, trust line, pain line, VN tip
 * ========================= */
export type MarketVariation = {
  industry: string;
  niche: string;
  trustLine: string;
  painLine: string;
  vnTip: string;
};

export const MARKET_VARIATIONS: MarketVariation[] = [
  {
    industry: "AI Consultants & AI Educators",
    niche: "Helping businesses integrate AI / teaching AI skills",
    trustLine: "…especially in the AI space, where trust and credibility matter a lot before anyone commits to working with someone",
    painLine: "I know the AI space moves fast — this system keeps qualified conversations flowing without the noise",
    vnTip: "Reference a recent post, the platform they teach on, or a specific AI use-case they champion.",
  },
  {
    industry: "Community Builders",
    niche: "Building and monetising an engaged community",
    trustLine: "…in the community space, word of mouth only gets you so far before you need a real pipeline",
    painLine: "Most community builders rely on organic growth — this adds a conversation layer that fills the gaps",
    vnTip: "Reference their community name, a recent post about member results, or a challenge they're running.",
  },
  {
    industry: "Business / Executive Coaches",
    niche: "Helping founders and executives grow their businesses",
    trustLine: "…in the coaching space, referrals only scale so far before you need a real outbound system",
    painLine: "Most coaches I talk to are great at the work — this makes the client acquisition side simple",
    vnTip: "Reference a client win they posted, their coaching methodology, or a specific outcome they talk about.",
  },
  {
    industry: "Fractional Executives",
    niche: "Helping growing companies with fractional executive support",
    trustLine: "…in the fractional space, the right client relationships are everything — referrals aren't always reliable",
    painLine: "Most fractional execs have great results but no consistent way to show new clients what's possible",
    vnTip: "Reference their LinkedIn headline, a post about a client transformation, or an industry they specialise in.",
  },
];

/* =========================
 * 3-PART CONVERSATION FLOW (on call)
 * ========================= */
export const THREE_PART_FLOW = [
  {
    part: "Part 1 — Open & Connect",
    body: "Get them talking first. Start with curiosity, not a pitch. 'How's the client side going?' or 'What are you working on right now?' Listen for the pain: inconsistent pipeline, referrals, wanting more clients. Don't rush. Let them talk themselves into the problem.",
  },
  {
    part: "Part 2 — Bridge to BTF",
    body: "Connect their situation: 'Yeah, we actually work with a lot of [coaches / AI educators] in exactly that situation.' Name the system: 'It's called The Conversation Engine — basically a way to build a pipeline of client conversations without paid ads.' Social proof: 'We've had clients go from referral-only to 15K in 6 weeks.' Float it, don't force it.",
  },
  {
    part: "Part 3 — The Ask",
    body: "If yes: send calendar link immediately by text. Delay = drop-off.\nIf hesitant: 'It's completely no-pressure — just a conversation to see if it makes sense where you're at.'\nIf not now: 'No worries at all — when would be a better time to follow up?'",
  },
];

/* =========================
 * QUALIFYING A CALL — all 4 must be met
 * ========================= */
export const QUALIFY_CHECK = [
  { id: "decision_maker", label: "Decision maker", detail: "Owner / founder / CEO / solo operator. Not an ops manager unless it's larger enterprise." },
  { id: "real_offer", label: "Real offer", detail: "Service, coaching or program (not a product / e-com SKU)." },
  { id: "earning_something", label: "Earning something", detail: "Real results, client wins, case studies — not a total beginner." },
  { id: "wants_more", label: "Wants more clients", detail: "Motivated, pain signals present." },
];

/* =========================
 * LINKEDIN KPI TARGETS — from the doc
 * ========================= */
export const LINKEDIN_KPI_TARGETS = [
  { metric: "Daily connection requests", target: "25–50 / day", notes: "25/day weeks 1–2, then push your limit" },
  { metric: "Connection acceptance rate", target: "30%", notes: "Blank invite performs better than noted invite" },
  { metric: "Voice note reply rate", target: "20–30%", notes: "Personalisation is the key variable" },
  { metric: "Booking rate (from replies)", target: "15%", notes: "Stronger on DFY-tier conversations" },
  { metric: "Calls booked / day", target: "~1 at full volume", notes: "Achievable once you're at 50 connections/day" },
  { metric: "Calls booked / week", target: "4 qualified", notes: "Non-negotiable weekly minimum" },
];

export const PRO_TIPS = [
  "Voice note first on LinkedIn — every single time. One great voice note beats ten text DMs.",
  "Reply within 60 seconds of a warm engagement. Warm signals are time-sensitive.",
  "Most sales need 5+ follow-ups — 44% of setters quit after the first message. Send the follow-ups.",
  "Engage in public before sliding into DMs — reply to their post first, then VN. Can double reply rates.",
  "One question per message — always. Two questions = silence.",
  "60 seconds of research before every outreach — find one real, specific thing.",
  "Qualify in the conversation, not before it — pre-qualified prospects (3+ exchanges) book at 25–30% vs 8–12% cold.",
];

/* =========================
 * TRACKING LOG COLUMNS (Google Sheet / Notion)
 * ========================= */
export const TRACKING_LOG_COLUMNS = [
  "Date", "Platform", "Market / Niche", "VN or Text", "What Changed", "Sent", "Replies", "Booked", "Notes",
];

/* =========================
 * MARKET-TESTING DISCIPLINE
 * ========================= */
export const MARKET_TESTING_RULES = [
  "Change one variable at a time",
  "Give each version at least 20 sends before judging whether it works",
  "Build your swipe file as you go — share what's working with the team",
];

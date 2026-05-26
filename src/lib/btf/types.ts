export type Platform = "linkedin" | "instagram" | "tiktok" | "facebook" | "x" | "email";
export type Tier = "DIY" | "DWY" | "DFY";
export type LeadType =
  | "Direct"
  | "Lead Magnet"
  | "Engagement"
  | "Re-Engagement"
  | "Ad Lead"
  | "No Show"
  | "No Close";

export type Stage =
  | "Found"
  | "Connected"
  | "VN1 Sent"
  | "Replied"
  | "VN2 Sent"
  | "Calendar Sent"
  | "Call Booked"
  | "No Show"
  | "Nurturing"
  | "Re-Engaged"
  | "Closed"
  | "Cold";

export const STAGES: Stage[] = [
  "Found",
  "Connected",
  "VN1 Sent",
  "Replied",
  "VN2 Sent",
  "Calendar Sent",
  "Call Booked",
  "No Show",
  "Nurturing",
  "Re-Engaged",
  "Closed",
  "Cold",
];

/** Default stages shown on the pipeline board. */
export const ACTIVE_STAGES: Stage[] = [
  "Found",
  "Connected",
  "VN1 Sent",
  "Replied",
  "VN2 Sent",
  "Calendar Sent",
  "Call Booked",
];

/** Collapsed by default — shown when "Inactive" toggle is on. */
export const INACTIVE_STAGES: Stage[] = [
  "No Show",
  "Nurturing",
  "Re-Engaged",
  "Closed",
  "Cold",
];

/** Recommended next action per stage — surfaced on every card. */
export const STAGE_NEXT_ACTION: Record<Stage, string> = {
  Found: "Send connection request",
  Connected: "Record + send VN1",
  "VN1 Sent": "Wait 3d, then VN2",
  Replied: "Reply within 1h",
  "VN2 Sent": "Wait 5d, then text",
  "Calendar Sent": "Confirm booking",
  "Call Booked": "Claim in GHL",
  "No Show": "Send reschedule script",
  Nurturing: "Value drop in 5d",
  "Re-Engaged": "Re-pitch",
  Closed: "Log commission",
  Cold: "Drop or re-engage in 30d",
};

/** Tier visual border colours — drives the left strip on every card. */
export const TIER_BORDER_CLASS: Record<Tier, string> = {
  DFY: "border-l-[3px] border-l-tier-dfy",
  DWY: "border-l-[3px] border-l-tier-dwy",
  DIY: "border-l-[3px] border-l-border",
};

export const TIER_BADGE_CLASS: Record<Tier, string> = {
  DFY: "bg-tier-dfy/15 text-tier-dfy border-tier-dfy/40",
  DWY: "bg-tier-dwy/15 text-tier-dwy border-tier-dwy/40",
  DIY: "bg-muted text-muted-foreground border-border",
};

export const PLATFORMS: { value: Platform; label: string; emoji: string }[] = [
  { value: "linkedin", label: "LinkedIn", emoji: "💼" },
  { value: "instagram", label: "Instagram", emoji: "📸" },
  { value: "tiktok", label: "TikTok", emoji: "🎵" },
  { value: "facebook", label: "Facebook", emoji: "📘" },
  { value: "x", label: "X", emoji: "✖️" },
  { value: "email", label: "Email", emoji: "✉️" },
];

export const platformEmoji = (p: Platform) =>
  PLATFORMS.find((x) => x.value === p)?.emoji ?? "•";

export type BuyingSignals = {
  featuredOffer: boolean;
  bookingLinkInBio: boolean;
  referralsOnly: boolean;
  slowMonth: boolean;
  wantsToScale: boolean;
  noOutboundSystem: boolean;
  decisionMakerConfirmed: boolean;
};

export const EMPTY_SIGNALS: BuyingSignals = {
  featuredOffer: false,
  bookingLinkInBio: false,
  referralsOnly: false,
  slowMonth: false,
  wantsToScale: false,
  noOutboundSystem: false,
  decisionMakerConfirmed: false,
};

export const SIGNAL_LABELS: Record<keyof BuyingSignals, string> = {
  featuredOffer: "Featured section with offer",
  bookingLinkInBio: "Booking link in bio",
  referralsOnly: '"Referrals only" posts',
  slowMonth: '"Slow month" language',
  wantsToScale: "Posts about wanting to scale",
  noOutboundSystem: "No visible outbound system",
  decisionMakerConfirmed: "Decision maker confirmed",
};

export type BANT = { need: 0 | 1 | 2; timeline: 0 | 1 | 2; authority: 0 | 1 | 2; budget: 0 | 1 | 2 };

export type ActivityType = "VN" | "text" | "email" | "comment" | "like" | "call" | "note";
export type Activity = {
  id: string;
  date: string;
  type: ActivityType;
  notes: string;
  /** true = sent by me (setter), false = received from prospect. Defaults to true for legacy entries. */
  fromMe?: boolean;
};

export type ReplyType = "VN" | "text" | "none";
export type VNEntry = { id: string; date: string; variation: string; reply: ReplyType };

export type Prospect = {
  id: string;
  name: string;
  profileUrl: string;
  platform: Platform;
  niche: string;
  bio: string;
  leadType: LeadType;
  tier: Tier;
  stage: Stage;
  qualScore: number; // 0-100
  bant: BANT;
  signals: BuyingSignals;
  activities: Activity[];
  vnLog: VNEntry[];
  createdAt: string;
  stageEnteredAt: string;
  lastTouchAt: string;
  /** When the setter (or AI, if confirmed) plans to follow up next. */
  followUpAt?: string;
  /** Short note explaining the follow-up reason. */
  followUpReason?: string;
};

export type KpiDay = {
  date: string; // YYYY-MM-DD
  vnSent: number;
  connectionsSent: number;
  connectionsAccepted: number;
  replies: number;
  activeConvos: number;
  calendarsSent: number;
  booked: number;
  shows: number;
  hours: number;
  byPlatform: Partial<Record<Platform, { vnSent: number; booked: number }>>;
};

export type ScriptLog = {
  id: string;
  date: string;
  variation: string;
  market: string;
  niche: string;
  platform: Platform;
  replied: boolean;
  booked: boolean;
};

export type TrainingSession = {
  id: string;
  scenarioId: string;
  date: string;
  transcript: { role: "prospect" | "setter"; text: string }[];
  grade?: "A" | "B" | "C" | "D";
  strengths?: string[];
  improvements?: string[];
  frameworkScore?: number;
};

export type Commission = {
  id: string;
  prospectId?: string;
  prospectName: string;
  tier: Tier;
  amount: number;
  closedAt: string;
  claimedInGhl?: boolean;
};

export type AiProvider = "lovable" | "groq" | "openai" | "openrouter" | "lmstudio";

export type Settings = {
  aiProvider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  name: string;
  linkedinUrl: string;
  igHandle: string;
  calendarLink: string;
  monthlyTarget: number;
  roleStartDate: string; // YYYY-MM-DD — when you started the BTF setter role
  managerNames: string; // e.g. "Yarek & Marcus"
};

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: "lovable",
  baseUrl: "",
  model: "google/gemini-3-flash-preview",
  apiKey: "",
  name: "",
  linkedinUrl: "",
  igHandle: "",
  calendarLink: "",
  monthlyTarget: 5000,
  roleStartDate: "",
  managerNames: "Yarek & Marcus",
};

export const TIER_VALUE: Record<Tier, number> = { DIY: 75, DWY: 225, DFY: 900 };

// Stage age thresholds (days) — flag red if exceeded
export const STAGE_AGE_LIMIT: Partial<Record<Stage, number>> = {
  Found: 2,
  Connected: 3,
  "VN1 Sent": 5,
  Replied: 2,
  "VN2 Sent": 6,
  "Calendar Sent": 4,
  "Call Booked": 7,
  "No Show": 3,
  Nurturing: 14,
  "Re-Engaged": 5,
};

// BTF sequence timing per platform — list of {dayOffset, action}
export const SEQUENCE: Record<Platform, { day: number; action: string }[]> = {
  linkedin: [
    { day: 0, action: "Connect" },
    { day: 3, action: "VN1" },
    { day: 7, action: "VN2" },
    { day: 12, action: "Text follow-up" },
  ],
  instagram: [
    { day: 1, action: "Text" },
    { day: 4, action: "Follow-up" },
    { day: 7, action: "Value drop" },
    { day: 10, action: "VN" },
  ],
  facebook: [
    { day: 0, action: "DM" },
    { day: 3, action: "Follow-up" },
    { day: 7, action: "VN" },
  ],
  x: [
    { day: 0, action: "Reply / DM" },
    { day: 2, action: "Follow-up" },
    { day: 5, action: "VN" },
  ],
  email: [
    { day: 0, action: "Email 1" },
    { day: 2, action: "Email 2" },
    { day: 5, action: "Email 3" },
    { day: 9, action: "Break-up" },
  ],
  tiktok: [
    { day: 0, action: "Comment + DM" },
    { day: 3, action: "Follow-up" },
    { day: 7, action: "VN" },
  ],
};

export const WEEKLY_BENCHMARKS: Record<Platform, number> = {
  linkedin: 4,
  instagram: 6,
  facebook: 3,
  x: 2,
  email: 4,
  tiktok: 0,
};

export const DAILY_TARGETS = {
  vnLinkedIn: 18,
  vnInstagram: 25,
  connections: 18,
  replyRate: 25, // %
  showRate: 75, // %
};

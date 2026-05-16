import { z } from "zod";

export const MarketBucket = z.enum([
  "AI Consultant",
  "AI Educator",
  "Community Builder",
  "Fractional Exec",
  "Business Coach",
  "Executive Coach",
  "Consultant",
  "Other",
]);
export type MarketBucket = z.infer<typeof MarketBucket>;

export const IcpMatch = z.enum(["green", "yellow", "red"]);
export type IcpMatch = z.infer<typeof IcpMatch>;

export const ConvStage = z.enum([
  "not_connected",
  "connection_sent",
  "accepted_no_vn",
  "vn1_sent",
  "replied_voice",
  "replied_text",
  "vn2_due",
  "day7_followup_due",
  "day12_text_due",
  "objection_raised",
  "ready_to_book",
  "booked",
  "ghost",
]);
export type ConvStage = z.infer<typeof ConvStage>;

export const NextAction = z.enum([
  "send_connection",
  "voice_note_1",
  "voice_note_2",
  "text_followup",
  "breakup",
  "objection_response",
  "send_calendar_link",
  "book_call",
  "disqualify",
  "wait",
]);
export type NextAction = z.infer<typeof NextAction>;

export const ObjectionType = z.enum([
  "none",
  "time",
  "already_have_system",
  "cost",
  "is_this_sales",
  "not_interested",
  "send_info",
  "other",
]);
export type ObjectionType = z.infer<typeof ObjectionType>;

export const Triage = z.enum(["hot", "warm", "cold", "disqualify"]);
export type Triage = z.infer<typeof Triage>;

export const ThreadAnalysisSchema = z.object({
  triage: Triage,
  icpMatch: IcpMatch,
  market: MarketBucket,
  personalisationHook: z.string().max(280),
  qualification: z.object({
    decisionMaker: z.number().int().min(-1).max(1), // -1 = unknown
    hasOffer: z.number().int().min(-1).max(1),
    earningSomething: z.number().int().min(-1).max(1),
    wantsMore: z.number().int().min(-1).max(1),
    verdict: z.enum(["qualified", "needs_more_convo", "disqualify"]),
    reason: z.string().max(280),
  }),
  stage: ConvStage,
  daysSinceLastTouch: z.number().min(0).max(365),
  tone: z.object({
    suggestedFormat: z.enum(["voice", "text", "calendar_link"]),
    energy: z.string().max(60),
  }),
  objection: ObjectionType,
  nextAction: NextAction,
  draftMessage: z.string().max(2000),
  oneLineVerdict: z.string().max(120),
  reasoning: z.string().max(500),
  confidence: z.number().min(0).max(1),
  bantSuggestion: z.object({
    need: z.number().int().min(0).max(2),
    timeline: z.number().int().min(0).max(2),
    authority: z.number().int().min(0).max(2),
    budget: z.number().int().min(0).max(2),
  }),
  qualScoreSuggestion: z.number().int().min(0).max(100),
});

export type ThreadAnalysis = z.infer<typeof ThreadAnalysisSchema>;

export type CachedAnalysis = ThreadAnalysis & {
  threadId: string;
  analyzedAt: string;
  basedOnLastMessageAt: string;
};

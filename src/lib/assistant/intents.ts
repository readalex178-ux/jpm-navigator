import { z } from "zod";
import { STAGES } from "@/lib/btf/types";

export const ProposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("log_activity"),
    prospectQuery: z.string().min(1).max(200),
    activityType: z.enum(["VN", "text", "email", "comment", "like", "call", "note"]),
    note: z.string().max(2000).default(""),
  }),
  z.object({
    kind: z.literal("update_stage"),
    prospectQuery: z.string().min(1).max(200),
    stage: z.enum(STAGES as [string, ...string[]]),
  }),
  z.object({
    kind: z.literal("add_prospect"),
    name: z.string().min(1).max(200),
    platform: z
      .enum(["linkedin", "instagram", "tiktok", "facebook", "x", "email"])
      .optional(),
    niche: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  }),
  z.object({
    kind: z.literal("import_csv"),
    fileName: z.string().max(255).default(""),
    rows: z
      .array(z.record(z.string(), z.any()))
      .max(500),
    skippedCount: z.number().int().nonnegative().default(0),
  }),
  z.object({
    kind: z.literal("answer_only"),
  }),
]);


export type Proposal = z.infer<typeof ProposalSchema>;

export const AssistantResponseSchema = z.object({
  reply: z.string().min(1).max(2000),
  proposals: z.array(ProposalSchema).max(10).default([]),
});

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

/** Persisted proposal w/ apply state. */
export type ProposalRecord = Proposal & {
  id: string;
  appliedAt?: string;
  resolvedProspectId?: string;
  dismissedAt?: string;
};

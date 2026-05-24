import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DbMessage = {
  id: string;
  prospectId: string;
  fromMe: boolean;
  type: string;
  text: string;
  date: string;
};

export const getAllMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ messages: DbMessage[] }> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("messages")
      .select("id, prospect_id, sender, kind, content, sent_at")
      .order("sent_at", { ascending: true });
    if (error) {
      console.error("[getAllMessages] supabase error:", error);
      throw new Error("Failed to load messages.");
    }
    const messages: DbMessage[] = (data ?? []).map((m: any) => ({
      id: `db:${m.id}`,
      prospectId: m.prospect_id,
      fromMe: m.sender === "me",
      type: m.kind === "vn" ? "VN" : m.kind,
      text: m.content,
      date: m.sent_at,
    }));
    return { messages };
  });

const KindSchema = z.enum(["text", "vn", "email", "comment", "call", "note", "dm"]);
const SenderSchema = z.enum(["me", "them"]);

export const logMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        prospectId: z.string().uuid(),
        sender: SenderSchema,
        kind: KindSchema,
        content: z.string().min(1).max(10_000),
        variationName: z.string().max(255).optional(),
        sentAt: z.string().datetime().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ message: DbMessage }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        user_id: userId,
        prospect_id: data.prospectId,
        sender: data.sender,
        kind: data.kind,
        content: data.content,
        variation_name: data.variationName ?? null,
        sent_at: data.sentAt ?? new Date().toISOString(),
      })
      .select("id, prospect_id, sender, kind, content, sent_at")
      .single();
    if (error) {
      console.error("[logMessage] supabase error:", error);
      throw new Error("Failed to log message.");
    }
    return {
      message: {
        id: `db:${row.id}`,
        prospectId: row.prospect_id,
        fromMe: row.sender === "me",
        type: row.kind === "vn" ? "VN" : row.kind,
        text: row.content,
        date: row.sent_at,
      },
    };
  });

import { createServerFn } from "@tanstack/react-start";
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
    if (error) throw new Error(error.message);
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

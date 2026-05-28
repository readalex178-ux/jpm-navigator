import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import type { ProposalRecord } from "./intents";

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposals: ProposalRecord[];
  createdAt: string;
};

const uid = () => Math.random().toString(36).slice(2, 11);

export function useAssistantThread() {
  const auth = useAuth();
  const userId = auth.status === "authed" && auth.user ? auth.user.id : null;
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setMessages([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("assistant_messages")
        .select("id, role, content, proposals, created_at")
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        console.error("[assistant] load history failed", error);
        setLoaded(true);
        return;
      }
      setMessages(
        (data ?? []).map((row) => ({
          id: row.id,
          role: row.role as "user" | "assistant",
          content: row.content,
          proposals: (row.proposals as ProposalRecord[]) ?? [],
          createdAt: row.created_at,
        })),
      );
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const append = useCallback(
    async (
      role: "user" | "assistant",
      content: string,
      proposals: ProposalRecord[] = [],
    ): Promise<ThreadMessage> => {
      const optimistic: ThreadMessage = {
        id: uid(),
        role,
        content,
        proposals,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, optimistic]);
      if (!userId) return optimistic;
      const { data, error } = await supabase
        .from("assistant_messages")
        .insert({ user_id: userId, role, content, proposals })
        .select("id, created_at")
        .single();
      if (error) {
        console.error("[assistant] save failed", error);
        return optimistic;
      }
      // reconcile id
      setMessages((m) =>
        m.map((x) =>
          x.id === optimistic.id
            ? { ...x, id: data.id, createdAt: data.created_at }
            : x,
        ),
      );
      return { ...optimistic, id: data.id, createdAt: data.created_at };
    },
    [userId],
  );

  const patchProposal = useCallback(
    async (messageId: string, proposalId: string, patch: Partial<ProposalRecord>) => {
      let next: ProposalRecord[] = [];
      setMessages((m) =>
        m.map((msg) => {
          if (msg.id !== messageId) return msg;
          next = msg.proposals.map((p) =>
            p.id === proposalId ? ({ ...p, ...patch } as ProposalRecord) : p,
          );
          return { ...msg, proposals: next };
        }),
      );
      if (!userId) return;
      const { error } = await supabase
        .from("assistant_messages")
        .update({ proposals: next })
        .eq("id", messageId);
      if (error) console.error("[assistant] patch failed", error);
    },
    [userId],
  );

  const clearAll = useCallback(async () => {
    setMessages([]);
    if (!userId) return;
    const { error } = await supabase
      .from("assistant_messages")
      .delete()
      .eq("user_id", userId);
    if (error) console.error("[assistant] clear failed", error);
  }, [userId]);

  return { messages, loaded, append, patchProposal, clearAll };
}

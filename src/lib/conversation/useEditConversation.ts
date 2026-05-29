import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { updateMessage, deleteMessage } from "@/lib/messages.functions";
import type { ConvMessage } from "@/components/ConversationLog";
import type { ActivityType, ReplyType } from "@/lib/btf/types";

export type ConvEditPatch = {
  text?: string;
  fromMe?: boolean;
  type?: string;
};

const ACTIVITY_TYPES: ActivityType[] = ["VN", "text", "email", "comment", "like", "call", "note"];

function toActivityType(t?: string): ActivityType | undefined {
  if (!t) return undefined;
  return ACTIVITY_TYPES.includes(t as ActivityType) ? (t as ActivityType) : undefined;
}

function toKind(t?: string): "text" | "vn" | "email" | "comment" | "call" | "note" | undefined {
  if (!t) return undefined;
  if (t === "VN") return "vn";
  if (["text", "email", "comment", "call", "note"].includes(t)) return t as "text";
  return undefined;
}

export function useEditConversation(prospectId: string) {
  const updateActivity = useStore((s) => s.updateActivity);
  const deleteActivity = useStore((s) => s.deleteActivity);
  const updateVN = useStore((s) => s.updateVN);
  const deleteVN = useStore((s) => s.deleteVN);
  const callUpdate = useServerFn(updateMessage);
  const callDelete = useServerFn(deleteMessage);
  const queryClient = useQueryClient();

  const onEdit = useCallback(
    async (msg: ConvMessage, patch: ConvEditPatch) => {
      try {
        if (msg.id.startsWith("a:")) {
          const aid = msg.id.slice(2);
          const apatch: { notes?: string; fromMe?: boolean; type?: ActivityType } = {};
          if (patch.text !== undefined) apatch.notes = patch.text;
          if (patch.fromMe !== undefined) apatch.fromMe = patch.fromMe;
          const at = toActivityType(patch.type);
          if (at) apatch.type = at;
          updateActivity(prospectId, aid, apatch);
        } else if (msg.id.startsWith("v:") && !msg.id.endsWith(":reply")) {
          const vid = msg.id.slice(2);
          if (patch.text !== undefined) updateVN(prospectId, vid, { variation: patch.text });
        } else if (msg.id.startsWith("v:") && msg.id.endsWith(":reply")) {
          const vid = msg.id.slice(2, -":reply".length);
          const reply: ReplyType | undefined =
            patch.type === "VN" || patch.type === "text" ? (patch.type as ReplyType) : undefined;
          if (reply) updateVN(prospectId, vid, { reply });
        } else if (msg.id.startsWith("db:")) {
          const id = msg.id.slice(3);
          await callUpdate({
            data: {
              id,
              content: patch.text,
              sender: patch.fromMe === undefined ? undefined : patch.fromMe ? "me" : "them",
              kind: toKind(patch.type),
            },
          });
          queryClient.invalidateQueries({ queryKey: ["inbox-messages"] });
        }
        toast.success("Message updated");
      } catch (e) {
        console.error("[useEditConversation] edit failed", e);
        toast.error(`Couldn't update: ${(e as Error).message}`);
      }
    },
    [prospectId, updateActivity, updateVN, callUpdate, queryClient],
  );

  const onDelete = useCallback(
    async (msg: ConvMessage) => {
      try {
        if (msg.id.startsWith("a:")) {
          deleteActivity(prospectId, msg.id.slice(2));
        } else if (msg.id.startsWith("v:") && !msg.id.endsWith(":reply")) {
          deleteVN(prospectId, msg.id.slice(2));
        } else if (msg.id.startsWith("v:") && msg.id.endsWith(":reply")) {
          const vid = msg.id.slice(2, -":reply".length);
          updateVN(prospectId, vid, { reply: "none" as ReplyType });
        } else if (msg.id.startsWith("db:")) {
          await callDelete({ data: { id: msg.id.slice(3) } });
          queryClient.invalidateQueries({ queryKey: ["inbox-messages"] });
        }
        toast.success("Message deleted");
      } catch (e) {
        console.error("[useEditConversation] delete failed", e);
        toast.error(`Couldn't delete: ${(e as Error).message}`);
      }
    },
    [prospectId, deleteActivity, deleteVN, updateVN, callDelete, queryClient],
  );

  return { onEdit, onDelete };
}

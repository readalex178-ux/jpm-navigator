import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Activity, VNEntry } from "@/lib/btf/types";

export type ConvMessage = {
  id: string;
  date: string;
  fromMe: boolean;
  type: string;
  text: string;
};

const DEDUP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/^🎙\s*vn sent(\s*—.*)?$/i, "__vn__")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeMessages(msgs: ConvMessage[]): ConvMessage[] {
  const sorted = [...msgs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const kept: ConvMessage[] = [];
  for (const m of sorted) {
    const mTime = new Date(m.date).getTime();
    const mKey = normalizeText(m.text);
    const isVn = m.type === "VN" || mKey === "__vn__";
    const dup = kept.find((k) => {
      if (k.fromMe !== m.fromMe) return false;
      if (Math.abs(new Date(k.date).getTime() - mTime) > DEDUP_WINDOW_MS) return false;
      const kKey = normalizeText(k.text);
      const kIsVn = k.type === "VN" || kKey === "__vn__";
      if (isVn && kIsVn) return true;
      return kKey === mKey && kKey.length > 0;
    });
    if (!dup) kept.push(m);
  }
  return kept;
}

function mergeMessages(
  activities: Activity[],
  vnLog: VNEntry[],
  extras: ConvMessage[] = [],
): ConvMessage[] {
  const fromActs: ConvMessage[] = activities.map((a) => ({
    id: `a:${a.id}`,
    date: a.date,
    fromMe: a.fromMe ?? true,
    type: a.type,
    text: a.notes,
  }));
  const fromVns: ConvMessage[] = [];
  for (const v of vnLog) {
    fromVns.push({
      id: `v:${v.id}`,
      date: v.date,
      fromMe: true,
      type: "VN",
      text: v.variation ? `🎙 VN sent — ${v.variation}` : "🎙 VN sent",
    });
    if (v.reply !== "none") {
      fromVns.push({
        id: `v:${v.id}:reply`,
        date: v.date,
        fromMe: false,
        type: v.reply,
        text: `(replied with ${v.reply})`,
      });
    }
  }
  return dedupeMessages([...fromActs, ...fromVns, ...extras]);
}

export function buildConversation(
  activities: Activity[],
  vnLog: VNEntry[],
  extras: ConvMessage[] = [],
): ConvMessage[] {
  return mergeMessages(activities, vnLog, extras);
}

const TYPE_OPTIONS = ["VN", "text", "email", "comment", "like", "call", "note"];

export type ConvEditHandler = (
  msg: ConvMessage,
  patch: { text?: string; fromMe?: boolean; type?: string },
) => void | Promise<void>;
export type ConvDeleteHandler = (msg: ConvMessage) => void | Promise<void>;

export function ConversationLog({
  activities,
  vnLog,
  extras = [],
  onEdit,
  onDelete,
}: {
  activities: Activity[];
  vnLog: VNEntry[];
  extras?: ConvMessage[];
  onEdit?: ConvEditHandler;
  onDelete?: ConvDeleteHandler;
}) {
  const messages = useMemo(() => mergeMessages(activities, vnLog, extras), [activities, vnLog, extras]);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (messages.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No messages yet. Use the composer below to log the first one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((m) => {
        const isEditing = editingId === m.id;
        return (
          <div
            key={m.id}
            className={cn("group flex w-full", m.fromMe ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                m.fromMe
                  ? "bg-primary/15 text-foreground border border-primary/30"
                  : "bg-surface text-foreground border border-border",
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>{m.fromMe ? "Me" : "Them"}</span>
                <Badge variant="outline" className="h-fit px-1 py-0 text-[9px]">{m.type}</Badge>
                <span className="num">{m.date.slice(0, 16).replace("T", " ")}</span>
                {(onEdit || onDelete) && !isEditing && (
                  <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingId(m.id)}
                        className="rounded p-0.5 hover:bg-muted"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Delete this message?")) void onDelete(m);
                        }}
                        className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isEditing && onEdit ? (
                <MessageEditor
                  msg={m}
                  onCancel={() => setEditingId(null)}
                  onSave={async (patch) => {
                    await onEdit(m, patch);
                    setEditingId(null);
                  }}
                />
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MessageEditor({
  msg,
  onSave,
  onCancel,
}: {
  msg: ConvMessage;
  onSave: (patch: { text?: string; fromMe?: boolean; type?: string }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(msg.text);
  const [fromMe, setFromMe] = useState(msg.fromMe);
  const [type, setType] = useState(msg.type);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <select
          value={fromMe ? "me" : "them"}
          onChange={(e) => setFromMe(e.target.value === "me")}
          className="rounded border border-border bg-background px-1.5 py-0.5"
        >
          <option value="me">Me</option>
          <option value="them">Them</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-border bg-background px-1.5 py-0.5"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="text-sm"
      />
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          className="h-7"
          onClick={() => void onSave({ text, fromMe, type })}
        >
          <Check className="mr-1 h-3 w-3" />
          Save
        </Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={onCancel}>
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

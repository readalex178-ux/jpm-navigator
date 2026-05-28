import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Sparkles, Loader2, Copy, ArrowDownToLine, Send, Filter, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { useStore, todayStr } from "@/lib/store";
import { PageHeader } from "@/components/Page";
import { ConversationLog, buildConversation, type ConvMessage } from "@/components/ConversationLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { platformEmoji, type ActivityType } from "@/lib/btf/types";
import {
  suggestReplies,
  type SuggestRepliesResult,
} from "@/lib/ai/suggestReplies.functions";
import { getAllMessages, logMessage } from "@/lib/messages.functions";
import { NextActionCard } from "@/components/NextActionCard";
import { AiSetupBanner } from "@/components/AiSetupBanner";
import { ObjectionPanel } from "@/components/ObjectionPanel";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Unified Inbox — BTF Setter OS" },
      {
        name: "description",
        content:
          "Every DM in one workspace with an AI co-pilot suggesting replies. You always send manually.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    prospect: typeof search.prospect === "string" ? search.prospect : undefined,
  }),
  component: InboxPage,
});

const ACTIVITY_TYPES: ActivityType[] = ["VN", "text", "email", "comment", "call", "note"];

function InboxPage() {
  const search = Route.useSearch();
  const prospects = useStore((s) => s.prospects);
  const logActivity = useStore((s) => s.logActivity);
  const logVN = useStore((s) => s.logVN);
  const upsertKpiDay = useStore((s) => s.upsertKpiDay);
  const getKpiDay = useStore((s) => s.getKpiDay);

  const [selectedId, setSelectedId] = useState<string | null>(search.prospect ?? null);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [mobilePane, setMobilePane] = useState<"list" | "chat" | "ai">("list");

  // Composer
  const [direction, setDirection] = useState<"them" | "me">("them");
  const [type, setType] = useState<ActivityType>("text");
  const [text, setText] = useState("");

  // AI
  const callSuggest = useServerFn(suggestReplies);
  const [aiBusy, setAiBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestRepliesResult["suggestions"] | null>(null);
  const [userIntent, setUserIntent] = useState("");


  // Historical messages from Supabase, grouped by prospect_id
  const queryClient = useQueryClient();
  const fetchAllMessages = useServerFn(getAllMessages);
  const callLogMessage = useServerFn(logMessage);
  const { data: dbMessagesData } = useQuery({
    queryKey: ["inbox-messages"],
    queryFn: () => fetchAllMessages(),
    staleTime: 30_000,
  });

  const activityTypeToKind = (t: ActivityType): "text" | "vn" | "email" | "comment" | "call" | "note" =>
    t === "VN" ? "vn" : (t as "text" | "email" | "comment" | "call" | "note");

  const syncToSupabase = async (args: {
    prospectId: string;
    fromMe: boolean;
    type: ActivityType;
    text: string;
    date: string;
    variation?: string;
  }) => {
    try {
      await callLogMessage({
        data: {
          prospectId: args.prospectId,
          sender: args.fromMe ? "me" : "them",
          kind: activityTypeToKind(args.type),
          content: args.text,
          variationName: args.variation,
          sentAt: args.date,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["inbox-messages"] });
    } catch (e) {
      toast.error(`Sync failed: ${(e as Error).message}`);
    }
  };
  const extrasByProspect = useMemo(() => {
    const map = new Map<string, ConvMessage[]>();
    for (const m of dbMessagesData?.messages ?? []) {
      const arr = map.get(m.prospectId) ?? [];
      arr.push({ id: m.id, date: m.date, fromMe: m.fromMe, type: m.type, text: m.text });
      map.set(m.prospectId, arr);
    }
    return map;
  }, [dbMessagesData]);

  // Realtime: refetch inbox messages on any insert/update/delete in messages.
  // RLS scopes the publication to the current user's rows.
  useEffect(() => {
    const channel = supabase
      .channel("inbox-messages-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["inbox-messages"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);




  const rows = useMemo(() => {
    return prospects
      .map((p) => {
        const msgs = buildConversation(p.activities ?? [], p.vnLog ?? [], extrasByProspect.get(p.id) ?? []);
        const last = msgs[msgs.length - 1];
        return {
          p,
          count: msgs.length,
          lastDate: last?.date ?? p.lastTouchAt ?? "",
          lastFromMe: last?.fromMe ?? true,
          lastText: last?.text ?? "No messages yet",
        };
      })
      .filter((r) => {
        if (stageFilter !== "all" && r.p.stage !== stageFilter) return false;
        if (platformFilter !== "all" && r.p.platform !== platformFilter) return false;
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return (
          r.p.name.toLowerCase().includes(s) ||
          (r.p.niche ?? "").toLowerCase().includes(s) ||
          r.lastText.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
  }, [prospects, q, stageFilter, platformFilter]);

  const selected = useMemo(
    () => prospects.find((p) => p.id === selectedId) ?? rows[0]?.p ?? null,
    [prospects, selectedId, rows],
  );

  const stages = useMemo(
    () => Array.from(new Set(prospects.map((p) => p.stage))).sort(),
    [prospects],
  );
  const platforms = useMemo(
    () => Array.from(new Set(prospects.map((p) => p.platform))).sort(),
    [prospects],
  );

  const sendLog = () => {
    if (!selected || !text.trim()) return;
    const fromMe = direction === "me";
    const date = new Date().toISOString();
    const content = text.trim();
    logActivity(selected.id, { date, type, notes: content, fromMe });
    const isVn = type === "VN" && fromMe;
    if (isVn) {
      logVN(selected.id, { date, variation: content.slice(0, 80), reply: "none" });
      const today = getKpiDay(todayStr());
      upsertKpiDay({ date: todayStr(), vnSent: today.vnSent + 1 });
    }
    void syncToSupabase({
      prospectId: selected.id,
      fromMe,
      type,
      text: content,
      date,
      variation: isVn ? content.slice(0, 80) : undefined,
    });
    setText("");
    toast.success(fromMe ? "Logged your message" : "Logged their message");
  };

  const runSuggest = async () => {
    if (!selected) return;
    setAiBusy(true);
    setSuggestions(null);
    try {
      const conv = buildConversation(selected.activities, selected.vnLog, extrasByProspect.get(selected.id) ?? []);
      const signals = Object.entries(selected.signals)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await callSuggest({
        data: {
          prospectName: selected.name,
          platform: selected.platform,
          niche: selected.niche,
          stage: selected.stage,
          tier: selected.tier,
          bio: selected.bio,
          signals,
          messages: conv.map((m) => ({
            fromMe: m.fromMe,
            type: m.type,
            date: m.date,
            text: m.text,
          })),
          userIntent: userIntent.trim() || undefined,
        },
      });

      if (!res.ok) throw new Error(res.error);
      setSuggestions(res.result.suggestions);
    } catch (e) {
      toast.error(`AI: ${(e as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const copySug = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied — paste into the platform when ready.");
  };
  const insertSug = (s: SuggestRepliesResult["suggestions"][number]) => {
    setDirection("me");
    setType((s.type as ActivityType) ?? "text");
    setText(s.content);
    toast.success("Loaded into composer. Edit, then click Log when you've sent it.");
  };
  const copyAndLogSug = (s: SuggestRepliesResult["suggestions"][number]) => {
    if (!selected) return;
    navigator.clipboard.writeText(s.content);
    const date = new Date().toISOString();
    const sugType = (s.type as ActivityType) ?? "text";
    logActivity(selected.id, { date, type: sugType, notes: s.content, fromMe: true });
    const isVn = sugType === "VN";
    if (isVn) {
      logVN(selected.id, { date, variation: s.content.slice(0, 80), reply: "none" });
      const today = getKpiDay(todayStr());
      upsertKpiDay({ date: todayStr(), vnSent: today.vnSent + 1 });
    }
    void syncToSupabase({
      prospectId: selected.id,
      fromMe: true,
      type: sugType,
      text: s.content,
      date,
      variation: isVn ? s.content.slice(0, 80) : undefined,
    });
    toast.success("Copied & logged — paste into the platform to send.");
  };


  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      <PageHeader
        title="Unified Inbox"
        subtitle="Every conversation in one workspace. AI suggests — you send."
      />

      <div className="px-4 pt-2">
        <AiSetupBanner />
      </div>


      {/* Mobile pane switcher */}
      <div className="flex gap-1 px-4 pb-2 lg:hidden">
        {([
          ["list", "Threads"],
          ["chat", "Chat"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMobilePane(k)}
            className={cn(
              "flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors",
              mobilePane === k
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid flex-1 min-h-0 gap-3 px-4 pb-4 lg:grid-cols-[320px_1fr_360px]">
        {/* Conversation list */}
        <div
          className={cn(
            "min-h-0 flex-col rounded-lg border border-border bg-card lg:flex",
            mobilePane === "list" ? "flex" : "hidden",
          )}
        >
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="h-8 pl-7 text-sm"
              />
            </div>
            <div className="flex gap-1.5">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <Filter className="h-3 w-3" />
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {rows.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No conversations yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => {
                  const active = selected?.id === r.p.id;
                  return (
                    <li key={r.p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(r.p.id);
                          setMobilePane("chat");
                        }}
                        className={cn(
                          "flex w-full gap-2.5 p-2.5 text-left transition-colors hover:bg-muted/40",
                          active && "bg-muted/60",
                        )}
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                          {r.p.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{r.p.name}</span>
                            <span className="text-xs">{platformEmoji(r.p.platform)}</span>
                            <span className="ml-auto shrink-0 text-[9px] uppercase tracking-widest text-muted-foreground num">
                              {r.lastDate ? r.lastDate.slice(5, 10) : "—"}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="h-fit shrink-0 px-1 py-0 text-[8px]"
                            >
                              {r.p.stage}
                            </Badge>
                            <span
                              className={cn(
                                "shrink-0 text-[9px] uppercase tracking-widest",
                                r.lastFromMe ? "text-primary" : "text-success",
                              )}
                            >
                              {r.lastFromMe ? "Me" : "Them"}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {r.lastText}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Active chat */}
        <div
          className={cn(
            "min-h-0 flex-col rounded-lg border border-border bg-card lg:flex",
            mobilePane === "chat" ? "flex" : "hidden",
          )}
        >
          {!selected ? (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border p-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {selected.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {selected.name}{" "}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {platformEmoji(selected.platform)} · {selected.niche || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="h-fit px-1 py-0 text-[9px]">
                      {selected.stage}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {selected.tier} · qual {selected.qualScore}
                    </span>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1 p-3">
                <ConversationLog activities={selected.activities} vnLog={selected.vnLog} extras={extrasByProspect.get(selected.id) ?? []} />
              </ScrollArea>
              <div className="space-y-2 border-t border-border p-3">
                {/* AI next-action — single highest-leverage move */}
                <NextActionCard
                  prospect={selected}
                  extras={extrasByProspect.get(selected.id) ?? []}
                  onUseDraft={(t, k) => {
                    setDirection("me");
                    setType(k);
                    setText(t);
                  }}
                />
                {/* Inline AI suggestions — right above the composer */}
                <div className="rounded-md border border-border bg-surface/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold">AI suggestions</span>
                      {suggestions && (
                        <span className="text-[10px] text-muted-foreground">
                          {suggestions.length} drafts
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={suggestions ? "outline" : "default"}
                      className="h-7 text-xs"
                      onClick={runSuggest}
                      disabled={aiBusy}
                    >
                      {aiBusy ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
                      {suggestions
                        ? "Regenerate"
                        : userIntent.trim()
                          ? "Shape my message"
                          : "Suggest 3 replies"}
                    </Button>
                  </div>
                  <div className="mt-2">
                    <Textarea
                      value={userIntent}
                      onChange={(e) => setUserIntent(e.target.value)}
                      placeholder="Optional — say what you want to convey (e.g. 'ask if Friday works for a 15-min call'). AI will write 3 versions in your voice."
                      rows={2}
                      className="min-h-[44px] resize-none text-xs"
                    />
                    {userIntent.trim() && (
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>AI will shape this into 3 angles — your wording stays intact.</span>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => setUserIntent("")}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {suggestions && (
                    <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <div key={i} className="rounded border border-border bg-card p-2 text-xs">
                          <div className="mb-1 flex items-center gap-1.5">
                            <Badge className="h-fit px-1 py-0 text-[9px]">{s.angle}</Badge>
                            <Badge variant="outline" className="h-fit px-1 py-0 text-[9px]">
                              {s.type}
                            </Badge>
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed">{s.content}</div>
                          <div className="mt-1.5 flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => copySug(s.content)}
                            >
                              <Copy className="mr-1 h-2.5 w-2.5" /> Copy
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => copyAndLogSug(s)}
                            >
                              <CheckCheck className="mr-1 h-2.5 w-2.5" /> Copy + Log
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => insertSug(s)}
                            >
                              <ArrowDownToLine className="mr-1 h-2.5 w-2.5" /> Edit
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>



                <div className="flex flex-wrap gap-1.5">
                  <Select value={direction} onValueChange={(v) => setDirection(v as "me" | "them")}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="them">From them</SelectItem>
                      <SelectItem value="me">From me</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  placeholder={
                    direction === "me" ? "Paste what you sent…" : "Paste what they sent…"
                  }
                  className="text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    Logs to your CRM only. The app never sends messages.
                  </p>
                  <Button size="sm" onClick={sendLog} disabled={!text.trim()}>
                    <Send className="mr-1 h-3 w-3" /> Log message
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI co-pilot */}
        <div
          className={cn(
            "min-h-0 flex-col rounded-lg border border-border bg-card lg:flex",
            mobilePane === "ai" ? "flex" : "hidden",
          )}
        >
          <div className="flex items-center justify-between border-b border-border p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">AI co-pilot</span>
            </div>
            <Button size="sm" onClick={runSuggest} disabled={!selected || aiBusy}>
              {aiBusy ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-3 w-3" />
              )}
              Suggest 3 replies
            </Button>
          </div>
          <ScrollArea className="flex-1 p-3">
            {!suggestions && !aiBusy && (
              <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Click <span className="font-semibold">Suggest 3 replies</span> to get angle-diverse
                draft messages. You always edit and send manually.
              </div>
            )}
            {aiBusy && (
              <div className="grid place-items-center py-6 text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="mt-2">Thinking through the convo…</span>
              </div>
            )}
            {suggestions && (
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-surface p-3 text-sm"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Badge className="h-fit px-1.5 py-0 text-[9px]">{s.angle}</Badge>
                      <Badge variant="outline" className="h-fit px-1 py-0 text-[9px]">
                        {s.type}
                      </Badge>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{s.content}</div>
                    {s.coaching_note && (
                      <p className="mt-2 border-t border-border pt-2 text-[11px] italic text-muted-foreground">
                        {s.coaching_note}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => copySug(s.content)}
                      >
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => copyAndLogSug(s)}
                      >
                        <CheckCheck className="mr-1 h-3 w-3" /> Copy + Log
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => insertSug(s)}
                      >
                        <ArrowDownToLine className="mr-1 h-3 w-3" /> Edit in composer
                      </Button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

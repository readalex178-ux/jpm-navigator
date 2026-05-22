import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Page, Section } from "@/components/Page";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buildConversation } from "@/components/ConversationLog";
import { cn } from "@/lib/utils";
import { MessageSquare, Search } from "lucide-react";

export const Route = createFileRoute("/conversations")({
  head: () => ({
    meta: [
      { title: "Conversations — BTF Setter OS" },
      { name: "description", content: "Every prospect conversation in one place." },
    ],
  }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const prospects = useStore((s) => s.prospects);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return prospects
      .map((p) => {
        const msgs = buildConversation(p.activities ?? [], p.vnLog ?? []);
        const last = msgs[msgs.length - 1];
        return {
          id: p.id,
          name: p.name,
          handle: p.handle,
          stage: p.stage,
          niche: p.niche,
          count: msgs.length,
          lastDate: last?.date ?? p.lastTouchAt ?? "",
          lastFromMe: last?.fromMe ?? true,
          lastText: last?.text ?? "No messages yet",
          lastType: last?.type ?? "—",
        };
      })
      .filter((r) => {
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return (
          r.name.toLowerCase().includes(s) ||
          (r.handle ?? "").toLowerCase().includes(s) ||
          (r.niche ?? "").toLowerCase().includes(s) ||
          r.lastText.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
  }, [prospects, q]);

  return (
    <Page
      title="Conversations"
      subtitle="Every chat, every prospect, in one place. Click to open the full thread."
      icon={<MessageSquare className="h-5 w-5" />}
    >
      <Section
        title="All threads"
        right={
          <div className="relative w-64 max-w-full">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, niche, message…"
              className="h-8 pl-7"
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No conversations yet. Add a prospect and log a message to get started.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {rows.map((r) => (
              <Link
                key={r.id}
                to="/prospects/$id"
                params={{ id: r.id }}
                className="flex gap-3 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {r.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    <Badge variant="outline" className="h-fit px-1 py-0 text-[9px]">
                      {r.stage}
                    </Badge>
                    {r.niche && (
                      <span className="truncate text-xs text-muted-foreground">· {r.niche}</span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground num">
                      {r.lastDate ? r.lastDate.slice(0, 16).replace("T", " ") : "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className={cn(
                        "shrink-0 text-[10px] uppercase tracking-widest",
                        r.lastFromMe ? "text-primary" : "text-success",
                      )}
                    >
                      {r.lastFromMe ? "Me" : "Them"}
                    </span>
                    <span className="truncate">{r.lastText}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
                      {r.count} msg
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </Page>
  );
}

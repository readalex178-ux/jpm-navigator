import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { getDueFollowUps, type DueFollowUp } from "@/lib/followups";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlarmClock,
  ChevronRight,
  Inbox as InboxIcon,
  CalendarClock,
  Filter,
  Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/on-deck")({
  head: () => ({
    meta: [
      { title: "On Deck — BTF Setter OS" },
      {
        name: "description",
        content:
          "Prospects overdue for their next touchpoint, queued up so nothing slips.",
      },
    ],
  }),
  component: OnDeckPage,
});

type Bucket = "all" | "overdue" | "today" | "stage-age";

function OnDeckPage() {
  const prospects = useStore((s) => s.prospects);
  const togglePin = useStore((s) => s.togglePin);
  const due = useMemo(() => getDueFollowUps(prospects), [prospects]);
  const [bucket, setBucket] = useState<Bucket>("all");

  const filtered = useMemo(() => {
    switch (bucket) {
      case "overdue":
        return due.filter((d) => d.overdueDays > 0);
      case "today":
        return due.filter((d) => d.overdueDays === 0);
      case "stage-age":
        return due.filter((d) => d.source === "stage-age");
      default:
        return due;
    }
  }, [due, bucket]);

  const counts = useMemo(
    () => ({
      all: due.length,
      overdue: due.filter((d) => d.overdueDays > 0).length,
      today: due.filter((d) => d.overdueDays === 0).length,
      "stage-age": due.filter((d) => d.source === "stage-age").length,
    }),
    [due],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <AlarmClock className="h-3.5 w-3.5" />
            On Deck
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {due.length === 0
              ? "All caught up"
              : `${due.length} prospect${due.length === 1 ? "" : "s"} need a touch`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Combines explicit follow-up dates and prospects sitting too long in
            their current stage. Nothing here moves without you.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {(["all", "overdue", "today", "stage-age"] as Bucket[]).map((b) => (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] capitalize transition-colors",
                bucket === b
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40 hover:text-foreground",
              )}
            >
              {b === "stage-age" ? "stalled" : b} · {counts[b]}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed py-16 text-center">
          <AlarmClock className="h-8 w-8 text-muted-foreground/60" />
          <div className="font-display text-base">Nothing on deck.</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            When a prospect's follow-up date hits, or they sit too long in a
            stage, they'll surface here.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => (
            <OnDeckRow key={d.prospect.id} item={d} onPin={togglePin} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OnDeckRow({
  item,
  onPin,
}: {
  item: DueFollowUp;
  onPin: (id: string) => void;
}) {
  const { prospect: p, overdueDays, reason, source, dueAt } = item;
  const due = new Date(dueAt);
  const relative = formatDistanceToNow(due, { addSuffix: true });

  return (
    <Card className="group flex items-center gap-3 p-3 transition-colors hover:border-primary/40">
      <div
        className={cn(
          "h-10 w-1 shrink-0 rounded-full",
          overdueDays > 3
            ? "bg-destructive"
            : overdueDays > 0
              ? "bg-amber-500"
              : "bg-primary/70",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/prospects/$id"
            params={{ id: p.id }}
            className="truncate font-medium hover:text-primary"
          >
            {p.name}
          </Link>
          <Badge variant="outline" className="text-[10px]">
            {p.stage}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {p.tier}
          </Badge>
          {p.pinned && (
            <Pin className="h-3 w-3 fill-primary text-primary" />
          )}
          <span
            className={cn(
              "text-[11px] font-medium",
              overdueDays > 0
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {overdueDays > 0
              ? `${overdueDays}d overdue`
              : `due ${relative}`}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          <CalendarClock className="mr-1 inline h-3 w-3 -translate-y-px" />
          {reason}
          {source === "stage-age" && (
            <span className="ml-1 text-muted-foreground/60">· stalled</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPin(p.id)}
          title={p.pinned ? "Unpin" : "Pin"}
        >
          <Pin className={cn("h-3.5 w-3.5", p.pinned && "fill-primary text-primary")} />
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link to="/inbox" search={{ prospect: p.id } as never}>
            <InboxIcon className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1">
          <Link to="/prospects/$id" params={{ id: p.id }}>
            Open <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

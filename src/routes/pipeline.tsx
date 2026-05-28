import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { PageBody, PageHeader } from "@/components/Page";
import {
  STAGES,
  ACTIVE_STAGES,
  INACTIVE_STAGES,
  STAGE_AGE_LIMIT,
  STAGE_NEXT_ACTION,
  TIER_BORDER_CLASS,
  TIER_BADGE_CLASS,
  TIER_VALUE,
  PLATFORMS,
  platformEmoji,
  type Platform,
  type Stage,
  type Tier,
  type Prospect,
} from "@/lib/btf/types";
import { useStore, daysSince } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { LayoutGrid, Table as TableIcon, Pin, Star, AlertTriangle, Inbox, Copy, Trash2, ArrowRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — BTF Setter OS" },
      { name: "description", content: "Drag-and-drop pipeline across BTF outreach stages." },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const prospects = useStore((s) => s.prospects);
  const navigate = useNavigate();
  const moveStage = useStore((s) => s.moveStage);
  const [view, setView] = useState<"board" | "table">("board");
  const [bucket, setBucket] = useState<"active" | "inactive">("active");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [tier, setTier] = useState<Tier | "all">("all");

  const filtered = useMemo(() => prospects.filter((p) => {
    if (platform !== "all" && p.platform !== platform) return false;
    if (tier !== "all" && p.tier !== tier) return false;
    return true;
  }), [prospects, platform, tier]);

  const stages = bucket === "active" ? ACTIVE_STAGES : INACTIVE_STAGES;

  const byStage = useMemo(() => {
    const map: Record<Stage, Prospect[]> = Object.fromEntries(
      STAGES.map((s) => [s, [] as Prospect[]]),
    ) as Record<Stage, Prospect[]>;
    filtered.forEach((p) => map[p.stage].push(p));
    // Pinned float to top, then most recently touched.
    (Object.keys(map) as Stage[]).forEach((k) => {
      map[k].sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return +new Date(b.lastTouchAt) - +new Date(a.lastTouchAt);
      });
    });
    return map;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const stage = e.over?.id as Stage | undefined;
    if (!stage) return;
    // Drag-drop moves are undoable too.
    void import("@/lib/undoable").then((m) => m.undoableStageMove(id, stage));
  };

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Drag prospects across BTF stages.">
        <Tabs value={bucket} onValueChange={(v) => setBucket(v as "active" | "inactive")}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={view} onValueChange={(v) => setView(v as "board" | "table")}>
          <TabsList>
            <TabsTrigger value="board" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Board</TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5"><TableIcon className="h-3.5 w-3.5" /> Table</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={platform} onValueChange={(v) => setPlatform(v as Platform | "all")}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.emoji} {p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={(v) => setTier(v as Tier | "all")}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="DIY">DIY</SelectItem>
            <SelectItem value="DWY">DWY</SelectItem>
            <SelectItem value="DFY">DFY</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <PageBody>
        {view === "board" ? (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {stages.map((stage) => (
                <Column key={stage} stage={stage} items={byStage[stage]} />
              ))}
            </div>
          </DndContext>
        ) : (
          <TableView items={filtered} onStageChange={moveStage} onOpen={(id) => navigate({ to: "/inbox", search: { prospect: id } })} />
        )}
      </PageBody>
    </>
  );
}

function TableView({
  items,
  onStageChange,
  onOpen,
}: {
  items: Prospect[];
  onStageChange: (id: string, stage: Stage) => void;
  onOpen: (id: string) => void;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => +new Date(b.stageEnteredAt) - +new Date(a.stageEnteredAt)),
    [items],
  );

  if (sorted.length === 0) {
    return <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">No prospects match these filters.</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Days in stage</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((p) => {
            const stageDays = daysSince(p.stageEnteredAt);
            const limit = STAGE_AGE_LIMIT[p.stage];
            const overdue = limit !== undefined && stageDays > limit;
            return (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => onOpen(p.id)}
              >
                <TableCell className="font-medium">
                  {platformEmoji(p.platform)} {p.name}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs uppercase">{p.platform}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px]">{p.tier}</Badge></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                  <Select value={p.stage} onValueChange={(v) => onStageChange(p.id, v as Stage)}>
                    <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className={cn("text-right num text-xs", overdue && "text-destructive")}>{stageDays}d</TableCell>
                <TableCell className="text-right num text-xs">{p.qualScore}/100</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Column({ stage, items }: { stage: Stage; items: Prospect[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  const totalCommission = useMemo(
    () => items.reduce((sum, p) => sum + (TIER_VALUE[p.tier] ?? 0), 0),
    [items],
  );
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 flex-shrink-0 flex-col rounded-lg border bg-card",
        isOver ? "border-primary" : "border-border",
      )}
    >
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-semibold">{stage}</span>
          <Badge variant="outline" className="num text-[10px]">{items.length}</Badge>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate">{STAGE_NEXT_ACTION[stage]}</span>
          <span className="num">£{totalCommission.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">Drop here</div>
        )}
        {items.map((p) => <Card key={p.id} prospect={p} />)}
      </div>
    </div>
  );
}

function Card({ prospect }: { prospect: Prospect }) {
  const navigate = useNavigate();
  const togglePin = useStore((s) => s.togglePin);
  const duplicateProspect = useStore((s) => s.duplicateProspect);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: prospect.id });
  const stageDays = daysSince(prospect.stageEnteredAt);
  const limit = STAGE_AGE_LIMIT[prospect.stage];
  const overdue = limit !== undefined && stageDays > limit;
  const highScore = prospect.qualScore >= 75;
  const dmConfirmed = !!prospect.signals.decisionMakerConfirmed;
  const lastMsg = prospect.activities[0];
  const lastMsgText = lastMsg?.notes?.slice(0, 80);
  const nextAction = STAGE_NEXT_ACTION[prospect.stage];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
          <HoverCard openDelay={350} closeDelay={120}>
            <HoverCardTrigger asChild>
              <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                onClick={() => navigate({ to: "/prospects/$id", params: { id: prospect.id } })}
                style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
                className={cn(
                  "group relative cursor-grab rounded-md border bg-surface p-2.5 pl-3 active:cursor-grabbing",
                  TIER_BORDER_CLASS[prospect.tier],
                  overdue ? "border-destructive/70" : "border-border",
                  highScore && !overdue && "ring-1 ring-primary/40",
                  isDragging && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0">{platformEmoji(prospect.platform)}</span>
                      <span className="truncate text-sm font-medium">{prospect.name}</span>
                      {dmConfirmed && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                      {prospect.pinned && <Pin className="h-3 w-3 shrink-0 fill-primary text-primary" />}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline" className={cn("text-[10px]", TIER_BADGE_CLASS[prospect.tier])}>
                      {prospect.tier}
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); togglePin(prospect.id); }}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={prospect.pinned ? "Unpin" : "Pin"}
                      title={prospect.pinned ? "Unpin" : "Pin"}
                    >
                      <Pin className={cn("h-3 w-3", prospect.pinned ? "fill-primary text-primary" : "text-muted-foreground")} />
                    </button>
                  </div>
                </div>

                {lastMsgText && (
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    <span className="text-muted-foreground/70">{lastMsg.fromMe === false ? "Them" : "Me"}:</span>{" "}
                    {lastMsgText}
                  </div>
                )}

                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                  <span className="truncate text-muted-foreground">→ {nextAction}</span>
                  <span className={cn("num shrink-0", overdue ? "text-destructive" : "text-muted-foreground")}>
                    {overdue && <AlertTriangle className="mr-0.5 inline h-2.5 w-2.5" />}
                    {stageDays}d · {prospect.qualScore}
                  </span>
                </div>

                <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={(e) => { e.stopPropagation(); navigate({ to: "/inbox", search: { prospect: prospect.id } }); }}
                  >
                    <Inbox className="mr-1 h-3 w-3" /> Inbox
                  </Button>
                </div>
              </div>
            </HoverCardTrigger>
            <HoverCardContent align="start" className="w-80 space-y-2">
              <div>
                <div className="font-display text-sm font-semibold">{prospect.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {prospect.platform} · {prospect.niche || "no niche"}
                </div>
              </div>
              {prospect.bio && (
                <p className="line-clamp-3 text-xs text-muted-foreground">{prospect.bio}</p>
              )}
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {(["need", "timeline", "authority", "budget"] as const).map((k) => (
                  <div key={k} className="rounded border border-border bg-background px-1.5 py-1 text-center">
                    <div className="uppercase tracking-widest text-muted-foreground">{k.slice(0, 4)}</div>
                    <div className="num font-semibold">{prospect.bant[k]}/2</div>
                  </div>
                ))}
              </div>
              {Object.entries(prospect.signals).filter(([, v]) => v).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(prospect.signals)
                    .filter(([, v]) => v)
                    .map(([k]) => (
                      <span key={k} className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
                        {k}
                      </span>
                    ))}
                </div>
              )}
              <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
                Next: <span className="text-foreground">{nextAction}</span>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => navigate({ to: "/prospects/$id", params: { id: prospect.id } })}>
          <ArrowRight className="mr-2 h-3.5 w-3.5" /> Open prospect
        </ContextMenuItem>
        <ContextMenuItem onClick={() => navigate({ to: "/inbox", search: { prospect: prospect.id } })}>
          <MessageSquare className="mr-2 h-3.5 w-3.5" /> Open in inbox
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => togglePin(prospect.id)}>
          <Pin className="mr-2 h-3.5 w-3.5" /> {prospect.pinned ? "Unpin" : "Pin to top"}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ArrowRight className="mr-2 h-3.5 w-3.5" /> Move to stage
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {STAGES.filter((s) => s !== prospect.stage).map((s) => (
              <ContextMenuItem
                key={s}
                onClick={() => {
                  void import("@/lib/undoable").then((m) => m.undoableStageMove(prospect.id, s));
                }}
              >
                {s}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          onClick={() => {
            const dup = duplicateProspect(prospect.id);
            if (dup) toast.success(`Duplicated as ${dup.name}`);
          }}
        >
          <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            void import("@/lib/undoable").then((m) => m.undoableDelete(prospect));
          }}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

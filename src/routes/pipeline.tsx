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
  STAGE_AGE_LIMIT,
  PLATFORMS,
  platformEmoji,
  type Platform,
  type Stage,
  type Tier,
} from "@/lib/btf/types";
import { useStore, daysSince } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [tier, setTier] = useState<Tier | "all">("all");

  const filtered = useMemo(() => prospects.filter((p) => {
    if (platform !== "all" && p.platform !== platform) return false;
    if (tier !== "all" && p.tier !== tier) return false;
    return true;
  }), [prospects, platform, tier]);

  const byStage = useMemo(() => {
    const map: Record<Stage, typeof prospects> = Object.fromEntries(
      STAGES.map((s) => [s, [] as typeof prospects]),
    ) as any;
    filtered.forEach((p) => map[p.stage].push(p));
    return map;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const stage = e.over?.id as Stage | undefined;
    if (!stage) return;
    moveStage(id, stage);
  };

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Drag prospects across BTF stages.">
        <Tabs value={view} onValueChange={(v) => setView(v as "board" | "table")}>
          <TabsList>
            <TabsTrigger value="board" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Board</TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5"><TableIcon className="h-3.5 w-3.5" /> Table</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.emoji} {p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={(v) => setTier(v as any)}>
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
              {STAGES.map((stage) => (
                <Column key={stage} stage={stage} items={byStage[stage]} />
              ))}
            </div>
          </DndContext>
        ) : (
          <TableView items={filtered} onStageChange={moveStage} onOpen={(id) => navigate({ to: "/prospects/$id", params: { id } })} />
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
  items: ReturnType<typeof useStore.getState>["prospects"];
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
                onDoubleClick={() => onOpen(p.id)}
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

function Column({
  stage,
  items,
}: {
  stage: Stage;
  items: ReturnType<typeof useStore.getState>["prospects"];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 flex-shrink-0 flex-col rounded-lg border bg-card",
        isOver ? "border-primary" : "border-border",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-display text-sm font-semibold">{stage}</span>
        <Badge variant="outline" className="num text-[10px]">{items.length}</Badge>
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

function Card({ prospect }: { prospect: ReturnType<typeof useStore.getState>["prospects"][number] }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: prospect.id });
  const stageDays = daysSince(prospect.stageEnteredAt);
  const limit = STAGE_AGE_LIMIT[prospect.stage];
  const overdue = limit !== undefined && stageDays > limit;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={() => navigate({ to: "/prospects/$id", params: { id: prospect.id } })}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "cursor-grab rounded-md border bg-surface p-2.5 active:cursor-grabbing",
        overdue ? "border-destructive/60" : "border-border",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">
          {platformEmoji(prospect.platform)} {prospect.name}
        </span>
        <Badge variant="secondary" className="text-[10px]">{prospect.tier}</Badge>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground num">
        <span>{stageDays}d in stage</span>
        <span>{prospect.qualScore}/100</span>
      </div>
    </div>
  );
}

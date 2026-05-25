import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { PageBody, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Download, Upload, Trash2, X, ArrowUpDown } from "lucide-react";
import { ProspectCard } from "@/components/ProspectCard";
import { ProspectDrawer } from "@/components/ProspectDrawer";
import { useStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORMS, STAGES, type Platform, type Stage, type Tier } from "@/lib/btf/types";
import { prospectsToCsv, downloadCsv } from "@/lib/csvExport";
import { parseProspectsCsv } from "@/lib/csvImport";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SortOption = "newest" | "oldest" | "name-az" | "name-za" | "score-high" | "score-low";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "name-az": "Name A → Z",
  "name-za": "Name Z → A",
  "score-high": "Score: high → low",
  "score-low": "Score: low → high",
};


export const Route = createFileRoute("/prospects")({
  head: () => ({
    meta: [
      { title: "Prospects — BTF Setter OS" },
      { name: "description", content: "Search and manage your prospect list." },
    ],
  }),
  component: ProspectsPage,
});

function ProspectsPage() {
  const prospects = useStore((s) => s.prospects);
  const addProspect = useStore((s) => s.addProspect);
  const deleteProspect = useStore((s) => s.deleteProspect);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = prospects.find((p) => p.id === editingId) ?? null;

  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const { rows, errors } = parseProspectsCsv(text);
      if (!rows.length) {
        toast.error(errors[0] ?? "No rows found.");
        return;
      }
      const existing = new Set(
        prospects.map((p) => `${p.name.toLowerCase()}|${(p.profileUrl ?? "").toLowerCase()}`),
      );
      let added = 0;
      let skipped = 0;
      for (const r of rows) {
        const key = `${r.name.toLowerCase()}|${(r.profileUrl ?? "").toLowerCase()}`;
        if (existing.has(key)) { skipped++; continue; }
        addProspect(r);
        existing.add(key);
        added++;
      }
      toast.success(
        `Imported ${added} prospect${added === 1 ? "" : "s"}` +
          (skipped ? ` · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : "") +
          (errors.length ? ` · ${errors.length} row issue${errors.length === 1 ? "" : "s"}` : ""),
      );
    } catch (e) {
      toast.error("Could not read file.");
    }
  };


  const filtered = useMemo(() => {
    const list = prospects.filter((p) => {
      if (q && !`${p.name} ${p.niche} ${p.bio}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (platform !== "all" && p.platform !== platform) return false;
      if (stage !== "all" && p.stage !== stage) return false;
      if (tier !== "all" && p.tier !== tier) return false;
      return true;
    });
    const sorted = [...list];
    switch (sort) {
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "name-az":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-za":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "score-high":
        sorted.sort((a, b) => (b.qualScore ?? 0) - (a.qualScore ?? 0));
        break;
      case "score-low":
        sorted.sort((a, b) => (a.qualScore ?? 0) - (b.qualScore ?? 0));
        break;
    }
    return sorted;
  }, [prospects, q, platform, stage, tier, sort]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((p) => p.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const doBulkDelete = () => {
    selectedIds.forEach((id) => deleteProspect(id));
    toast.success(`${selectedIds.size} prospect${selectedIds.size === 1 ? "" : "s"} deleted`);
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  };

  return (
    <>
      <PageHeader
        title="Prospects"
        subtitle={`${prospects.length} total`}
      >
        {bulkMode ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => { setBulkMode(false); clearSelection(); }}>
              <X className="mr-1 h-4 w-4" /> Done
            </Button>
            <Button size="sm" variant="outline" onClick={selectAll}>
              Select all ({filtered.length})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!selectedIds.size}
              onClick={() => setConfirmBulkDelete(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete ({selectedIds.size})
            </Button>
          </>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Import CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!filtered.length) return toast.error("Nothing to export.");
                downloadCsv(`prospects-${new Date().toISOString().slice(0, 10)}.csv`, prospectsToCsv(filtered));
                toast.success(`Exported ${filtered.length} prospects`);
              }}
            >
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setBulkMode(true); clearSelection(); }}>
              <Trash2 className="mr-1 h-4 w-4" /> Bulk
            </Button>
            <Button size="sm" onClick={() => { setEditingId(null); setOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </>
        )}
      </PageHeader>

      <PageBody className="space-y-4">
        {bulkMode && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
            <span className="font-medium">{selectedIds.size} selected</span>
            <button className="ml-auto text-xs underline text-muted-foreground" onClick={clearSelection}>
              Clear
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, niche, bio..."
              className="pl-8"
            />
          </div>
          <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.emoji} {p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stage} onValueChange={(v) => setStage(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[150px]">
              <ArrowUpDown className="mr-1 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            {prospects.length === 0
              ? "Add your first prospect to get going."
              : "No matches for those filters."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProspectCard
                key={p.id}
                prospect={p}
                selected={bulkMode ? selectedIds.has(p.id) : undefined}
                onToggleSelect={bulkMode ? () => toggleSelect(p.id) : undefined}
                onClick={!bulkMode ? () => navigate({ to: "/prospects/$id", params: { id: p.id } }) : undefined}
                onEdit={!bulkMode ? () => { setEditingId(p.id); setOpen(true); } : undefined}
                onInbox={!bulkMode ? () => {
                  navigate({ to: "/inbox", search: { prospect: p.id } });
                } : undefined}
                onAnalyze={!bulkMode ? () => {
                  const map = useStore.getState().threadProspectMap;
                  const threadId = Object.entries(map).find(([, pid]) => pid === p.id)?.[0];
                  const payload = threadId
                    ? { threadId, prospectId: p.id }
                    : {
                        prospectId: p.id,
                        profileUrl: p.profileUrl,
                        profileText: [p.name, p.niche, p.bio].filter(Boolean).join("\n"),
                      };
                  sessionStorage.setItem("btf:analyze", JSON.stringify(payload));
                  navigate({ to: "/linkedin" });
                } : undefined}
              />
            ))}
          </div>
        )}
      </PageBody>

      <ProspectDrawer open={open} onOpenChange={setOpen} editing={editing} />

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} prospect{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected prospects and their activity logs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

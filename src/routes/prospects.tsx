import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { PageBody, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Download, Upload } from "lucide-react";
import { ProspectCard } from "@/components/ProspectCard";
import { ProspectDrawer } from "@/components/ProspectDrawer";
import { useStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORMS, STAGES, type Platform, type Stage, type Tier } from "@/lib/btf/types";
import { prospectsToCsv, downloadCsv } from "@/lib/csvExport";
import { parseProspectsCsv } from "@/lib/csvImport";
import { toast } from "sonner";


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
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = prospects.find((p) => p.id === editingId) ?? null;

  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [tier, setTier] = useState<Tier | "all">("all");

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
    return prospects.filter((p) => {
      if (q && !`${p.name} ${p.niche} ${p.bio}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (platform !== "all" && p.platform !== platform) return false;
      if (stage !== "all" && p.stage !== stage) return false;
      if (tier !== "all" && p.tier !== tier) return false;
      return true;
    });
  }, [prospects, q, platform, stage, tier]);

  return (
    <>
      <PageHeader title="Prospects" subtitle={`${prospects.length} total`}>
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
        <Button size="sm" onClick={() => { setEditingId(null); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </PageHeader>

      <PageBody className="space-y-4">
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
                onClick={() => navigate({ to: "/prospects/$id", params: { id: p.id } })}
                onEdit={() => { setEditingId(p.id); setOpen(true); }}
                onAnalyze={() => {
                  const map = useStore.getState().threadProspectMap;
                  const threadId = Object.entries(map).find(([, pid]) => pid === p.id)?.[0];
                  const payload = threadId
                    ? { threadId }
                    : { profileText: [p.name, p.niche, p.bio].filter(Boolean).join("\n") };
                  sessionStorage.setItem("btf:analyze", JSON.stringify(payload));
                  navigate({ to: "/linkedin" });
                }}
              />
            ))}
          </div>
        )}
      </PageBody>

      <ProspectDrawer open={open} onOpenChange={setOpen} editing={editing} />
    </>
  );
}

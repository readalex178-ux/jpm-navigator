import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Search, Trash2, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vn-vault")({
  head: () => ({
    meta: [
      { title: "VN Vault — BTF Setter OS" },
      {
        name: "description",
        content: "Search, filter, and sort every voice note you've ever sent.",
      },
    ],
  }),
  component: VnVaultPage,
});

type Filter = "all" | "used" | "unused";
type Sort = "newest" | "oldest" | "best";

const OUTCOME_RANK: Record<string, number> = { booked: 3, reply: 2, ghosted: 1 };

function VnVaultPage() {
  const vnScripts = useStore((s) => s.vnScripts);
  const updateVnScript = useStore((s) => s.updateVnScript);
  const removeVnScript = useStore((s) => s.removeVnScript);
  const prospects = useStore((s) => s.prospects);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const prospectName = (id?: string) =>
    (id && prospects.find((p) => p.id === id)?.name) || "";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = vnScripts.slice();
    if (filter === "used") rows = rows.filter((s) => s.used);
    if (filter === "unused") rows = rows.filter((s) => !s.used);
    if (needle) {
      rows = rows.filter((s) => {
        const hay = [
          s.prospectName,
          s.niche ?? "",
          s.scenario ?? "",
          s.text ?? "",
          prospectName(s.prospectId),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    if (sort === "newest") rows.sort((a, b) => b.date.localeCompare(a.date));
    else if (sort === "oldest") rows.sort((a, b) => a.date.localeCompare(b.date));
    else
      rows.sort((a, b) => {
        const ra = OUTCOME_RANK[a.outcome ?? ""] ?? 0;
        const rb = OUTCOME_RANK[b.outcome ?? ""] ?? 0;
        if (rb !== ra) return rb - ra;
        return b.date.localeCompare(a.date);
      });
    return rows;
  }, [vnScripts, q, filter, sort, prospects]);

  const counts = useMemo(() => {
    const used = vnScripts.filter((s) => s.used).length;
    return { total: vnScripts.length, used, unused: vnScripts.length - used };
  }, [vnScripts]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <>
      <PageHeader
        title="VN Vault"
        subtitle="Every voice note opener you've written — searchable, sortable, reusable."
      />
      <PageBody className="space-y-4">
        <Section title="Filter & search">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, niche, scenario, content…"
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(["all", "unused", "used"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 capitalize transition-colors",
                    filter === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}{" "}
                  <span className="ml-1 text-[10px] opacity-70">
                    {f === "all" ? counts.total : f === "used" ? counts.used : counts.unused}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(
                [
                  { v: "newest" as Sort, l: "Newest" },
                  { v: "oldest" as Sort, l: "Oldest" },
                  { v: "best" as Sort, l: "Best performing" },
                ]
              ).map((o) => (
                <button
                  key={o.v}
                  onClick={() => setSort(o.v)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 transition-colors",
                    sort === o.v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {vnScripts.length === 0
              ? "No VN scripts saved yet. Generate one in Tools → VN Builder."
              : "No scripts match your filters."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="rounded-md border border-border bg-card p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-medium text-foreground">{s.prospectName || "Unknown"}</span>
                    {s.prospectId && (
                      <Link
                        to="/prospects/$id"
                        params={{ id: s.prospectId }}
                        className="text-[11px] text-primary underline-offset-2 hover:underline"
                      >
                        open
                      </Link>
                    )}
                    {s.niche && <Badge variant="outline" className="text-[10px]">{s.niche}</Badge>}
                    {s.scenario && <Badge variant="outline" className="text-[10px]">{s.scenario}</Badge>}
                    {s.outcome && (
                      <Badge
                        className={cn(
                          "text-[10px]",
                          s.outcome === "booked" && "bg-success/15 text-success",
                          s.outcome === "reply" && "bg-primary/15 text-primary",
                          s.outcome === "ghosted" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {s.outcome}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground num">
                      {s.date.slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => updateVnScript(s.id, { used: !s.used })}
                      title={s.used ? "Mark unused" : "Mark used"}
                    >
                      {s.used ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => copy(s.text)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => {
                        removeVnScript(s.id);
                        toast.message("Script removed");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="whitespace-pre-wrap rounded bg-surface p-2 text-sm leading-relaxed">
                  {s.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

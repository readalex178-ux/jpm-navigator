// Global command palette (⌘K / Ctrl+K).
// Searches prospects + quick-jumps to top routes. No mutations.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useStore } from "@/lib/store";
import { platformEmoji } from "@/lib/btf/types";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Inbox,
  Linkedin,
  TrendingUp,
  Settings as SettingsIcon,
  AlarmClock,
} from "lucide-react";

const ROUTES = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/on-deck", label: "On Deck", icon: AlarmClock },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/prospects", label: "Prospects", icon: Users },
  { to: "/linkedin", label: "LinkedIn Co-Pilot", icon: Linkedin },
  { to: "/kpi", label: "KPI Tracker", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const prospects = useStore((s) => s.prospects);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    if (!q.trim()) return prospects.slice(0, 8);
    const needle = q.toLowerCase();
    return prospects
      .filter((p) =>
        [p.name, p.niche, p.bio, p.profileUrl]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      )
      .slice(0, 12);
  }, [q, prospects]);

  const go = (to: string) => {
    setOpen(false);
    setQ("");
    // routed paths use $id for prospect detail; navigate via string is fine
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search prospects, jump to a page…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {matches.length > 0 && (
          <CommandGroup heading="Prospects">
            {matches.map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.name} ${p.niche ?? ""}`}
                onSelect={() => go(`/prospects/${p.id}`)}
              >
                <span className="mr-2">{platformEmoji(p.platform)}</span>
                <span className="font-medium">{p.name}</span>
                <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
                  {p.stage} · {p.qualScore}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Jump to">
          {ROUTES.map((r) => (
            <CommandItem
              key={r.to}
              value={`go ${r.label}`}
              onSelect={() => go(r.to)}
            >
              <r.icon className="mr-2 h-3.5 w-3.5" />
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

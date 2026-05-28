// Templates panel — click-gated insertion of reusable message snippets
// into the LinkedIn co-pilot composer. Reads from the existing VN script
// vault (`vnScripts`) plus a small curated default set. No-automation:
// inserting is always a single user click.

import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Library, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type CuratedTemplate = {
  id: string;
  category: "Calendar" | "Objection" | "Re-engage" | "Voice note";
  label: string;
  text: (params: { firstName: string; calendarLink: string }) => string;
};

const CURATED: CuratedTemplate[] = [
  {
    id: "cal-share",
    category: "Calendar",
    label: "Share calendar link",
    text: ({ firstName, calendarLink }) =>
      `Hey ${firstName} — here's the link to grab a 15-min slot, no pressure: ${calendarLink}\n\nLet me know if any of those times work.`,
  },
  {
    id: "obj-busy",
    category: "Objection",
    label: "“I'm too busy” reframe",
    text: ({ firstName }) =>
      `Totally get it ${firstName}. Most operators I talk to feel the same — that's usually exactly when a 15-min audit pays back fastest. Want me to send a couple of times and you can pick whatever's least painful?`,
  },
  {
    id: "obj-price",
    category: "Objection",
    label: "Price pushback",
    text: ({ firstName }) =>
      `Fair pushback ${firstName}. Worth saying: the only thing the call costs is 15 mins. If it's not a fit you walk with the audit notes either way — no pitch.`,
  },
  {
    id: "reengage-30d",
    category: "Re-engage",
    label: "30-day ghost re-engage",
    text: ({ firstName }) =>
      `Hey ${firstName} — been a minute. Different angle this time: [insert one specific observation about their recent post]. Worth a quick chat?`,
  },
  {
    id: "vn-intro",
    category: "Voice note",
    label: "Cold VN intro (script outline)",
    text: ({ firstName }) =>
      `[Pattern interrupt]: Hey ${firstName}, weird DM incoming —\n[Observation]: noticed you're [specific thing about their profile/content].\n[Hook]: most people in your spot are bottlenecked on [problem].\n[CTA]: worth a 10-min trade of notes? No pitch.`,
  },
];

export function TemplatesSheet({
  onInsert,
  firstName,
  triggerLabel = "Templates",
}: {
  onInsert: (text: string) => void;
  firstName: string;
  triggerLabel?: string;
}) {
  const settings = useStore((s) => s.settings);
  const vnScripts = useStore((s) => s.vnScripts);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const calendarLink = settings.calendarLink || "[your-calendar-link]";

  const curated = useMemo(
    () =>
      CURATED.map((t) => ({
        id: t.id,
        category: t.category,
        label: t.label,
        text: t.text({ firstName: firstName || "there", calendarLink }),
        kind: "curated" as const,
      })),
    [firstName, calendarLink],
  );

  const vaultRows = useMemo(
    () =>
      vnScripts.slice(0, 50).map((s) => ({
        id: s.id,
        category: s.scenario || "VN",
        label: s.prospectName
          ? `${s.scenario || "VN"} — ${s.prospectName}`
          : s.scenario || "VN",
        text: s.text,
        kind: "vault" as const,
      })),
    [vnScripts],
  );

  const all = [...curated, ...vaultRows];
  const filtered = q
    ? all.filter((r) =>
        (r.label + " " + r.text + " " + r.category)
          .toLowerCase()
          .includes(q.toLowerCase()),
      )
    : all;

  const insert = (text: string) => {
    onInsert(text);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Library className="mr-1 h-3 w-3" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Templates</SheetTitle>
          <SheetDescription>
            One-click insert into the composer. Edit before sending.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search templates and vault…"
              className="pl-7 text-xs"
            />
          </div>
          <ScrollArea className="h-[70vh] pr-2">
            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No templates match.
                </div>
              )}
              {filtered.map((r) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  onClick={() => insert(r.text)}
                  className={cn(
                    "block w-full rounded-md border border-border bg-surface p-2.5 text-left text-xs hover:border-primary/40",
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px]">
                      {r.category}
                    </Badge>
                    <span className="font-medium">{r.label}</span>
                    {r.kind === "vault" && (
                      <Badge variant="outline" className="ml-auto text-[9px]">
                        vault
                      </Badge>
                    )}
                  </div>
                  <div className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                    {r.text}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

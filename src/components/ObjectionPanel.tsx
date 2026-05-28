import { useState } from "react";
import { MessageSquareWarning, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OBJECTIONS } from "@/lib/btf/playbook";

/**
 * Objection handler panel (#48) — slide-in sheet with categorized BTF
 * objection responses + copy-to-clipboard. No automation; user copies
 * the line themselves.
 *
 * Render the trigger anywhere (conversation toolbar, prospect record,
 * pipeline card menu). Pass children to customize the button look.
 */
export function ObjectionPanel({
  triggerLabel = "Objections",
  triggerVariant = "outline",
  triggerSize = "sm",
  className,
}: {
  triggerLabel?: string;
  triggerVariant?: "outline" | "ghost" | "default" | "secondary";
  triggerSize?: "sm" | "default" | "icon";
  className?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = OBJECTIONS.filter((o) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      o.label.toLowerCase().includes(needle) ||
      o.trigger.toLowerCase().includes(needle) ||
      o.response.toLowerCase().includes(needle)
    );
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied: ${label}`);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size={triggerSize} variant={triggerVariant} className={className}>
          <MessageSquareWarning className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Objection handler</SheetTitle>
          <SheetDescription>
            BTF framework responses. Click to copy — never auto-sent.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search objections…"
              className="pl-8 text-xs"
            />
          </div>

          <ul className="space-y-3">
            {filtered.map((o) => (
              <li key={o.id} className="rounded-md border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {o.label}
                    </div>
                    <div className="mt-1 text-xs italic text-muted-foreground">
                      {o.trigger}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => copy(o.response, o.label)}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {o.response}
                </p>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No objections match "{q}".
              </li>
            )}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

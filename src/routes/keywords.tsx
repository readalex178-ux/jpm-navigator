import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { KEYWORD_BANK } from "@/lib/btf/keywords";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/keywords")({
  head: () => ({
    meta: [
      { title: "Keyword Bank — BTF Setter OS" },
      {
        name: "description",
        content: "BTF prospecting keywords — job titles, content signals, and pain signals. Click to copy.",
      },
    ],
  }),
  component: KeywordsPage,
});

function KeywordsPage() {
  const customKeywords = useStore((s) => s.keywordBank);
  const addKeyword = useStore((s) => s.addKeyword);
  const removeKeyword = useStore((s) => s.removeKeyword);
  const [draft, setDraft] = useState("");

  const copy = (kw: string) => {
    navigator.clipboard.writeText(kw);
    toast.success(`Copied "${kw}"`);
  };

  const onAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (customKeywords.includes(trimmed)) {
      toast.error("Already saved");
      return;
    }
    addKeyword(trimmed);
    setDraft("");
  };

  return (
    <>
      <PageHeader
        title="Keyword Bank"
        subtitle="Search vocabulary that surfaces BTF-fit prospects. Click any chip to copy."
      />
      <PageBody className="space-y-4">
        {KEYWORD_BANK.map((section) => (
          <Section key={section.id} title={section.title}>
            <p className="mb-3 text-xs text-muted-foreground">{section.subtitle}</p>
            <div className="flex flex-wrap gap-1.5">
              {section.keywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => copy(kw)}
                  className="group rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                >
                  <span>{kw}</span>
                  <Copy className="ml-1 inline h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70" />
                </button>
              ))}
            </div>
          </Section>
        ))}

        <Section title="Your saved keywords">
          <div className="mb-3 flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAdd()}
              placeholder="Add a keyword that works for your niche…"
              className="flex-1"
            />
            <Button onClick={onAdd} size="sm">
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          {customKeywords.length === 0 ? (
            <div className="rounded border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Saved keywords appear here. Add ones that consistently produce booked calls.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {customKeywords.map((kw) => (
                <div
                  key={kw}
                  className="group flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary"
                >
                  <button onClick={() => copy(kw)} className="hover:underline">
                    {kw}
                  </button>
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="ml-1 opacity-60 hover:opacity-100"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </PageBody>
    </>
  );
}

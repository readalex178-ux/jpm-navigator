/**
 * Slide-out history of every CSV import the user has done in this browser.
 * Backed by the in-browser log at `lib/importLog.ts`.
 */
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, Trash2 } from "lucide-react";
import { readImportLog, clearImportLog, type ImportLogEntry } from "@/lib/importLog";

export function ImportHistorySheet({
  open,
  onOpenChange,
  /** Bump this when a new import is logged to force a refresh while sheet is open. */
  refreshKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<ImportLogEntry[]>([]);

  useEffect(() => {
    if (open) setEntries(readImportLog());
  }, [open, refreshKey]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Import history
          </SheetTitle>
          <SheetDescription>
            Every CSV import attempted in this browser. Stored locally — survives page reload, not across devices.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="rounded-md border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium" title={e.filename}>{e.filename}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.importedAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge tone="ok">{e.added} imported</Badge>
                  {e.skippedDuplicates > 0 && <Badge tone="info">{e.skippedDuplicates} duplicates</Badge>}
                  {e.failed > 0 && <Badge tone="warn">{e.failed} failed</Badge>}
                </div>
                {e.failures.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      View {e.failures.length} failed row{e.failures.length === 1 ? "" : "s"}
                    </summary>
                    <ul className="mt-1 max-h-32 space-y-1 overflow-auto text-xs">
                      {e.failures.map((f, i) => (
                        <li key={i} className="text-muted-foreground">
                          <span className="font-mono">Row {f.row}:</span> {f.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))
          )}

          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => {
                clearImportLog();
                setEntries([]);
              }}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Clear history
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Badge({ tone, children }: { tone: "ok" | "info" | "warn"; children: React.ReactNode }) {
  const cls = {
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  }[tone];
  return (
    <span className={`rounded border px-1.5 py-0.5 ${cls}`}>{children}</span>
  );
}

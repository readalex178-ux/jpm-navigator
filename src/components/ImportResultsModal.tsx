/**
 * Detailed import results modal. Shown after every CSV import in place of
 * the old single-line toast.
 *
 * The modal owns its open state via the `result` prop — pass `null` to close.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, FileWarning, SkipForward } from "lucide-react";
import type { RowIssue } from "@/lib/csvImport";

export type ImportResult = {
  filename: string;
  added: number;
  skippedDuplicates: number;
  failures: RowIssue[];
  errors: string[];
};

export function ImportResultsModal({
  result,
  onClose,
}: {
  result: ImportResult | null;
  onClose: () => void;
}) {
  const open = !!result;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import results</DialogTitle>
          <DialogDescription className="truncate">{result?.filename}</DialogDescription>
        </DialogHeader>

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                label="Imported"
                value={result.added}
                tone="ok"
              />
              <Stat
                icon={<SkipForward className="h-4 w-4 text-blue-400" />}
                label="Duplicates"
                value={result.skippedDuplicates}
                tone="info"
              />
              <Stat
                icon={<FileWarning className="h-4 w-4 text-amber-500" />}
                label="Failed"
                value={result.failures.length}
                tone={result.failures.length ? "warn" : "muted"}
              />
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">File errors</p>
                <ul className="mt-1 list-disc pl-4">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {result.failures.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Failed rows</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const text = result.failures
                        .map((f) => `Row ${f.row}: ${f.reason}`)
                        .join("\n");
                      navigator.clipboard.writeText(text).catch(() => {});
                    }}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
                <div className="max-h-48 overflow-auto rounded border border-border bg-background/50 text-xs">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-muted/50">
                      <tr className="text-left">
                        <th className="px-2 py-1">Row</th>
                        <th className="px-2 py-1">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failures.map((f, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1 font-mono">{f.row}</td>
                          <td className="px-2 py-1">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "ok" | "info" | "warn" | "muted";
}) {
  const toneClass = {
    ok: "border-emerald-500/30 bg-emerald-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
    warn: "border-amber-500/30 bg-amber-500/5",
    muted: "border-border bg-muted/20",
  }[tone];
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

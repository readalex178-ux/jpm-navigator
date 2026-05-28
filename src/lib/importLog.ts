/**
 * Import history log — kept in localStorage. Each CSV import appends one entry
 * so the user can see what happened over time without us spinning up another
 * Supabase table.
 *
 * If we later want cross-device history we can move this to a `csv_imports`
 * table; the shape below is forward-compatible.
 */

export type ImportLogEntry = {
  id: string;
  filename: string;
  importedAt: string; // ISO
  added: number;
  skippedDuplicates: number;
  failed: number;
  failures: Array<{ row: number; reason: string }>;
};

const KEY = "btf:csvImportLog";
const MAX_ENTRIES = 50;

export function readImportLog(): ImportLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendImportLog(entry: Omit<ImportLogEntry, "id" | "importedAt">): ImportLogEntry {
  const full: ImportLogEntry = {
    id: Math.random().toString(36).slice(2, 11),
    importedAt: new Date().toISOString(),
    ...entry,
  };
  const next = [full, ...readImportLog()].slice(0, MAX_ENTRIES);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota — best-effort */
    }
  }
  return full;
}

export function clearImportLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

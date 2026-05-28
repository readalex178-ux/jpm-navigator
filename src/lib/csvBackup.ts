/**
 * Backup nag — tracks the timestamp of the user's most recent CSV export
 * in localStorage so we can prompt them to back up every 7 days.
 *
 * The actual export work lives in `csvExport.ts`. This module only owns the
 * "last export timestamp" memory.
 */

const KEY = "btf:lastCsvExportAt";
const SESSION_DISMISS_KEY = "btf:backupModalDismissedAt";
const BANNER_DISMISS_KEY = "btf:backupBannerDismissedAt";

export const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function getLastExportAt(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function markExportNow(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, String(Date.now()));
  // Reset both dismissals — the user just backed up, so any "remind me later"
  // state from a previous nag is no longer relevant.
  localStorage.removeItem(SESSION_DISMISS_KEY);
  localStorage.removeItem(BANNER_DISMISS_KEY);
}

export function daysSinceLastExport(): number | null {
  const ts = getLastExportAt();
  if (ts == null) return null;
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

/** Banner shows when no export in last 7 days AND not dismissed in last 24h. */
export function shouldShowBanner(): boolean {
  if (typeof window === "undefined") return false;
  const last = getLastExportAt();
  if (last != null && Date.now() - last < BACKUP_INTERVAL_MS) return false;
  const dismissed = Number(localStorage.getItem(BANNER_DISMISS_KEY) ?? 0);
  return Date.now() - dismissed > 24 * 60 * 60 * 1000;
}

export function dismissBannerFor24h(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now()));
}

/** First-open modal: shows once per browser session if 7+ days since export. */
export function shouldShowModalOnOpen(): boolean {
  if (typeof window === "undefined") return false;
  const last = getLastExportAt();
  // If user has NEVER exported and has prospects, also nag (handled by caller
  // checking prospect count).
  if (last != null && Date.now() - last < BACKUP_INTERVAL_MS) return false;
  // Dismissed this session?
  if (sessionStorage.getItem(SESSION_DISMISS_KEY)) return false;
  return true;
}

export function dismissModalForSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
}

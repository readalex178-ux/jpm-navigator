/**
 * Backup nag — banner + first-open-of-the-week modal.
 *
 * Mounted once at the app root. Both surfaces share the same "last export"
 * timestamp in localStorage (see `csvBackup.ts`).
 *
 * The export button here runs a full snapshot of all prospects (filtered
 * exports on the prospects page also stamp `markExportNow`).
 */
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, X, ShieldAlert } from "lucide-react";
import { prospectsToCsv, downloadCsv } from "@/lib/csvExport";
import {
  daysSinceLastExport,
  dismissBannerFor24h,
  dismissModalForSession,
  getLastExportAt,
  markExportNow,
  shouldShowBanner,
  shouldShowModalOnOpen,
} from "@/lib/csvBackup";
import { toast } from "sonner";

function runBackupNow(prospects: ReturnType<typeof useStore.getState>["prospects"]) {
  if (!prospects.length) {
    toast.error("No prospects to back up yet.");
    return false;
  }
  const filename = `prospects-backup-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(filename, prospectsToCsv(prospects));
  markExportNow();
  toast.success(`Backed up ${prospects.length} prospects.`);
  return true;
}

export function BackupReminder() {
  const prospects = useStore((s) => s.prospects);
  const hydrated = useStore((s) => s.hydrated);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Recompute when storage changes (after backup the helpers update LS).
  const [tick, setTick] = useState(0);

  // Decide whether to surface anything on app open / hydration.
  useEffect(() => {
    if (!hydrated) return;
    // Don't nag a brand-new user with zero prospects.
    if (!prospects.length) return;
    setBannerOpen(shouldShowBanner());
    setModalOpen(shouldShowModalOnOpen());
  }, [hydrated, prospects.length, tick]);

  const handleExport = () => {
    const ok = runBackupNow(prospects);
    if (ok) {
      setBannerOpen(false);
      setModalOpen(false);
      setTick((n) => n + 1);
    }
  };

  const handleDismissBanner = () => {
    dismissBannerFor24h();
    setBannerOpen(false);
  };

  const handleDismissModal = () => {
    dismissModalForSession();
    setModalOpen(false);
  };

  const last = getLastExportAt();
  const days = daysSinceLastExport();
  const neverExported = last == null;

  return (
    <>
      {bannerOpen && (
        <div className="sticky top-0 z-30 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="flex-1">
              {neverExported
                ? "You haven't backed up your prospects yet. Export a CSV so you don't lose data."
                : `It's been ${days} days since your last CSV backup. Export now to stay safe.`}
            </span>
            <Button size="sm" variant="default" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Export now
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismissBanner} aria-label="Dismiss for 24 hours">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) handleDismissModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Back up your prospects
            </DialogTitle>
            <DialogDescription>
              {neverExported
                ? "Your prospect data lives in this browser. Download a CSV backup before you keep working — if local storage clears, your data is gone."
                : `Your last CSV backup was ${days} days ago. Take 5 seconds to download a fresh one now.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={handleDismissModal}>
              Skip for now
            </Button>
            <Button onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

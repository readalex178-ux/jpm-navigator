import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { GHL_CHECKLIST_STEPS } from "@/lib/btf/playbook";

/**
 * Global GHL claim guard.
 *
 * Trigger paths (all explicit user actions — never auto-mutates):
 *   1. Any stage move TO "Call Booked" sets `__ghlPromptProspectId`.
 *   2. On app open, if any prospect is in "Call Booked" with ghlClaimed=false
 *      AND ghlRemindAt is past, re-prompt.
 *
 * Modal options: "Yes, claimed" → ghlClaimed=true. "Remind me later" →
 * ghlRemindAt = +2h.
 */
export function GhlClaimModal() {
  const prospects = useStore((s) => s.prospects);
  const updateProspect = useStore((s) => s.updateProspect);
  const ghlPromptProspectId = useStore((s) => s.ghlPromptProspectId);
  const setGhlPromptProspectId = useStore((s) => s.setGhlPromptProspectId);
  const [openedOnce, setOpenedOnce] = useState(false);

  // On first mount, find any overdue reminder
  useEffect(() => {
    if (openedOnce) return;
    setOpenedOnce(true);
    const overdue = prospects.find(
      (p) =>
        p.stage === "Call Booked" &&
        !p.ghlClaimed &&
        p.ghlRemindAt &&
        new Date(p.ghlRemindAt).getTime() <= Date.now(),
    );
    if (overdue) setGhlPromptProspectId(overdue.id);
  }, [openedOnce, prospects, setGhlPromptProspectId]);

  const prospect = useMemo(
    () => prospects.find((p) => p.id === ghlPromptProspectId) ?? null,
    [prospects, ghlPromptProspectId],
  );

  const open = !!prospect;
  const onClose = () => setGhlPromptProspectId(null);

  const onYes = () => {
    if (!prospect) return;
    updateProspect(prospect.id, { ghlClaimed: true, ghlRemindAt: undefined });
    onClose();
  };

  const onRemindLater = () => {
    if (!prospect) return;
    const remind = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    updateProspect(prospect.id, { ghlRemindAt: remind });
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Claim this in GHL?</AlertDialogTitle>
          <AlertDialogDescription>
            {prospect ? (
              <>
                <strong className="text-foreground">{prospect.name}</strong> just
                moved to <em>Call Booked</em>. No GHL claim = no commission.
                Take 30 seconds now and lock it in.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ol className="ml-4 list-decimal space-y-1.5 text-xs text-muted-foreground">
          {GHL_CHECKLIST_STEPS.slice(0, 3).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onRemindLater}>
            Remind me later
          </AlertDialogCancel>
          <AlertDialogAction onClick={onYes}>Yes, claimed</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

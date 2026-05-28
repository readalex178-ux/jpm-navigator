/**
 * Undoable destructive actions.
 *
 * Pattern: apply the change optimistically (so the UI feels instant), then
 * show a sonner toast with an "Undo" button. If the user clicks Undo within
 * 5 seconds the change is reverted using the snapshot we captured at apply
 * time. If the toast dismisses naturally, the change stays.
 *
 * This satisfies the spec's "5s undo" requirement while keeping the call
 * sites a single function call — no per-component timer plumbing.
 */
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Prospect, Stage } from "@/lib/btf/types";

const UNDO_MS = 5000;

export function undoableDelete(prospect: Prospect) {
  const store = useStore.getState();
  const snapshot = { ...prospect };
  store.deleteProspect(prospect.id);
  toast(`${prospect.name} deleted`, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: () => {
        useStore.getState().restoreProspect(snapshot);
        toast.success(`${prospect.name} restored`);
      },
    },
  });
}

export function undoableBulkDelete(prospects: Prospect[]) {
  if (!prospects.length) return;
  const snapshots = prospects.map((p) => ({ ...p }));
  const store = useStore.getState();
  snapshots.forEach((p) => store.deleteProspect(p.id));
  toast(`${prospects.length} prospect${prospects.length === 1 ? "" : "s"} deleted`, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: () => {
        const s = useStore.getState();
        snapshots.forEach((p) => s.restoreProspect(p));
        toast.success(`${snapshots.length} restored`);
      },
    },
  });
}

export function undoableStageMove(prospectId: string, nextStage: Stage) {
  const store = useStore.getState();
  const prospect = store.prospects.find((p) => p.id === prospectId);
  if (!prospect) return;
  if (prospect.stage === nextStage) return;
  const priorStage = prospect.stage;
  const priorEnteredAt = prospect.stageEnteredAt;
  store.moveStage(prospectId, nextStage);
  toast(`Moved ${prospect.name} → ${nextStage}`, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: () => {
        // Revert quietly (no KPI side-effects) by going through updateProspect.
        useStore.getState().updateProspect(prospectId, {
          stage: priorStage,
          stageEnteredAt: priorEnteredAt,
        });
        toast.success(`${prospect.name} restored to ${priorStage}`);
      },
    },
  });
}

import { useCallback } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Stage, Platform, ActivityType } from "@/lib/btf/types";
import type { ProposalRecord } from "./intents";

export function useApplyProposal() {
  const addProspect = useStore((s) => s.addProspect);
  const logActivity = useStore((s) => s.logActivity);
  const moveStage = useStore((s) => s.moveStage);

  return useCallback(
    (proposal: ProposalRecord, prospectId?: string): { ok: boolean; prospectId?: string; label: string } => {
      try {
        if (proposal.kind === "log_activity") {
          if (!prospectId) return { ok: false, label: "No prospect selected" };
          const at: ActivityType = proposal.activityType;
          logActivity(prospectId, {
            type: at,
            date: new Date().toISOString(),
            notes: proposal.note || "",
            fromMe: true,
          });
          toast.success("Activity logged");
          return { ok: true, prospectId, label: `Logged ${at}` };
        }
        if (proposal.kind === "update_stage") {
          if (!prospectId) return { ok: false, label: "No prospect selected" };
          moveStage(prospectId, proposal.stage as Stage);
          toast.success(`Moved to ${proposal.stage}`);
          return { ok: true, prospectId, label: `Moved to ${proposal.stage}` };
        }
        if (proposal.kind === "add_prospect") {
          const created = addProspect({
            name: proposal.name,
            platform: (proposal.platform as Platform) ?? "linkedin",
            niche: proposal.niche ?? "",
            notes: proposal.notes,
          });
          toast.success(`Added ${created.name}`);
          return { ok: true, prospectId: created.id, label: `Added ${created.name}` };
        }
        return { ok: true, label: "Done" };
      } catch (e) {
        console.error("[assistant] apply failed", e);
        toast.error("Couldn't apply that");
        return { ok: false, label: "Failed" };
      }
    },
    [addProspect, logActivity, moveStage],
  );
}

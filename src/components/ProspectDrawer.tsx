import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  type Prospect,
  type Platform,
  type Tier,
  type LeadType,
  type Stage,
  PLATFORMS,
  STAGES,
  EMPTY_SIGNALS,
  SIGNAL_LABELS,
  type BuyingSignals,
} from "@/lib/btf/types";
import { useStore } from "@/lib/store";

const LEAD_TYPES: LeadType[] = [
  "Direct",
  "Lead Magnet",
  "Engagement",
  "Re-Engagement",
  "Ad Lead",
  "No Show",
  "No Close",
];
const TIERS: Tier[] = ["DIY", "DWY", "DFY"];

export function ProspectDrawer({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Prospect | null;
}) {
  const addProspect = useStore((s) => s.addProspect);
  const updateProspect = useStore((s) => s.updateProspect);
  const deleteProspect = useStore((s) => s.deleteProspect);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [niche, setNiche] = useState("");
  const [bio, setBio] = useState("");
  const [leadType, setLeadType] = useState<LeadType>("Direct");
  const [tier, setTier] = useState<Tier>("DWY");
  const [stage, setStage] = useState<Stage>("Found");
  const [signals, setSignals] = useState<BuyingSignals>({ ...EMPTY_SIGNALS });

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setProfileUrl(editing.profileUrl);
      setPlatform(editing.platform);
      setNiche(editing.niche);
      setBio(editing.bio);
      setLeadType(editing.leadType);
      setTier(editing.tier);
      setStage(editing.stage);
      setSignals(editing.signals);
    } else if (open) {
      setName("");
      setProfileUrl("");
      setPlatform("linkedin");
      setNiche("");
      setBio("");
      setLeadType("Direct");
      setTier("DWY");
      setStage("Found");
      setSignals({ ...EMPTY_SIGNALS });
    }
  }, [editing, open]);

  const save = () => {
    if (!name.trim()) return;
    const data = { name, profileUrl, platform, niche, bio, leadType, tier, stage, signals };
    if (editing) updateProspect(editing.id, data);
    else addProspect(data);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="font-display">
            {editing ? "Edit prospect" : "Add prospect"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <div className="mx-auto grid max-w-2xl gap-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </Field>
            <Field label="Profile URL">
              <Input
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Platform">
                <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.emoji} {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Stage">
                <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Niche / industry">
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Coaches, agencies..." />
            </Field>
            <Field label="Bio notes">
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lead type">
                <Select value={leadType} onValueChange={(v) => setLeadType(v as LeadType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Target tier">
                <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Buying signals
              </div>
              <div className="grid gap-2 rounded-md border border-border bg-surface p-3">
                {(Object.keys(SIGNAL_LABELS) as (keyof BuyingSignals)[]).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={signals[k]}
                      onCheckedChange={(v) => setSignals({ ...signals, [k]: !!v })}
                    />
                    {SIGNAL_LABELS[k]}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Save" : "Add prospect"}</Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { type AiProvider } from "@/lib/btf/types";
import { chat, AiNotConfiguredError } from "@/lib/ai/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — BTF Setter OS" },
      { name: "description", content: "Configure AI provider, BTF profile, and export your data." },
    ],
  }),
  component: SettingsPage,
});

const PRESETS: Record<AiProvider, { url: string; model: string }> = {
  groq: { url: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  openai: { url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  openrouter: { url: "https://openrouter.ai/api/v1", model: "anthropic/claude-3.5-sonnet" },
  lmstudio: { url: "http://localhost:1234/v1", model: "local-model" },
};

function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `btf-setter-os-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const onImport = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        importJson(data);
        toast.success("Imported");
      } catch {
        toast.error("Invalid JSON");
      }
    };
    r.readAsText(file);
  };

  const test = async () => {
    setBusy(true);
    try {
      const out = await chat(settings, [{ role: "user", content: "Reply with the single word: ready" }], { temperature: 0 });
      toast.success(`AI online: ${out.slice(0, 60)}`);
    } catch (e) {
      toast.error(e instanceof AiNotConfiguredError ? e.message : `AI error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };


  return (
    <>
      <PageHeader title="Settings" subtitle="AI, profile, and data." />
      <PageBody className="grid gap-4 lg:grid-cols-2">
        <Section title="AI configuration">
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Provider</Label>
              <Select
                value={settings.aiProvider}
                onValueChange={(v) => {
                  const p = v as AiProvider;
                  update({ aiProvider: p, baseUrl: PRESETS[p].url, model: PRESETS[p].model });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="lmstudio">LM Studio (local)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Base URL</Label>
              <Input value={settings.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Model</Label>
              <Input value={settings.model} onChange={(e) => update({ model: e.target.value })} />
            </div>
            {settings.aiProvider !== "lmstudio" && (
              <div className="grid gap-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">API Key</Label>
                <Input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  placeholder="sk-..."
                />
                <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3 w-3 text-primary" />
                  Stored in this browser's localStorage. Anyone with access to this device can read it.
                </div>
              </div>
            )}
            <Button onClick={test} disabled={busy} variant="outline" size="sm">
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Test connection
            </Button>
          </div>
        </Section>

        <Section title="Your BTF profile">
          <div className="space-y-3">
            <Field label="Your name" value={settings.name} onChange={(v) => update({ name: v })} />
            <Field label="LinkedIn URL" value={settings.linkedinUrl} onChange={(v) => update({ linkedinUrl: v })} />
            <Field label="Instagram handle" value={settings.igHandle} onChange={(v) => update({ igHandle: v })} />
            <Field label="Calendar booking link" value={settings.calendarLink} onChange={(v) => update({ calendarLink: v })} />
            <Field
              label="Role start date"
              type="date"
              value={settings.roleStartDate}
              onChange={(v) => update({ roleStartDate: v })}
            />
            <Field
              label="Manager names (for report sign-off)"
              value={settings.managerNames}
              onChange={(v) => update({ managerNames: v })}
            />
            <Field
              label="Monthly commission target ($)"
              type="number"
              value={String(settings.monthlyTarget)}
              onChange={(v) => update({ monthlyTarget: Number(v) || 0 })}
            />
          </div>
        </Section>

        <Section
          title="Objection handler"
          action={
            <Button size="sm" variant="outline" onClick={handleObjection} disabled={busy || !objection}>
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Get response
            </Button>
          }
        >
          <Textarea
            rows={3}
            value={objection}
            onChange={(e) => setObjection(e.target.value)}
            placeholder={`Paste the prospect objection. e.g. "I already tried outbound, didn't work."`}
          />
          {obAnswer && (
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-surface p-3 text-sm leading-relaxed">{obAnswer}</pre>
          )}
        </Section>

        <Section title="Data">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={download}>
              <Download className="mr-1 h-4 w-4" /> Export JSON
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            All BTF Setter OS data lives in this browser. Export regularly.
          </p>
        </Section>
      </PageBody>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

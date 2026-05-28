// 3-step onboarding card shown on Dashboard until all steps are satisfied.

import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  ctaLabel: string;
  ctaTo: string;
  onClick?: () => void;
};

export function OnboardingChecklist({
  onAddProspect,
}: {
  onAddProspect: () => void;
}) {
  const settings = useStore((s) => s.settings);
  const prospects = useStore((s) => s.prospects);

  const calendarDone = !!settings.calendarLink.trim();
  // Lovable provider is always usable; custom providers need an API key.
  const aiDone =
    settings.aiProvider === "lovable" || !!settings.apiKey.trim();
  const prospectsDone = prospects.length > 0;

  const steps: Step[] = [
    {
      id: "calendar",
      label: "Set your calendar link",
      hint: "Used in templates and the “Send calendar link” action.",
      done: calendarDone,
      ctaLabel: "Open Settings",
      ctaTo: "/settings",
    },
    {
      id: "ai",
      label: "Confirm your AI provider",
      hint:
        settings.aiProvider === "lovable"
          ? "Default Lovable AI — no key needed."
          : "Self-hosted provider selected. Add an API key.",
      done: aiDone,
      ctaLabel: "AI Config",
      ctaTo: "/settings",
    },
    {
      id: "prospect",
      label: "Add your first prospect",
      hint: "Drops them straight into the pipeline.",
      done: prospectsDone,
      ctaLabel: "Add prospect",
      ctaTo: "/",
      onClick: onAddProspect,
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const completed = steps.filter((s) => s.done).length;

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-surface-elevated to-surface">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Welcome — quick setup</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {completed}/{steps.length} done
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((s) => (
          <div
            key={s.id}
            className={cn(
              "flex items-start gap-3 rounded-md border border-border bg-surface p-2.5",
              s.done && "opacity-60",
            )}
          >
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className={cn("text-sm font-medium", s.done && "line-through")}>
                {s.label}
              </div>
              <div className="text-xs text-muted-foreground">{s.hint}</div>
            </div>
            {!s.done &&
              (s.onClick ? (
                <Button size="sm" variant="outline" onClick={s.onClick}>
                  {s.ctaLabel}
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link to={s.ctaTo}>{s.ctaLabel}</Link>
                </Button>
              ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

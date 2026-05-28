// Inline banner shown on AI-powered pages when no provider is configured.
// "Lovable" provider is always usable, so this only shows for self-hosted
// providers missing an API key.

import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AiSetupBanner({ className }: { className?: string }) {
  const settings = useStore((s) => s.settings);
  const ready =
    settings.aiProvider === "lovable" || !!settings.apiKey.trim();
  if (ready) return null;

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs",
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      <span className="text-amber-100">
        <strong>AI provider not configured.</strong> Add your{" "}
        <span className="font-mono">{settings.aiProvider}</span> API key to
        enable suggestions, analysis and VN drafts.
      </span>
      <Link
        to="/settings"
        className="ml-auto inline-flex items-center gap-1 font-medium text-amber-200 hover:text-amber-50"
      >
        Open Settings <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

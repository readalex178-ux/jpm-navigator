import { ExternalLink, Linkedin, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Prospect } from "@/lib/btf/types";

/**
 * Pulls the scraped LinkedIn profile (if the extension has captured it) for
 * the prospect's profile URL and renders headline / location / about inline.
 * Falls back to a button that opens the profile in a new tab.
 */
export function LinkedinProfilePreview({ prospect }: { prospect: Prospect }) {
  const profile = useStore((s) =>
    prospect.profileUrl ? s.linkedinProfiles[prospect.profileUrl] : undefined,
  );

  if (!prospect.profileUrl) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface p-3 text-xs text-muted-foreground">
        No profile URL on this prospect yet. Add one in Edit.
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate text-muted-foreground">
              No scraped profile yet.
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {prospect.profileUrl}
          </div>
        </div>
        <Button size="sm" variant="outline" asChild>
          <a href={prospect.profileUrl} target="_blank" rel="noreferrer">
            Open <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Linkedin className="h-3.5 w-3.5 text-[#0a66c2]" />
            <span className="truncate">{profile.name}</span>
          </div>
          {profile.headline && (
            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {profile.headline}
            </div>
          )}
          {profile.location && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {profile.location}
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" asChild>
          <a href={prospect.profileUrl} target="_blank" rel="noreferrer" title="Open profile">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
      {profile.about && (
        <div className="border-t border-border pt-2">
          <div className="mb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            About
          </div>
          <p className="line-clamp-4 text-xs leading-relaxed text-foreground/80">
            {profile.about}
          </p>
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">
        Scraped {new Date(profile.scrapedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

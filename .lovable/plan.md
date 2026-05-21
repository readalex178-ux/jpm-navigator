## Where the analyzer already lives

It's on the **LinkedIn** page (`/linkedin`) — not on `/prospects` or the home page. Two pieces:

1. **AnalyzerStrip** — at the top of the conversation pane, shows triage / ICP / 4-qualifiers / next action / draft. Auto-runs when a thread is selected.
2. **ProfileQualifierBox** — in the right Co-Pilot sidebar, the paste-a-profile verdict box.

The extension bridge is already wired (`src/routes/linkedin.tsx` lines 92–111): when the extension sends `ext:thread` or `ext:profile`, the data lands in the store. But there are three gaps that make it feel like "the analyzer isn't working with the extension":

- A scraped thread is saved but **not auto-selected**, so the AnalyzerStrip doesn't visibly fire unless you click that thread in the list.
- A scraped **profile** (no thread yet) does nothing visible — the qualifier only runs from manual paste.
- There's no "Analyze" entry point on `/prospects` or `/`, so if you're not on `/linkedin` you can't see it.

## What to change (UI/wiring only — no new AI logic)

### 1. Auto-select scraped threads
In the extension listener, after `upsertThread`, set `activeThreadId = e.thread.threadId` so AnalyzerStrip immediately runs against the freshly scraped thread.

### 2. Auto-run profile qualifier on `ext:profile`
When the extension pushes a profile and there's no matching thread yet, feed the profile text into `ProfileQualifierBox` automatically (pre-fill + auto-submit) so you get the ✅/❌ verdict without pasting.

### 3. "Open in Analyzer" affordance from Prospects
Add a small **Analyze** button on `ProspectCard` and the prospect detail page that:
- jumps to `/linkedin`
- if a thread is linked to that prospect, selects it
- otherwise opens the ProfileQualifierBox prefilled with the prospect's headline/notes

### 4. Connection status banner on `/linkedin`
Tighten the existing extension indicator so it clearly says **"Extension connected — open a LinkedIn DM or profile to auto-analyze"** vs **"Extension not detected"**, so you know whether scrapes will actually arrive.

### 5. Tiny home-page pointer
On `/` (KPI dashboard), add a single line under the LinkedIn tile: "Analyzer lives in LinkedIn → Co-Pilot" with a link. Removes the "where is it?" question for next time.

## Files touched

- `src/routes/linkedin.tsx` — auto-select scraped thread, route `ext:profile` into qualifier, refine status banner
- `src/components/linkedin/ProfileQualifierBox.tsx` — accept an external `initialText` + `autoRun` prop
- `src/components/ProspectCard.tsx` — add "Analyze" button
- `src/routes/prospects.$id.tsx` — add "Analyze" button
- `src/routes/index.tsx` — small pointer line

## Out of scope

- No new server functions, no schema changes, no new AI prompts. Reuses existing `analyzeThread` and `qualifyProfile`.
- Not moving the analyzer off `/linkedin` — that's the right home for it.

Approve and I'll implement.
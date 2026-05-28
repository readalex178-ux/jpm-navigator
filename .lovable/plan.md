# Build plan — 20 more upgrades (items 21–40)

Same approach as the previous batch: group into themed passes, layer onto existing code, never rebuild what works. The no-automation rule still holds — anything that touches prospect state is gated by an explicit user click.

---

## Pass 1 — Prospect record + card enrichments (items 21, 22, 23, 24, 25, 26, 27, 28)

Single biggest pass. Touches `src/routes/prospects.$id.tsx`, `src/routes/pipeline.tsx`, `src/components/ProspectCard.tsx`, `src/components/ProspectDrawer.tsx`, plus a few new small components.

- **#21 Score breakdown panel**: new `QualScoreBreakdown` component on the prospect record. Shows each contributing factor (BANT subtotals, buying-signal count, stage bonus, intent bonus) with a "+N" weight, and a "what would push this up" suggestion list.
- **#22 Duplicate prospect**: new "Duplicate" button on the record header and in the card right-click context menu (already have one via `ContextMenu` in shadcn). Pre-fills the new-prospect drawer with everything except `name`, `handle`, `profile_url`. Uses existing `addProspect` action.
- **#23 Star/pin priority**: reuse the existing `pinned` field shipped in batch 1. Already sorts to top of every pipeline column; extend the same sort to the dashboard Today's Queue list and the `/prospects` table. Star icon already rendered on cards — add it to the record header too.
- **#24 Tier tooltips**: new `TierBadge` component that wraps the existing tier label in a shadcn `Tooltip` with the price + setter cut. Used everywhere a tier currently renders (cards, record header, drawer, prospects table). One source of truth in `src/lib/btf/tiers.ts`.
- **#25 LinkedIn profile preview**: on the record, if `linkedinProfiles[profileUrl]` exists in the store, render a `ProfileCard` with headline / location / about. Otherwise show a button that opens `profile_url` in a new tab.
- **#26 BANT traffic light**: replace the numeric/slider BANT display with four coloured pills (green=2, amber=1, red=0). Card-level shows a single overall traffic light (worst score wins).
- **#27 Buying signals progress bar**: replace the bare checklist with a `Progress` bar (e.g. 5/7 = 71%) above the checkboxes. Checkboxes stay editable below.
- **#28 Suggested next script**: new `SuggestedScript` panel that picks a script from the existing playbook based on `stage`, `tier` and buying signals. Re-renders when stage changes. No AI call — just a deterministic lookup against `scripts`/playbook content already in the store.

No DB migration needed (all read-side or reusing existing columns).

---

## Pass 2 — Conversations workspace merge (items 29, 30, 31, 32, 33, 34)

- **#29 Merge Inbox into LinkedIn co-pilot**: turn `src/routes/linkedin.tsx` into the primary conversation workspace with two tabs — `Conversations` (current co-pilot) and `Message Log` (current inbox view). Remove the Inbox entry from the sidebar (`AppSidebar.tsx`); the route stays so old links don't 404 but redirects to `/linkedin?tab=log`.
- **#30 Read/unread state**: add `read_at timestamptz nullable` to `conversations` table via migration. Thread list shows bold name + coloured dot when `read_at` is null or older than `last_synced_at`. Opening a thread sets `read_at = now()`. Right-click → "Mark as unread" clears it.
- **#31 Reply-time tracker**: compute `lastInboundAt` from messages. Show "Replied 2d ago" at the top of the open conversation and in the list. >3 days = amber, >7 days = red with `Overdue` label.
- **#32 Sentiment tag**: new optional `sentiment text` column on `conversations` (`warm | cooling | dead`). Computed on demand by an existing AI helper when the user opens a thread or clicks "Refresh sentiment" — never automatically polling. Rendered as a coloured chip in the thread list.
- **#33 Templates panel**: new `TemplatesSheet` slide-in (shadcn `Sheet`) opened from a "Templates" button in the conversation composer. Reads from existing `scripts` table + a small curated set of defaults (calendar link, objections, re-engagement, VN). One-click inserts into composer.
- **#34 Context-aware VN script**: in the VN-from-conversation flow (existing AI assistant in `src/lib/ai/aiAssistants.functions.ts`), include the last 5 messages from the thread in the prompt. Server function only — no client change beyond passing `threadId`.

DB: migration adds `conversations.read_at` and `conversations.sentiment`.

---

## Pass 3 — Global UX + onboarding (items 35, 36, 37, 38, 39, 40)

- **#35 Global search (⌘K)**: new `CommandPalette` component mounted in `__root.tsx`. Uses shadcn `Command` + `Dialog`. Cmd/Ctrl+K opens it; Esc / outside-click closes. Searches `prospects` by name, niche, bio, profile_url. Result row = platform emoji + name + stage + score.
- **#36 Naming audit**: pick canonical labels and apply everywhere:
  - "LinkedIn Co-Pilot" → **Conversations**
  - "Inbox" → folded in as **Message Log** tab
  - "Pipeline" stays
  - "Prospects" stays
  - "KPI" → **Targets** (matches Settings tab name)
  - "Outreach" → **Playbook** (already named playbook elsewhere — pick playbook)
  Apply across `AppSidebar`, route `head()` titles, page H1s, and button labels.
- **#37 Mobile pipeline → list + bottom tab bar**: in `pipeline.tsx`, hide kanban below 768px and render a flat list sorted by urgency (overdue first, then pinned, then days-in-stage desc). `AppSidebar` collapses on `<768px` to a fixed bottom tab bar with 4 entries: Dashboard, Prospects, Conversations, Settings.
- **#38 Onboarding checklist**: on `/` (dashboard), if `prospects.length === 0` or any of (calendar link, AI provider configured) is missing, show a 3-step checklist card. Steps: 1) Set calendar link (→ Settings/Profile), 2) Configure AI provider (→ Settings/AI Config), 3) Add first prospect (→ opens new-prospect drawer). Each step gets a green check when satisfied. Card disappears when all three are complete.
- **#39 Split Settings into tabs**: `src/routes/settings.tsx` becomes three tabs — **Your Profile** (name, LinkedIn URL, Instagram handle, calendar link, role start date), **AI Config** (provider, model, API key, base URL), **Targets** (monthly commission target, daily VN target, daily connection target, manager names).
- **#40 AI provider missing banner**: shared `AiSetupBanner` component rendered on every page that uses AI features (linkedin/conversations, prospect record analyzer, training). Detects "AI provider not configured" (Lovable AI key absent for self-hosted, or `settings.aiProvider === 'none'`) and links to Settings → AI Config.

DB: none.

---

## Technical details

- **Migrations** (one combined for Pass 2): add `conversations.read_at timestamptz` and `conversations.sentiment text`.
- **Tier source of truth**: new `src/lib/btf/tiers.ts` with `{ id, label, price, setterCutMin, setterCutMax, included }`. All tier references read from here.
- **No new heavy deps**. shadcn `Command`, `Sheet`, `Tooltip`, `Progress`, `Tabs` are already present.
- **No-automation respect**: sentiment refresh is click-gated, template insert is click-gated, duplicate is click-gated, mark-as-read on open is a direct UX action (not background polling).

## Out of scope

- Auth, Supabase client files, edge functions.
- Existing playbook content, training route, KPI charts — except where reused.
- Multi-platform (Instagram/Twitter) conversation parity — LinkedIn remains the primary workspace.

## Ship order

1. Pass 1 (prospect record + card enrichments) — no migration.
2. Migration for Pass 2 (`read_at`, `sentiment`), then Pass 2 code.
3. Pass 3 (global search, naming, mobile, onboarding, settings split, AI banner).

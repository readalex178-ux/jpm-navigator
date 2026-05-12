# BTF Setter OS — Build Plan

A purpose-built CRM and AI co-pilot for appointment setters running the Behind the Funnel (JPM Media) offer. Single-operator app, dark theme, localStorage-only, AI calls direct from browser to Groq/OpenAI/OpenRouter/LM Studio.

## Scope

7 pages with left-sidebar nav: Dashboard, Prospects, Pipeline, Outreach, KPI Tracker, Training, Settings. Plus an always-visible commission tracker.

## Design System

- Background `#0a0a0a`, surface `#111`, border `#1f1f1f`, text white, accent orange/amber `#f5a623`
- Headings: Space Grotesk (loaded via Google Fonts in root). Body: Inter
- Tokens defined in `src/styles.css` (oklch), semantic only — no raw color classes in components
- Card-heavy layout, subtle borders, generous spacing, monospace for numbers/KPIs
- Lucide icons, Recharts for KPI charts

## Routes (TanStack file-based)

```
src/routes/
  __root.tsx                 # SidebarProvider + AppSidebar + Outlet + commission strip
  index.tsx                  # Dashboard
  prospects.tsx              # Prospect list + add/edit drawer
  pipeline.tsx               # Kanban
  outreach.tsx               # Active conversations + AI next action
  kpi.tsx                    # Tabs: Today / Weekly / Scripts / EOD / EOW
  training.tsx               # Roleplay scenarios + chat
  settings.tsx               # AI config, BTF profile, export
  api/ai.ts                  # Optional pass-through (kept client-side per spec)
```

## Data Model (localStorage, single JSON blob `btf-setter-os:v1`)

- `prospects[]`: id, name, profileUrl, platform, niche, bio, leadType, tier, stage, qualScore, buyingSignals{}, bant{need,timeline,authority,budget}, activities[], vnLog[], createdAt, stageEnteredAt, lastTouchAt
- `kpiDays[]`: date, vnSent, connectionsSent, replies, activeConvos, calendarsSent, booked, shows, hours, byPlatform{}
- `scripts[]`: variationId, market, niche, replied, booked, sentAt
- `trainingSessions[]`: scenarioId, transcript, grade, feedback, frameworkScore, date
- `settings`: aiProvider, baseUrl, model, apiKey, name, linkedinUrl, igHandle, calendarLink, monthlyTarget
- `commissions[]`: prospectId, tier, amount, closedAt

Wrapped in `useLocalStorage` hook + Zustand store for ergonomics. All mutations go through store actions; auto-persist on change.

## Page Specs

**Dashboard** — Stat row (VNs sent, replies, reply %, calls booked, active convos). Hot Prospects panel (sort by qualScore desc, recent activity). Quick action buttons (open Add Prospect drawer, Log Activity modal, link to Pipeline). Commission strip (today projected). Weekly minimum progress bars (LinkedIn 4, IG 6).

**Prospects** — Search + filter chips (platform, stage, niche, tier). Card grid. Card: name, platform emoji, niche, stage chip, days-since-touch, leadType badge, tier badge, score/100, green/red flag dot derived from buying signals count. Row actions: Log Activity, Move Stage (popover), AI Next Action. Add/Edit Drawer with full form including buying-signal checkboxes.

**Pipeline** — Kanban with 12 columns listed in spec. dnd-kit for drag/drop (already a typical pattern; install if missing). Card shows name, platform emoji, days-in-stage, tier. Red border when days-in-stage > stage threshold (config map). Top filter: platform + tier.

**Outreach** — List of prospects with stage in {Connected, VN1 Sent, Replied, VN2 Sent, Calendar Sent, Re-Engaged}. Each row: last message preview, days since, next-recommended-action (computed from BTF sequence map + AI button for richer suggestion). VN tracker: list of sent VNs with reply type (VN/text/none). Tone-match indicator (heuristic: replied within 24h + matched format = green). Activity log modal. Overdue flag using sequence timing maps:
- LinkedIn: D3 VN1, D7 VN2, D12 text
- Instagram: D1 text, D4 follow-up, D7 value, D10 VN

**KPI Tracker** — Tabs:
- Today: numeric inputs with target hints + progress bars
- Weekly: aggregated from last 7 days vs benchmarks (LI 4, IG 6, FB 3, X 2, Email 4 qualified calls/week)
- Scripts: table + add row (variation, market, niche, replied?, booked?). Aggregations by niche/platform
- EOD: button → AI generates report from today's data + active pipeline → markdown preview + Copy
- EOW: same, weekly window

**Training** — Scenario picker (8 scenarios listed in spec). Chat UI; AI plays prospect with system prompt loaded from a `btfFramework.ts` knowledge file. End Session button → AI grades A–D with strengths/improvements/framework score. Saved to history list.

**Settings** — Form sections: AI Config (provider select: Groq/OpenAI/OpenRouter/LM Studio, baseUrl, model, apiKey — stored in localStorage with a clear warning), BTF Profile, Commission target, Export JSON button (download of full store), Import JSON.

## AI Layer

`src/lib/ai/client.ts` — single `chat({messages, json?})` function that reads provider from settings and calls the configured OpenAI-compatible endpoint directly from the browser. Per user's spec — no backend.

`src/lib/ai/btfFramework.ts` — system prompt with BTF tone rules, sequence timings, lead type taxonomy, BANT-in-BTF-order, villain frame, voice-note-aware reply rules.

Functions:
- `detectLeadType(prospect)` 
- `scoreProspect(prospect)` → BANT scores + tier recommendation
- `nextAction(prospect)` → step + talking points
- `suggestReply(prospect, lastMessage)` → warm, ends in 1 question
- `handleObjection(text)` 
- `eodReport(today, pipeline)` / `eowReport(week, pipeline)`
- `roleplayTurn(scenario, history)` and `gradeSession(history)`

All return typed objects via JSON mode where supported; fallback to text parse.

## Commission Calculator

Tier amounts: DIY $50–100, DWY $150–300, DFY $600–1200 (use midpoints, configurable). Persistent strip in sidebar footer: month-to-date earned, pace, % to monthly target, "X more DFY closes to $5k OTE".

## Components to Build

- `AppSidebar` (collapsible icon mode, nav items, commission footer)
- `StatCard`, `ProgressRow`, `Section`
- `ProspectCard`, `ProspectDrawer`, `BuyingSignalsChecklist`, `FlagDot`
- `KanbanBoard`, `KanbanColumn`, `KanbanCard`
- `ActivityLog`, `VNLog`, `NextActionPanel`
- `KpiInput`, `BenchmarkBar`, `ScriptTable`, `ReportPanel`
- `RoleplayChat`, `ScenarioPicker`, `SessionGrade`
- `CommissionStrip`, `CommissionBreakdown`

Reuse shadcn primitives (Card, Tabs, Dialog, Drawer/Sheet, Input, Select, Badge, Progress, Button, Tooltip) — already installed.

## Build Order

1. Tokens + fonts + sidebar shell + routes scaffolding (placeholders)
2. Store + localStorage + types + seed data
3. Prospects (list + add/edit) — foundation for everything else
4. Pipeline kanban
5. Outreach + activity/VN logging + sequence engine
6. KPI Tracker tabs (without AI reports first)
7. AI client + framework prompt + wire AI features (next action, reply, score, objection, reports)
8. Training mode
9. Settings + export/import
10. Dashboard (depends on data from above)
11. Commission strip + calculator
12. Polish pass — empty states, overdue flags, toasts, keyboard shortcuts

## Technical Notes

- TanStack Start, file-based routes, `<Link to="...">` only
- Each route gets its own `head()` with unique title/description
- API key in localStorage — show clear warning in Settings that it's stored client-side
- dnd-kit for kanban (install if not present)
- Recharts for any sparklines/weekly trends
- No backend, no Lovable Cloud — explicit per spec
- Single user, no auth

## Open Question

Before building, one confirmation: the spec says AI calls go directly from the browser to Groq with the API key in localStorage. That works but exposes the key to anyone who opens the browser/devtools on this machine. Confirm you want this (vs. routing through a TanStack server function which would keep the key server-side via Lovable Cloud secrets). Default if unanswered: follow the spec exactly — browser-direct, key in localStorage.
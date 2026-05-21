## Part 1 — Remove JPM Media logo/wordmark

In `src/components/AppSidebar.tsx` the sidebar header shows a flame logo with "BTF Setter OS" and a "JPM Media" subtitle. Action:

- Remove the "JPM Media" subtitle line.
- Keep the flame mark + "BTF Setter OS" title (or drop the flame too — say the word).

Quick grep confirms no other references to "JPM Media" in the UI; framework prompt text in `src/lib/ai/btfFramework.ts` mentions "JPM Media" in the BTF system prompt — that's internal AI context, not user-facing, so left alone unless you want it removed too.

## Part 2 — Full feature audit

### Routes shipped (10)
```
/                Dashboard           index.tsx          ✅ wired
/prospects       Prospects list      prospects.tsx      ✅ wired, Analyze→LinkedIn handoff
/prospects/$id   Prospect detail     prospects.$id.tsx  ✅ wired
/pipeline        Kanban              pipeline.tsx       ✅ wired
/outreach        Outreach hub        outreach.tsx       ✅ wired
/linkedin        LinkedIn analyzer   linkedin.tsx       ✅ wired (636 lines — largest)
/kpi             KPI tracker         kpi.tsx            ✅ wired
/training        Roleplay/training   training.tsx       ✅ wired
/settings        Settings            settings.tsx       ✅ wired
```

### Core features confirmed present
- **Prospect CRUD** — store + cards + drawer + detail page
- **Pipeline kanban** with 12 stages (`Found → … → Closed/Cold`)
- **KPI logging + commission strip** in sidebar
- **Outreach scripts library** with logging
- **Training/roleplay sessions** via AI assistants
- **Chrome extension bridge** — `extension/` folder + `linkedinThreads`/`linkedinProfiles` in store + pairing code + connection badge in sidebar
- **AI thread analyzer** (`AnalyzerStrip`) with cached history (`AnalyzerHistoryTimeline`)
- **AI profile qualifier** (`ProfileQualifierBox`) with SEND_VN auto-add-to-pipeline
- **Auto-link thread → prospect** when analysis is qualified/hot
- **Cross-route handoff** (`sessionStorage` `btf:analyze`) from `/prospects` → `/linkedin`
- **CSV export** (`src/lib/csvExport.ts`)
- **Inbox triage dot** (`InboxTriageDot.tsx`)
- **State persistence** via zustand `persist` (localStorage)
- **Import/export JSON** in settings

### Gaps / things that look missing or weak

1. **No backend** — everything is localStorage. Lovable Cloud is connected (Supabase wired in `src/integrations/supabase/`) but no tables, no auth, no server functions are using it. Data lives only in this browser. Risk: clear cache = lose everything; no multi-device; no sharing.
2. **No authentication** — no login/signup, no `_authenticated` layout. Anyone with the URL sees your data.
3. **`AnalyzerHistoryTimeline.tsx` exists but unused?** — confirm it's actually rendered somewhere on `/linkedin`. If not, dead code or unwired feature.
4. **`InboxTriageDot.tsx`** — confirm it's used in the inbox list on `/linkedin`. If not, same.
5. **Daily KPI auto-aggregation from extension activity** — KPI looks manual-entry only. Extension scrapes threads/profiles but doesn't bump `vnSent` / `replies` / `connectionsSent`.
6. **No commission calculator from closed deals** — `commissions` table exists but I'm not sure deals auto-flow when a prospect hits stage `Closed`.
7. **Reminders / follow-up queue** — sequences exist in the framework prompt (Day 3, Day 7, Day 12) but no automated queue surfacing "VN2 due today" prospects.
8. **No mobile considerations** — viewport shows 384px wide; sidebar+tables aren't obviously responsive.
9. **No published deploy** — project URL is preview only.

### Suggested next moves (pick any)
- A. Add Lovable Cloud auth + sync prospects/KPI/analyses to the database so data survives.
- B. Wire the missing UI components (`AnalyzerHistoryTimeline`, `InboxTriageDot`) if not already on screen.
- C. Build a "Today" queue: prospects with overdue next-touch based on stage + days since `lastTouchAt`.
- D. Auto-bump KPI counters when extension reports new VN sent / reply received.
- E. Auto-create a commission row when a prospect moves to `Closed`.
- F. Mobile pass on sidebar + tables.

## What I'll do if you approve

1. Remove "JPM Media" from `AppSidebar`.
2. Verify `AnalyzerHistoryTimeline` and `InboxTriageDot` are actually rendered; wire them up if not.

Everything else in the audit is informational — tell me which gaps (A–F or others) you want me to tackle and I'll plan those separately.

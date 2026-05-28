# Build plan — items 41–60

20 features. I'll group them into 6 phases so we can ship safely, verify each phase in the preview, and stop/adjust if priorities shift. Honors the **No-Automation Rule** throughout: AI suggests, user clicks to apply. No auto-stage moves, no auto-sends, no auto-followups.

---

## Phase 1 — Data safety net (#41, #42, #43, #44)

Goal: never lose data, never regret a click, never wonder what an import did.

- **#41 Backup nag**: `lastCsvExportAt` in localStorage. Dismissible banner on dashboard if >7 days. Modal on app open if >7 days (once per session). One-click "Export now" reuses existing CSV export.
- **#42 Undo for destructive actions**: 5s sonner toast with Undo. Action is *staged* in memory and only committed when timer expires. Applies to: single delete, bulk delete, stage moves (drag-drop + dropdown). Wrapped in a `useUndoableAction` hook so every call site is identical.
- **#43 Import results modal**: New `ImportResultsModal` replacing the toast — shows imported / skipped duplicates / failed with per-row errors (row #, reason).
- **#44 Import history log**: New `csv_imports` table (`filename`, `rows_imported`, `rows_skipped`, `rows_failed`, `error_details jsonb`). "History" icon button next to Import on prospects page → slide-out list.

## Phase 2 — Conversation-aware AI (#46, #47, #50, #51)

Goal: every AI output is grounded in the specific prospect's reality.

- **#46 Context-loaded AI**: Refactor existing AI script/message generation calls to always pass `{ prospect, stage, tier, bant, signals, recentMessages, activityLog }` to the model. Single helper `buildProspectContext(prospectId)` reused everywhere.
- **#47 Qual score explain**: ✨ Explain button beside qual score → server fn returns plain-English paragraph (gemini-3-flash, <5s target). Cached per prospect+score until score changes.
- **#50 Script memory**: Before generating a VN script, fetch prior VN openers for that prospect, pass as "do not reuse" list, and stamp result with "Checked N previous scripts ✓".
- **#51 Suggested follow-up date**: After logging a VN/activity, AI returns suggested days based on platform + tier cadence. Surfaced as chip "Follow up in 3 days?" → click to set `follow_up_at`. Never auto-set.

## Phase 3 — VN log polish + objections (#48, #52)

- **#48 Objection handler**: New `ObjectionPanel` (slide-in) with categorized BTF objections + framework responses. Triggered from conversation toolbar, prospect record action bar, and pipeline card hover menu. Copy-to-clipboard on each.
- **#52 VN reply badges**: Green (VN reply), Blue (text reply), Grey (no reply) badges on every VN log row. Pure UI on existing data.

## Phase 4 — Analytics & performance (#53, #54, #55, #58)

- **#53 Niche reply-rate breakdown**: Aggregate VN-sent and VN-replied per prospect.niche → ranked list with %.
- **#54 Script variation performance**: Group messages by `variation_name`; show sent / replies / rate vs 13% benchmark bar.
- **#55 Commission tier chart**: Pie or bar — DIY/DWY/DFY closes, count + £ value. Reuse existing commission data.
- **#58 Pipeline projection**: Sum potential commission for prospects in "Calendar Sent" + "Call Booked" by tier. Label "Potential pipeline — not guaranteed."

## Phase 5 — Dashboard upgrades (#49, #56, #57)

- **#49 AI daily briefing**: Generated once per calendar day (key: `briefing:${userId}:${YYYY-MM-DD}` in `assistant_messages` or new lightweight table). Covers touch-needed, hottest prospect, monthly pace, overdue follow-ups. Dismissible.
- **#56 Monthly target progress bar**: Hero element on dashboard, reads `profiles.goals.monthlyCommissionTarget`, live-updates from commissions.
- **#57 GHL claims section**: New `/ghl-claims` route + sidebar item. Uses existing `ghl_claimed` / `ghl_remind_at` fields on prospects. Red badge in sidebar when unclaimed count > 0.

## Phase 6 — ICP tooling (#45, #59, #60)

- **#45 VN vault search/filter/sort**: Search input (name/niche/scenario/content), Used/Unused filter chips, Newest/Highest-performing sort. Pure client-side on existing `scripts` table.
- **#59 Keyword bank**: New `/keywords` route. Three sections (job titles & bio / content signals / pain signals) seeded with BTF criteria. Click-to-copy on each chip. Stored as a static seed file (not DB) since it's universal BTF content; user-added keywords go to a `keyword_bank` table.
- **#60 ICP green/red flag checker**: Checklist component on every prospect record. Stored in `prospects.signals.icpFlags` (jsonb, already exists). Count of green flags feeds into the qual_score formula (add to existing scoring helper).

---

## Database changes (one migration per phase that needs it)

- **Phase 1**: `csv_imports` table.
- **Phase 6**: `keyword_bank` table for user-added keywords.
- **Phase 2 & 5**: No schema changes (uses existing `assistant_messages`, `prospect_analyses`, `messages`).

## Out of scope (call out explicitly)

- I will NOT auto-send anything, auto-move stages, auto-set follow-up dates, or auto-apply AI suggestions — every action remains a user click per the No-Automation Rule.
- The keyword bank seed list will be the BTF-standard set; we can iterate the exact wording after first pass.

---

## How I'd like to proceed

This is ~3–4 hours of focused build. Two options:

1. **Approve all 6 phases** and I'll ship them sequentially in this thread, verifying after each phase.
2. **Pick the phases you want first** (e.g. "do Phase 1 + 2 now, rest later") and I'll stop after those.

Which do you want?
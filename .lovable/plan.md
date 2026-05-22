## Goal

Three things, in order, without breaking what already works:

1. Move the app off browser localStorage onto Lovable Cloud (real auth + RLS-protected tables).
2. Build a top-level **Unified Inbox** page that shows every prospect's latest DM in one workspace, with the 3-suggestion AI co-pilot in a side panel.
3. Audit the codebase and remove anything that nudges toward automation (auto-stage changes, auto-logging, anything that mutates a prospect without an explicit click).

## Phase 1 — Auth + Supabase migration (foundation)

This is the big one. Today everything lives in Zustand + `localStorage`. After this phase, the app requires sign-in and reads/writes from Postgres.

### Auth
- Email + password and **Google OAuth** (via Lovable broker — `lovable.auth.signInWithOAuth("google", ...)`).
- Email verification required. **No** auto-confirm. **No** anonymous sign-in.
- New `/login` and `/signup` routes (public). All existing app routes get gated under a `_authenticated` layout.
- Cache invalidation on `onAuthStateChange` at the root.

### Tables (all with RLS, all scoped to `auth.uid()`)
- `profiles` — display name, avatar, goals, notification prefs.
- `user_roles` — separate from profiles, `app_role` enum (`admin`, `user`), with `has_role(uuid, app_role)` `SECURITY DEFINER` function.
- `prospects` — name, platform, handle, niche, bio, lead_type, tier, stage, qual_score, bant (jsonb), signals (jsonb), stage_entered_at, last_touch_at.
- `conversations` — prospect_id, platform, last_synced_at.
- `messages` — conversation_id, sender (`me` / `them`), kind (text / vn / email / comment / call / note), content, transcript, sent_at.
- `kpi_entries` — date, vn_sent, connections_sent/accepted, replies, active_convos, calendars_sent, booked, shows, hours, by_platform (jsonb).
- `scripts` — name, content, category.
- `training_sessions` — scenario, transcript (jsonb), score.
- `prospect_analyses` — verdict_line, suggested_stage, next_move, draft_message, suggested_activity_type, reasoning, confidence, stage_at_time.
- `vn_scripts` — date, prospect_id, prospect_name, niche, scenario, text, used, outcome.
- `integrations` (placeholder for Phase 4) — provider, access_token, refresh_token, expires_at.

### Code changes
- Replace the Zustand persisted store with a thin React Query layer on top of `createServerFn` handlers backed by `requireSupabaseAuth`.
- New `src/lib/db/*.functions.ts` files per resource.
- Keep the existing Zustand store as a **client cache for ephemeral UI state only** (selected prospect, draft composer state) — no persistence.
- One-time **import-from-localStorage** button in Settings so you don't lose what's already there.
- Existing analyser + transcription server functions stay; they just read from / write to Supabase instead of the store.

## Phase 2 — Unified Inbox page (`/inbox`)

The headline new feature. 4-zone workspace, desktop-first (1440px+), collapses to stacked panels on mobile.

```text
┌──────────────────────────────────────────────────────────┐
│  sidebar │ conversation list │ active chat │ AI co-pilot │
└──────────────────────────────────────────────────────────┘
```

- **Conversation list (left-middle)**: every prospect with at least one message, sorted by `last_touch_at`. Search + filter by stage / platform / unread. Shows avatar, name, platform pill, last message preview, time, "from them / from me" indicator.
- **Active chat (middle-right)**: the existing `ConversationLog` component, plus the composer (direction toggle, type selector, transcribe-VN button). Reuses everything already built.
- **AI co-pilot panel (right)**: the new **3-suggestion** version of the reply suggester (today's `nextMoveFromConversation` returns one draft — this returns three, each with `type`, `content`, `coaching_note`). Each suggestion has Copy / Insert into composer buttons. BANT scorer and Stage analyzer live underneath as collapsible cards.
- No auto-anything. Every send requires the setter to click.

## Phase 3 — Automation audit

Sweep the codebase for anything that mutates prospect state without a click and either remove it or convert it to a "Suggested action" chip the setter has to confirm. Specific things to check:
- The "Move to Replied" auto-suggestion when logging an incoming message — currently it's a one-click chip (good), confirm it's not happening automatically.
- Any `useEffect` that calls `moveStage` / `logActivity` / `upsertAnalysis` without a user event.
- Any analyser that fires on mount instead of on button click.
- Document the rule in `mem://constraints/no-automation` so future work respects it.

## Phase 4 — (Out of scope for this round, called out for completeness)

These are in your spec but I'm **not** building them now — flag them and we'll do them as separate rounds:
- Meta / HubSpot / Salesforce / GoHighLevel OAuth + sync edge functions.
- Multi-platform Chrome extension (IG / TikTok / X / FB scrapers). Current extension only does LinkedIn.
- Coaching page (win/loss analysis over historical conversations).
- Analytics page (funnel + time-of-day heatmap) — KPI Tracker already covers the basics.

## Technical details

- Migration tool used once for the full schema + RLS + `has_role` function + `handle_new_user` trigger that creates a `profiles` row + assigns the `user` role on signup.
- Server-side: `createServerFn` + `requireSupabaseAuth` everywhere. No edge functions for app-internal logic. The existing `/api/transcribe` server route stays.
- 3-suggestion AI: new `suggestReplies` server fn that calls Lovable AI Gateway with a tool-calling schema returning `{ suggestions: [{ type, content, coaching_note }, ...] }`. Handles 402/429 with friendly toasts.
- All existing UI/design tokens kept. Dark theme, current typography, semantic tokens in `styles.css`.
- Import-from-localStorage: one-shot Settings button that reads the old Zustand state and posts it to bulk-insert server fns.

## Risk / heads-up

- Phase 1 is invasive — every route that touches the store changes. I'll do it carefully but expect this to be the longest single change in the project's history.
- Existing locally-stored prospects survive only if you click the import button after signing in. Otherwise they're gone (still in `localStorage` until you clear it, but the new app won't read them).
- After Phase 1, the LinkedIn extension's bridge will need a tweak so it writes scraped threads to the DB via a server fn instead of into the Zustand store. I'll handle that as part of Phase 1.

## Order of execution

1. Migration + auth (Phase 1a).
2. Phase 1b DONE (write-through sync): attachSupabaseAuth wired; pullAll/pushAll server fns; useSupabaseSync hydrates store on login and pushes full snapshot 1.5s after any mutation. UI components keep using Zustand unchanged.
3. localStorage importer in Settings (Phase 1c).
4. Unified Inbox page + 3-suggestion AI (Phase 2).
5. Automation audit + memory note (Phase 3).

I'll stop after each phase so you can sanity-check before I move on.
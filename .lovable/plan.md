
# Build plan — 20 upgrades

This is a big batch. I'll group the 20 items into 4 themed passes so each one ships as a coherent, testable change instead of a sprawl of edits. Nothing already working gets rebuilt — these layer on top.

Note on item #20 (GHL claim modal): the **no-automation** core rule forbids mutating prospect state without an explicit user action. The modal is fine because the user clicks "moved to Call Booked" themselves — but the modal will only **prompt**, never auto-claim or auto-log anything.

---

## Pass 1 — Pipeline board overhaul (items 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

Rewrite `src/routes/pipeline.tsx` board view + the in-file `Card` component:

- **Active/Inactive toggle** (#3): default board shows Found → Connected → VN1 Sent → Replied → VN2 Sent → Calendar Sent → Call Booked. Toggle button reveals Cold, Nurturing, Re-Engaged, Dead, Closed.
- **Column headers** (#9): show count + total potential commission (DIY £75, DWY £225, DFY £900).
- **New richer card** with:
  - Large platform emoji (#7), name, pin icon (#10)
  - Tier-coloured left border + tier badge (#6): DFY gold, DWY blue, DIY neutral. Overdue overrides with red border + "Overdue" badge (#1, #4). DM-confirmed signal → star icon (#4). Score > 75 → subtle ring highlight (#4).
  - Last message preview + recommended next-action chip from playbook (#1)
  - Hover action bar: Log VN, Move stage (dropdown), Open Inbox (#2)
  - HoverCard popup with bio, last activity, BANT breakdown, buying signals (#8)
- **Pin** (#10): persisted on prospect via new `pinned` field; pinned items sort to top of their column.
- **Confetti on Call Booked** (#5): trigger when drag/drop or stage-change handler moves a prospect into Call Booked.

DB: add `pinned boolean default false` to `prospects` via migration.

## Pass 2 — Dashboard becomes Today's Queue hero (items 11, 12, 14, 15, 16)

Rewrite `src/routes/index.tsx`:

- **Top: weather-report sentence** (#15) — auto-generated from live counts (overdue, follow-ups due, calls booked this week).
- **Motivational sub-line** (#14) — dynamic ("2 calls from weekly target", etc).
- **Hero: Today's Queue** (#11) — dominates the screen. Each row: prospect, recommended action, one-click action button (Open Inbox / Log VN / Mark Sent) that runs without leaving the page.
- **Projected monthly commission** (#16) as the single biggest number, with breakdown ("3 DFY × £900 + 2 DWY × £225") and progress toward monthly target from settings.
- **Momentum strip** (#12): streak counter, weekly VN progress bar, daily connections counter.

## Pass 3 — KPI auto-wiring (#13)

In `src/lib/store.ts`, in `moveStage` and `logActivity` (or the equivalent VN-log path), increment today's `kpi_entries` row:
- → Replied: `replies++`
- → VN1 Sent / VN2 Sent: `vn_sent++`
- → Connected: `connections_accepted++`
- → Calendar Sent: `calendars_sent++`
- → Call Booked: `booked++`
- Logging a connection request: `connections_sent++`

Plus a daily-cap warning when `connections_sent` >= cap (from settings).

## Pass 4 — Prospect record redesign + GHL guard (items 17, 18, 19, 20)

Rework `src/routes/prospects.$id.tsx`:

- **Sticky notes field** (#19) at top — textarea, debounced auto-save to `prospects.notes`, no submit button.
- **Profile Analyzer panel** (#17) inlined as a prominent card near the top, reusing `ProfileQualifierBox` with the prospect's `profileUrl` pre-filled (no need to go to /linkedin).
- **Chronological timeline** (#18) replacing the current activity display: messages, stage changes, notes, analyses — merged, sorted desc, with type icons.
- **GHL claim modal** (#20): triggered when stage → Call Booked anywhere (pipeline DnD, drawer, table). Yes / Remind Me Later. "Remind Me Later" stores an unclaimed flag on the prospect (`ghl_claimed boolean`, `ghl_remind boolean`). Sidebar badge counts unclaimed GHL calls. Re-prompts on next app open.

DB: add `ghl_claimed boolean default false`, `ghl_remind_at timestamptz` to `prospects`.

---

## Technical details

- **Migrations** (one combined): add `pinned`, `ghl_claimed`, `ghl_remind_at` columns to `prospects`.
- **Confetti**: use `canvas-confetti` (small, no deps). `bun add canvas-confetti`.
- **HoverCard**: already in `src/components/ui/hover-card.tsx`.
- **KPI auto-wire**: extend `useStore` actions; today's row upserted via existing sync layer.
- **No-automation respect**: every increment, modal, and queue action is gated by an explicit user click (stage drag, button press). No `useEffect` mutates server state.
- **Tier border colours**: add semantic tokens `--tier-dfy` (gold), `--tier-dwy` (blue) in `src/styles.css`. Existing red destructive token used for overdue.

## Out of scope (won't touch)

- The BTF profile qualifier prompt (just shipped, working).
- Auth, Supabase client files, edge functions.
- Existing inbox, linkedin analyzer page, settings, training routes — except where reused.

## Order I'll ship

1. Migration (pinned, ghl fields) — ask for approval, then apply.
2. Install `canvas-confetti`.
3. Pass 1 (pipeline) → Pass 2 (dashboard) → Pass 3 (KPI wiring) → Pass 4 (prospect record + GHL modal).
4. Verify in preview after each pass.

Approve and I'll start with the migration.

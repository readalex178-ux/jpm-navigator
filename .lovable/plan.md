# BTF Setter OS — Audit vs Your 4 Manual Systems

I mapped each of your 4 manual ChatGPT workflows against what's already built in this app. No code changes proposed in this audit — just the map, then a tight short-list of what to actually add or merge.

## Your 4 manual systems → what's already in the app

### 1. Spreadsheet intake (paste prospect → row in tracker)

**Already built**

- `Prospects` page + `ProspectDrawer` covers every field you list (Name, Platform, Niche, Stage, Notes via `bio`/activities, etc.).
- `Outreach Type` ≈ existing `leadType` (Direct / Lead Magnet / Engagement / Re-Engagement / Ad Lead / No Show / No Close).
- VN1/VN2 dates → `vnLog` per prospect; Replied? → reply field on each VN entry; Booked? → stage = "Call Booked".
- Commission Status → `Commissions` store + `CommissionStrip` in the sidebar.

**Missing**

- No "paste raw LinkedIn profile text → auto-extract Name/Niche/Bio into a new prospect" flow. Today you have to type it into the drawer.
- No CSV/Sheets export shaped like your exact spreadsheet columns (handy if you ever want to keep the Sheet in parallel).

**Duplicated / to merge**

- Your manual "Stage" vocabulary (Connected, VN1 Sent, Replied, VN2 Sent, Booked) is a subset of the app's `Stage` enum. Already aligned — no change needed.

---

### 2. Profile qualifier (VERDICT / SCORE / FIT / etc.)

**Already built**

- The LinkedIn page's `AnalyzerStrip` (powered by `btfAnalyzerPrompt.ts` + `linkedinAnalyzer.functions.ts`) returns: triage (hot/warm/cold/disqualify), ICP match, market bucket, 4-criteria qualification with verdict + reason, personalisation hook, confidence, BANT suggestion, qualScore suggestion. That's ~90% of your manual qualifier.
- ICP rules, priority markets, red flags, buying signals — all encoded in the system prompt already.

**Missing**

- The analyzer runs against a **scraped LinkedIn thread**, not a **pasted profile block**. Your manual flow #2 is "I paste a raw profile, get a verdict before I even send a connection." Today there's no equivalent paste-and-score box.
- Output format doesn't lead with the one-line ✅ SEND VN / ❌ SKIP verdict you actually scan for — it leads with badges. Worth re-ordering the strip.
- "PREDICTED TIER (DFY/DWY/DIY + one line why)" is not in the schema. Easy add.

**Duplicated**

- Green/red flags and keyword list live only inside the analyzer prompt. Not exposed in UI, but that's fine — no duplication, just hidden.

---

### 3. Per-prospect chat (Mode A VN1 writer + Mode B live conversation)

**Already built**

- LinkedIn page = one-prospect-at-a-time co-pilot. Inbox left, conversation middle, AI Co-Pilot right.
- Co-Pilot actions: `connect`, `vn`, `reply`, `followup`, `objection`, plus the analyzer's `nextAction` → draft (VN1/VN2/text/breakup/calendar link/objection response).
- 150-word voice-note cap, "19 founders" client count, never-name-the-product, market variations (AI consultants / community builders / fractional / coaches), objection map — all in `btfAnalyzerPrompt.ts`.
- Tone-matching rule, stage detection, calendar-link-by-text-only — all in prompt.
- Analyzer history timeline per thread (just added) gives you the "what changed since last read" view.

**Missing**

- **Mode A "lock this chat to this prospect"** behaviour. Today nothing stops the analyzer from re-reading a thread as if it were a new person — but practically each thread *is* one prospect, so the lock is implicit. Probably not worth a feature.
- **Calendar-link helper**: the prompt knows when to send it but there's no one-click "insert {{CALENDAR_LINK}} from settings" action. `settings.calendarLink` exists but isn't auto-substituted into drafts.
- **State summary on demand** ("state" command in your manual flow) — you have to read the analyzer strip + history. A single-button "Summarise where this prospect is + what's still unknown" would mirror your manual `state` command exactly.

**Duplicated**

- The legacy `Outreach` page's "AI next action" button does a *worse* version of what `AnalyzerStrip` already does (one-line prompt vs full BTF-framework analysis). Recommend removing the AI button from `/outreach` and keeping that page as a pure "list of active convos with sequence due-dates" view, or merging the two.

---

### 4. EOD / EOW report generator

**Already built**

- `KPI Tracker → EOD` and `EOW` tabs generate AI reports from `kpiDays` + pipeline counts. Today and weekly tabs let you log raw numbers.
- Daily targets and weekly benchmarks (`DAILY_TARGETS`, `WEEKLY_BENCHMARKS`) match your manual flow.

**Missing vs your manual spec**

- No **connection acceptance rate** (you log `connectionsSent` but not `connectionsAccepted` → can't compute the 30% benchmark).
- No **stale-prospect flagging** (no movement 3+ days) in the report. The data exists (`lastTouchAt`), it just isn't surfaced.
- No **"booked but not yet claimed in GHL"** flag. There's no `claimedInGhl` boolean on either prospect or commission.
- No **"weeks into role"** counter (would need a `roleStartDate` in Settings).
- No **auto-generated short message to Yarek/Marcus** appended to each report.
- EOD report doesn't separate connection rate / reply rate / booking-from-replies as three distinct lines vs benchmarks.

**Duplicated**

- KPI day numbers are entered manually in `/kpi` even though the LinkedIn page already auto-increments `vnSent`, `connectionsSent`, `activeConvos` when you press Insert. If you mostly use the Co-Pilot, the manual logger is redundant for those three fields. The manual logger is still useful for `replies`, `booked`, `shows`, `hours`.

---

## Short-list — what's actually worth building next

Ranked by leverage vs your manual flows. None of these are "redesign" — each is additive or a small merge.

1. **Paste-a-profile → instant verdict box** on `/linkedin` (or `/prospects/new`). Reuses the existing analyzer prompt, but takes raw pasted text instead of a scraped thread. Outputs in the exact order of your manual #2 (verdict line first). Adds "Predicted Tier" to the schema.
2. **EOD/EOW report upgrade**:
  - Add `connectionsAccepted` field to `KpiDay` + input on `/kpi`.
  - Add `claimedInGhl: boolean` on commissions (or on prospects with stage = "Call Booked").
  - Add `roleStartDate` to Settings.
  - Rewrite EOD/EOW prompts to include: acceptance rate, reply rate, booking-from-replies, stale list (lastTouch ≥ 3d on active stages), unclaimed booked calls, "weeks into role", plus an appended copy-paste message to Yarek/Marcus.
3. **Merge `/outreach` and `/linkedin**` (or trim `/outreach`). Today `/outreach` is a weaker AI suggester. Either delete its AI button and keep it as a "sequence due today" dashboard, or fold its sequence-due logic into the LinkedIn inbox as a filter chip ("Due today / Overdue / Stale 3+ days").
4. **One-click "Send calendar link"** in the Co-Pilot that injects `settings.calendarLink` into a short text template. Today the analyzer suggests it but you have to write it yourself.
5. **"Summarise this prospect"** button on the conversation pane = the manual `state` command. Calls the AI with thread + analysis history and returns: where they are, which of the 4 qualifiers are confirmed/unknown, what to watch for.
6. **Spreadsheet export** (`/prospects` → "Export CSV in tracker format") so your existing Sheet stays in sync if you want it as a backup.

## What I'd **not** build

- A separate "intake" page — the existing `ProspectDrawer` + a paste-to-extract button on `/linkedin` is enough.
- Multi-prospect chat mode — your manual flow #3 explicitly says one chat = one prospect, and the app already enforces that per-thread.
- A new analytics dashboard — `/` dashboard already shows hot prospects, today's stats, weekly progress.

---

Want me to start with #1 (paste-a-profile verdict) and #2 (EOD/EOW upgrade)? Those are the two that map most directly to manual systems you'd retire on day one.
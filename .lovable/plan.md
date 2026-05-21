## Goal

When the analyzer returns a positive verdict, the prospect should land in the pipeline automatically — no extra click on "+ Add as prospect" or "Link to prospect".

Today both analyzers stop short of that:
- `ProfileQualifierBox` shows a `+ Add as prospect` button only after a `SEND_VN` verdict — manual.
- `AnalyzerStrip` (thread analysis) never creates or links a prospect, even when triage is `hot`/`warm` and qualification verdict is `qualified`.

This plan wires "match → pipeline" in both places, idempotently.

## What counts as a "match"

- **Profile qualifier**: `verdict === "SEND_VN"` (already the SEND signal).
- **Thread analyzer**: `qualification.verdict === "qualified"` OR `triage === "hot"`, AND `triage !== "disqualify"` AND `nextAction !== "disqualify"`.

Anything else (MAYBE / warm-but-not-qualified / cold) stays as-is — no auto-add, manual button still available.

## Changes

### 1. `src/components/linkedin/ProfileQualifierBox.tsx`
- In `runWith`, after a successful result, if `verdict === "SEND_VN"`:
  - Check existing prospects for a same-name match (case-insensitive on the first non-empty line) to avoid duplicates.
  - If none, call `addProspect(...)` with the same payload the manual button uses, plus `stage: "Found"`.
  - Toast: `"Added <name> to pipeline (Found)"`.
- Keep the manual `+ Add as prospect` button visible for `MAYBE` verdicts only (skip it when we already auto-added).

### 2. `src/routes/linkedin.tsx` — auto-create/link from thread analysis
- Add a `useEffect` keyed on `[activeThread?.threadId, analysis]` that runs when:
  - `analysis` exists and is a "match" per the rule above,
  - `activeThread` exists,
  - `threadProspectMap[activeThread.threadId]` is empty (not already linked).
- Behaviour:
  - Try to reuse an existing prospect whose `profileUrl === activeThread.participantProfileUrl` (or name match). If found → `linkThreadToProspect(threadId, prospect.id)`.
  - Otherwise create a new prospect from `activeThread` + `activeProfile`:
    - `name`: `activeProfile?.name ?? activeThread.participantName`
    - `profileUrl`: `activeThread.participantProfileUrl`
    - `platform: "linkedin"`
    - `niche`: `analysis.market`
    - `tier`: `analysis.predictedTier === "unknown" ? "DWY" : analysis.predictedTier`
    - `bio`: `activeProfile?.headline ?? ""`
    - `stage`: derive from `analysis.stage` / `nextAction`:
      - `book_call` / `send_calendar_link` → `"Booked"` (or closest existing stage — confirm against `Stage` enum during impl)
      - `voice_note_1` / `send_connection` → `"Found"`
      - everything else qualified → `"Contacted"` (or whatever the current Stage list calls the "in convo" bucket)
    - `bant`: copy `analysis.bantSuggestion`
    - `qualScore`: `analysis.qualScoreSuggestion`
  - Then `linkThreadToProspect(threadId, newProspect.id)`.
  - Toast: `"Added <name> to pipeline · <stage>"`.
- Guard with a local `useRef<Set<string>>` of threadIds we've already auto-handled this session, so re-analysis doesn't loop.

### 3. Visual confirmation in `AnalyzerStrip`
- No structural change. The existing `ProspectStateButton` next to the strip already shows the linked prospect, so once the effect fires, the user sees the prospect chip light up without doing anything.

## Out of scope

- No schema, no server function, no AI prompt changes.
- No new pipeline stages — we map onto the existing `Stage` union in `src/lib/btf/types.ts`.
- Cross-route handoff from `/prospects → /linkedin` is untouched.

## One thing to confirm before I build

The `Stage` enum values I'm mapping onto (`"Found"`, `"Contacted"`, `"Booked"`) — I'll read `src/lib/btf/types.ts` during implementation and use the exact strings that exist. If your pipeline calls the first column something else (e.g. `"New"` or `"Lead"`), the mapping uses that instead. No new stages will be invented.

Approve and I'll implement.

## Goal

Every prospect page becomes the home for that conversation: a running log of every message in both directions (typed or transcribed from a voice note), plus an AI co-pilot that reads the whole log and tells you exactly what to send next.

Keep the existing activity log and VN log — they stay as the source of truth for "where is this prospect at, when did we last touch them, what stage". The new chat view is built on top of that same data so nothing is lost.

## What changes

### 1. Conversation log on the prospect page

In `src/routes/prospects.$id.tsx`, add a new top section "Conversation" above the existing Activity log. It renders `activities` + `vnLog` merged chronologically as chat bubbles:
- Right-aligned bubbles = from Me (setter)
- Left-aligned bubbles = from Them (prospect)
- VN entries show a 🎙 badge with the variation name; transcripts show under the badge
- Each bubble shows date + type pill (VN / text / email / comment / call / note)

The existing Activity log and Voice notes sections stay exactly as they are underneath — same composers, same data. The chat view is a read-only visualization layered on top.

### 2. Add-a-message composer with direction + transcription

Above the chat, a single composer with:
- **Direction toggle**: `From them` / `From me` (defaults to "From them" because that's the common case — you just got a reply).
- **Type selector**: text / VN / email / comment / call / note.
- **Message field**: textarea for the message text.
- **Transcribe voice note** button: opens a file picker for an audio file (m4a / mp3 / wav / webm). The file is sent to a new `transcribeVoiceNote` server function backed by ElevenLabs Scribe (`scribe_v2`). The returned transcript fills the message field; the user can edit before saving. Requires `ELEVENLABS_API_KEY` secret.
- **Save**: writes an `Activity` (with the direction encoded — `from_them: true|false` added to the Activity type) and, when type is VN, also writes a `VNEntry` so the existing Voice notes section stays in sync.

### 3. Conversation-aware AI co-pilot

Replace today's three-button AI Co-pilot with one primary action: **"What do I send next?"**

It packages: prospect identity + stage + tier + the full chronological conversation (last 30 messages, both directions, with role labels) + buying signals, and calls a new `nextMoveFromConversation` server function. The function reuses the existing `BTF_ANALYZER_SYSTEM` prompt and returns a strict JSON shape:

```
{
  verdictLine,            // ✅/⚠️/❌ one-liner
  stage,                  // suggested stage to move them to
  nextMove,               // plain English action
  draftMessage,           // ready-to-send copy, ≤150 words, no brackets
  suggestedActivityType,  // VN / text / etc.
  reasoning,              // 2-3 sentences
  confidence
}
```

The result renders inline under the chat with:
- Copy button on the draft message
- "Move to <stage>" button that calls `moveStage`
- "Log as my next message" button that prefills the composer with the draft + direction=Me

Keep the existing `Reply` / `Score` buttons as secondary options; just put `What do I send next?` first and make it the bold one.

### 4. Per-prospect analyser history

Each call to `nextMoveFromConversation` is persisted to a new store slice `prospectAnalyses: Record<string, ProspectAnalysisEntry[]>` (capped 20 per prospect). Render a collapsible "Analyser history" timeline under the co-pilot, modelled on `AnalyzerHistoryTimeline` — shows verdict, stage at the time, suggested next move, and timestamp so you can see how the AI's read has evolved as the conversation moves.

### 5. Stage + last-touch stay accurate

Saving a message always updates `lastTouchAt` (already happens via `logActivity`). When direction=Them and the prospect is in `Found` / `Connected` / `VN1 Sent` / `VN2 Sent`, prompt with a one-click "Move to Replied" chip above the result. No automatic stage changes — the setter stays in control.

## Files touched

- `src/lib/btf/types.ts` — add optional `fromMe?: boolean` to `Activity` (defaults to true for backwards compatibility so old logged activities stay attributed to the setter).
- `src/lib/store.ts` — add `prospectAnalyses` + `addProspectAnalysis` / `clearProspectAnalyses`; thread `fromMe` through `logActivity` callers.
- `src/lib/ai/aiAssistants.functions.ts` — add `nextMoveFromConversation` server function (Zod-validated input, JSON output, same gateway/fallback pattern as the others) and `transcribeVoiceNote` server function calling ElevenLabs Scribe `scribe_v2`.
- `src/routes/prospects.$id.tsx` — add Conversation section (chat view + composer + transcribe button), reorder AI co-pilot, render analyser history, keep existing Activity log + VN sections underneath.
- New small component `src/components/ConversationLog.tsx` for the chat bubbles (keeps the route file readable).
- New small component `src/components/ProspectAnalyserHistory.tsx` adapted from `AnalyzerHistoryTimeline`.

## Secrets

- Requires `ELEVENLABS_API_KEY` for the transcription server function. Will request it via the secrets tool before implementing transcription so the button isn't dead on arrival.

## Out of scope

- No realtime/streaming STT (overkill for pasting a single VN). Plain file-upload → batch transcription.
- No changes to the LinkedIn-extension flow (`useThreadAnalysis`, `AnalyzerStrip`) — those still drive the `/linkedin` page.
- No backend / Supabase changes — everything stays in the Zustand persisted store.

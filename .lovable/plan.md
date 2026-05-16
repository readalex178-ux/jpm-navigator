## AI Analyzer for LinkedIn Co-Pilot

Grounded in the BTF playbook you just shared (voice-first, Master Script, 3-part conversation flow, qualification 4-criteria, objection map, tone-matching rules). The analyzer codifies that doc as the AI's brain — so it doesn't just generate messages, it tells you **where the prospect is, what they need next, and gives you the script ready to record/send.**

### What it does

For every LinkedIn thread + profile mirrored by the extension, the analyzer returns:

1. **Prospect Read**
   - ICP match: Under-Monetised Expert? (green/yellow/red)
   - Market bucket: AI Consultant · AI Educator · Community Builder · Fractional Exec · Coach · Other
   - One specific personalisation hook pulled from their profile/posts (the "60 seconds of research" line)

2. **Qualification (BTF 4-criteria)**
   - Decision Maker · Has Offer · Earning Something · Wants More — each scored 0/1/unknown
   - Overall: Qualified / Needs more convo / Disqualify (with reason)

3. **Conversation Stage**
   - Where in the BTF sequence: Connection sent · Accepted (no VN yet) · VN1 sent · Replied (voice) · Replied (text) · 2nd VN due · Day 7 follow-up due · Day 12 final text due · Objection raised · Ready to book · Booked · Ghost / break-up
   - Days since last touch + which step the playbook says comes next

4. **Tone & Format Recommendation**
   - Voice note vs text (applies the "two VNs then match" rule automatically)
   - Energy match (their last reply's tone)

5. **Next Move + Ready-to-Use Output**
   - One recommended action: `voiceNote1` · `voiceNote2` · `textFollowup` · `breakup` · `objectionResponse` · `sendCalendarLink` · `bookCall` · `disqualify`
   - The actual script — built from the Master Script template with the right market variation (trust line, pain line, industry word) swapped in, ≤150 words, ready to record
   - For objections: detects which one (time/system/cost/sales call/not interested/send info) and returns the BTF-approved rebuttal
   - For VN scripts: includes pacing cues `[pause]`, `[smile]`, `[lower energy]`

6. **Confidence + Reasoning** — short "why this move" so you can override intelligently

### Where it shows up

**(a) Inbox triage strip** — each thread in the left pane gets:
- colored dot (🟢 hot / 🟡 warm / 🔴 cold / ⚫ disqualify)
- one-line verdict ("Replied in text — send VN2", "Day 7 — follow-up overdue", "Objection: cost — rebuttal ready", "Ready to book — send link")
- so you can work top-down without opening every thread

**(b) Analyzer panel** at the top of the Conversation pane:
```text
Market: AI Educator · ICP: Green · Qual: 3/4 (no budget signal)
Stage: Replied in text after VN1 · Tone: warm, curious
Next move: Send VN2 (still voice — first text reply)
[Use this draft ▾]  [Regenerate]  [Mark done]
```

**(c) Co-Pilot panel** auto-pre-fills with the analyzer's recommended action + draft. You can still flip to any other action manually (your existing 5 buttons stay).

**(d) Auto Prospect sync** — if the thread isn't linked, the analyzer creates a Prospect with the right market/niche/stage/BANT/qualScore and logs an Activity. If it is linked, it patches stage + bant + qualScore + lastTouchAt and logs the analysis as an Activity so it flows into your KPI page and pipeline.

### When it runs

- **Auto** when the extension pushes a thread whose `lastMessageAt` changed since the last analysis (debounced ~1.5s)
- **Manual** "Analyze" button per thread, "Analyze all" on the Inbox
- **Cached** by `threadId + lastMessageAt` in the Zustand store so re-opens are free and we don't re-bill the gateway

### Technical implementation

- **Server function**: `src/lib/ai/linkedinAnalyzer.functions.ts` — `createServerFn({ method: "POST" })` with Zod `inputValidator` (thread + profile + prospect + settingsContext) and a `handler` that calls Lovable AI Gateway directly via `fetch` to `https://ai.gateway.lovable.dev/v1/chat/completions` using `process.env.LOVABLE_API_KEY`. No SDK install needed.
- **Model**: `google/gemini-3-flash-preview` (fast, cheap, accurate enough for classification + short generation). Falls back to `google/gemini-2.5-flash` if 429.
- **Structured output**: JSON mode + a strict Zod schema (`src/lib/ai/analyzerSchema.ts`) covering all fields above. Server validates before returning.
- **System prompt**: full BTF framework digest — Master Script template, market variations table, qualification criteria, objection map, tone-matching rules, do/don't rules ("blank connect", "two VNs then match", "one question per message", "never pitch the offer", "client count = 19"). Lives in `src/lib/ai/btfAnalyzerPrompt.ts` so it's one place to tune.
- **Client wrapper**: `useServerFn(analyzeThread)` + a small hook `useThreadAnalysis(threadId)` that returns `{ analysis, loading, refresh }` and triggers the debounced auto-run.
- **Store additions**: `analyses: Record<string, ThreadAnalysis>`, `upsertAnalysis`, `clearAnalysis`. Persisted with rest of store. No new Supabase tables (consistent with the rest of the app today).
- **Error handling**: 429 → toast "AI rate-limited, retry in a moment"; 402 → toast "Add Lovable AI credits in Workspace settings"; bad JSON → retry once, then surface "AI returned malformed output, click Regenerate". Per the TanStack server-fn guidance, return `{ analysis, error }` rather than throwing for recoverable cases.
- **Settings hook**: the existing `Settings.aiProvider` flow still works for the old `chat()` path used by the 5 manual generate buttons. The analyzer always uses Lovable AI Gateway so your team doesn't each need their own key. (We can later add a toggle if you want.)

### Files

**New**
- `src/lib/ai/linkedinAnalyzer.functions.ts` — server function
- `src/lib/ai/analyzerSchema.ts` — Zod schema + TypeScript type for `ThreadAnalysis`
- `src/lib/ai/btfAnalyzerPrompt.ts` — BTF system prompt + market-variation table + objection map
- `src/lib/ai/useThreadAnalysis.ts` — client hook (cache + debounce + auto-run)
- `src/components/linkedin/AnalyzerStrip.tsx` — top-of-conversation panel
- `src/components/linkedin/InboxTriageDot.tsx` — left-pane dot + verdict line

**Edited**
- `src/routes/linkedin.tsx` — wire AnalyzerStrip, replace Inbox item with InboxTriageDot, auto-pre-fill Co-Pilot from `analysis.nextAction`/`analysis.draftMessage`, add "Analyze all" button to Inbox header
- `src/lib/store.ts` — `analyses` slice, `upsertAnalysis`, persist
- `src/lib/extension/bridge.ts` — no change, but the existing `upsertLinkedinThread` becomes the trigger point for auto-analyze (via subscription in the hook, not in the store, to keep the store pure)

### Out of scope (call out so we don't drift)

- No auto-send to LinkedIn (safety + LinkedIn ToS — you always press Send)
- No background polling when the tab is closed
- No multi-account analyzer profiles — single BTF profile baked in (matches the playbook being one canonical doc)
- No accuracy dashboard yet — can add a thumbs-up/down on each analysis later if you want training data

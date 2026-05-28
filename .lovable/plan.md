## Goal

A floating chat bubble (available on every route) where you type what you just did in plain English. The assistant parses it, finds the right prospect, and proposes structured actions (log activity, change stage, add prospect, answer a question). **Nothing is written until you click "Apply"** — honoring the no-automation rule.

## UX

- **Bubble**: bottom-right circular button on every route (above `CommandPalette`, hidden on `/login`).
- **Panel**: slide-out sheet, ~420px wide, with chat transcript + composer.
- **Composer**: textarea + send button. Focused on open.
- **Messages**:
  - Your text bubbles right.
  - Assistant streams a short reply on the left + a **proposal card** below it.
- **Proposal card** (one per detected action):
  - Header: action type (Log activity / Update stage / Add prospect / Answer).
  - Body: the parsed fields (prospect, type, note, stage, etc.).
  - If prospect match is ambiguous → list candidate chips, you click one.
  - Footer: **Apply** + **Dismiss** buttons. Once applied, card collapses to a "✓ Logged to Sarah · 2:14pm" line with a link to that prospect.
- **History**: full transcript persists across devices (Supabase), scoped to the user.

## What the bot can do

| Intent | Example | Resulting proposal |
|---|---|---|
| Log activity | "Sent VN to Sarah about the calendar offer" | Insert `messages` row (kind=`vn`, sender=`me`) for Sarah, bump `last_touch_at` |
| Update stage | "Move James to Booked Call" | Update `prospects.stage` for James |
| Add prospect | "New lead Anna Lopez, IG, fitness coach, warm" | Insert `prospects` row |
| Answer question | "Who's overdue?" / "What did I last send Sarah?" | Read-only reply, no proposal card |

Ambiguity rule: if 0 or 2+ name matches, the card shows candidate chips and you pick — never auto-writes.

## Architecture

```text
src/components/assistant/
  AssistantBubble.tsx        floating button + sheet shell
  AssistantPanel.tsx         transcript + composer
  ProposalCard.tsx           renders one parsed action with Apply/Dismiss
  ProspectPicker.tsx         chip list for ambiguous matches
src/lib/assistant/
  intents.ts                 zod schemas for the 4 intent types
  apply.ts                   client-side appliers (calls existing store actions)
  useAssistantThread.ts      load/save messages for the active user
src/routes/api/
  assistant.ts               server route — streams AI response + structured proposals
src/lib/
  assistant.functions.ts     createServerFn for read-only Q&A queries
```

Mount `<AssistantBubble />` once in `__root.tsx` (sibling of `CommandPalette`).

## Server route (`/api/assistant`)

- Uses AI SDK + Lovable AI Gateway (`google/gemini-3-flash-preview`).
- System prompt: explains the user's prospect list (sent as compact context: id, name, niche, stage, last_touch), the 4 intents, and that it must return BOTH a short chat reply AND zero-or-more structured proposals.
- Uses `Output.object` schema:
  ```ts
  { reply: string, proposals: Array<
      { kind: 'log_activity', prospectQuery: string, activityType: 'vn'|'text'|'call'|'note', note: string }
    | { kind: 'update_stage', prospectQuery: string, stage: string }
    | { kind: 'add_prospect', name: string, platform?: string, niche?: string, notes?: string }
    | { kind: 'answer_only' }
  > }
  ```
- Server does **fuzzy name resolution** against the user's prospects and returns `{ matches: Prospect[] }` for each proposal — never writes to DB.
- Auth via `requireSupabaseAuth`.

## Client apply step

`ProposalCard` calls existing store actions on click:
- `log_activity` → `addMessage(prospectId, ...)` + `touchProspect(prospectId)`
- `update_stage` → `updateProspect(prospectId, { stage })`
- `add_prospect` → `addProspect({...})`

This keeps the no-automation invariant: the AI proposes, your click writes.

## Database

New table `assistant_messages` for transcript persistence:

| column | type |
|---|---|
| id | uuid pk |
| user_id | uuid (RLS = auth.uid()) |
| role | text ('user' \| 'assistant') |
| content | text |
| proposals | jsonb (the structured proposals, with `appliedAt` per item once clicked) |
| created_at | timestamptz |

RLS: own-rows only. GRANTs to `authenticated` + `service_role`.

## Out of scope

- Bulk operations ("apply all of these at once") — every card applied individually.
- Auto-send of any outbound message — assistant only logs what you say you've already done; it never drafts-and-sends VNs.
- Voice input.
- Multi-thread history (single rolling thread per user; "Clear chat" button resets it).

## Files touched

- **new**: 4 components, 3 lib files, 1 server route, 1 server fn, 1 migration
- **edit**: `src/routes/__root.tsx` (mount bubble), `src/start.ts` (verify `attachSupabaseAuth`)

Reply **approve** to switch to build mode and I'll ship it.
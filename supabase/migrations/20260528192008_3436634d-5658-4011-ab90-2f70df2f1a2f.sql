-- Pass 2: Unified Conversations — read tracking & sentiment on messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sentiment text;

-- Lightweight check on sentiment values (nullable; only enforce when set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sentiment_check'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sentiment_check
      CHECK (sentiment IS NULL OR sentiment IN ('positive','neutral','negative','objection','buying'));
  END IF;
END $$;

-- Index for unread-count queries per conversation
CREATE INDEX IF NOT EXISTS messages_conversation_unread_idx
  ON public.messages (conversation_id)
  WHERE read_at IS NULL;

-- Per-user unread-count helper (used by inbox badges)
CREATE INDEX IF NOT EXISTS messages_user_unread_idx
  ON public.messages (user_id, conversation_id)
  WHERE read_at IS NULL;
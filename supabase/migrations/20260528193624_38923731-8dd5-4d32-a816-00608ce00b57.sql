ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS sentiment text;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_sentiment_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_sentiment_check
  CHECK (sentiment IS NULL OR sentiment IN ('warm','cooling','dead'));
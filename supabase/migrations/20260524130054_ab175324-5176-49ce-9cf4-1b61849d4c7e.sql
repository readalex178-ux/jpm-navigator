ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_reason text;

CREATE INDEX IF NOT EXISTS prospects_follow_up_at_idx
  ON public.prospects (user_id, follow_up_at)
  WHERE follow_up_at IS NOT NULL;
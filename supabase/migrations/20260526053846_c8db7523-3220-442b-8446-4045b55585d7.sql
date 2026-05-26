ALTER TABLE public.prospects 
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ghl_claimed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ghl_remind_at timestamptz;
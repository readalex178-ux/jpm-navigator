-- Drop the malformed policy that mis-used `extension` (channel topic) as a row id
DROP POLICY IF EXISTS "own messages realtime select" ON realtime.messages;

-- Ensure RLS stays enabled. With no permissive policies, Broadcast/Presence
-- on realtime.messages is denied for all roles by default. The app does not
-- use Broadcast or Presence — it only uses postgres_changes, which is
-- authorized via RLS on public.messages (already scoped to auth.uid()).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
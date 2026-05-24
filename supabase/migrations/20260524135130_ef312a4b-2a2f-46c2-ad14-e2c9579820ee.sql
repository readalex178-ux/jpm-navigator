-- Restrict Realtime channel subscriptions to authenticated users only.
-- postgres_changes still apply table-level RLS on messages/kpi_entries,
-- but realtime.messages governs broadcast/presence topic access.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read realtime" ON realtime.messages;
CREATE POLICY "authenticated can read realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "authenticated can write realtime" ON realtime.messages;
CREATE POLICY "authenticated can write realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
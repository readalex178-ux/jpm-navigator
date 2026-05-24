-- Enable RLS on realtime.messages and scope subscriptions to the owner.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own messages realtime select" ON realtime.messages;
CREATE POLICY "own messages realtime select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id::text = realtime.messages.extension
      AND m.user_id = auth.uid()
  )
  OR
  (realtime.messages.extension IS NULL)
);
ALTER TABLE public.assistant_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assistant_messages;
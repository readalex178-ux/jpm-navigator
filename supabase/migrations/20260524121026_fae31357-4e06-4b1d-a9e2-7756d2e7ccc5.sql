ALTER TABLE public.kpi_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kpi_entries;
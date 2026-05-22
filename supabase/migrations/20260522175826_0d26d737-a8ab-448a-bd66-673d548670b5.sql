-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.message_sender AS ENUM ('me', 'them');
CREATE TYPE public.message_kind AS ENUM ('text', 'vn', 'email', 'comment', 'call', 'note', 'dm');
CREATE TYPE public.dm_platform AS ENUM ('instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'other');

-- ============================================================
-- TIMESTAMP HELPER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  goals JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- USER ROLES (separate table — security best practice)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "own roles select" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PROSPECTS
-- ============================================================
CREATE TABLE public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profile_url TEXT DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'linkedin',
  handle TEXT,
  niche TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  lead_type TEXT NOT NULL DEFAULT 'Direct',
  tier TEXT NOT NULL DEFAULT 'DWY',
  stage TEXT NOT NULL DEFAULT 'Found',
  qual_score INTEGER NOT NULL DEFAULT 0,
  bant JSONB NOT NULL DEFAULT '{"need":0,"timeline":0,"authority":0,"budget":0}'::jsonb,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  intent_level TEXT,
  notes TEXT,
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_touch_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prospects all" ON public.prospects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_prospects_user_last_touch ON public.prospects(user_id, last_touch_at DESC);
CREATE INDEX idx_prospects_user_stage ON public.prospects(user_id, stage);
CREATE TRIGGER trg_prospects_updated_at BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'linkedin',
  external_thread_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations all" ON public.conversations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_conversations_user_prospect ON public.conversations(user_id, prospect_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  sender public.message_sender NOT NULL,
  kind public.message_kind NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  transcript TEXT,
  variation_name TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages all" ON public.messages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_messages_prospect_sent ON public.messages(prospect_id, sent_at DESC);
CREATE INDEX idx_messages_user_sent ON public.messages(user_id, sent_at DESC);

-- ============================================================
-- KPI ENTRIES
-- ============================================================
CREATE TABLE public.kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  vn_sent INTEGER NOT NULL DEFAULT 0,
  connections_sent INTEGER NOT NULL DEFAULT 0,
  connections_accepted INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  active_convos INTEGER NOT NULL DEFAULT 0,
  calendars_sent INTEGER NOT NULL DEFAULT 0,
  booked INTEGER NOT NULL DEFAULT 0,
  shows INTEGER NOT NULL DEFAULT 0,
  hours NUMERIC NOT NULL DEFAULT 0,
  by_platform JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE public.kpi_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kpi all" ON public.kpi_entries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_kpi_updated_at BEFORE UPDATE ON public.kpi_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SCRIPTS
-- ============================================================
CREATE TABLE public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  prospect_name TEXT,
  niche TEXT,
  scenario TEXT,
  used BOOLEAN NOT NULL DEFAULT false,
  outcome TEXT,
  date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scripts all" ON public.scripts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_scripts_updated_at BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRAINING SESSIONS
-- ============================================================
CREATE TABLE public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL,
  persona TEXT,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own training all" ON public.training_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_training_updated_at BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PROSPECT ANALYSES (AI co-pilot history)
-- ============================================================
CREATE TABLE public.prospect_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  stage_at_time TEXT NOT NULL,
  verdict_line TEXT NOT NULL,
  suggested_stage TEXT,
  next_move TEXT,
  draft_message TEXT,
  suggested_activity_type TEXT,
  reasoning TEXT,
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prospect_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analyses all" ON public.prospect_analyses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_analyses_prospect_created ON public.prospect_analyses(prospect_id, created_at DESC);

-- ============================================================
-- INTEGRATIONS (placeholder for OAuth tokens)
-- ============================================================
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integrations all" ON public.integrations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_integrations_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

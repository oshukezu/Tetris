-- ============================================================
-- Tetris Supabase Schema
-- 執行於 Supabase SQL Editor 或 supabase db push
-- ============================================================

-- 1. 玩家資料（排行榜主表）
CREATE TABLE public.tetris_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  games_played  INTEGER NOT NULL DEFAULT 0,
  total_lines   INTEGER NOT NULL DEFAULT 0,
  best_score    INTEGER NOT NULL DEFAULT 0,
  best_max_combo INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 每局遊戲紀錄
CREATE TABLE public.tetris_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL CHECK (score >= 0),
  lines         INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 1,
  max_combo     INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER,
  seed          BIGINT,
  replay_log    JSONB,
  integrity_hash TEXT,
  played_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tetris_sessions_user_played
  ON public.tetris_sessions (user_id, played_at DESC);

-- 3. 非同步對戰
CREATE TABLE public.tetris_challenges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id         UUID NOT NULL REFERENCES auth.users(id),
  challenged_id         UUID REFERENCES auth.users(id),
  challenger_session_id UUID REFERENCES public.tetris_sessions(id),
  challenged_session_id UUID REFERENCES public.tetris_sessions(id),
  challenger_score      INTEGER,
  challenged_score      INTEGER,
  seed                  BIGINT,
  status                TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','accepted','completed','expired')),
  winner_id             UUID REFERENCES auth.users(id),
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tetris_challenges_status
  ON public.tetris_challenges (status, expires_at);

-- 4. 新用戶自動建 profile
CREATE OR REPLACE FUNCTION public.handle_new_tetris_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.tetris_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Player'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_tetris
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tetris_user();

-- 5. 局結束後更新 profile 聚合
CREATE OR REPLACE FUNCTION public.upsert_tetris_profile_from_session()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tetris_profiles SET
    games_played   = games_played + 1,
    total_lines    = total_lines + NEW.lines,
    best_score     = GREATEST(best_score, NEW.score),
    best_max_combo = GREATEST(best_max_combo, NEW.max_combo),
    updated_at     = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tetris_session_update_profile
  AFTER INSERT ON public.tetris_sessions
  FOR EACH ROW EXECUTE FUNCTION public.upsert_tetris_profile_from_session();

-- 6. RLS
ALTER TABLE public.tetris_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tetris_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tetris_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.tetris_profiles
  FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.tetris_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "sessions_select_all" ON public.tetris_sessions
  FOR SELECT USING (true);
CREATE POLICY "sessions_insert_own" ON public.tetris_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenges_select_participant" ON public.tetris_challenges
  FOR SELECT USING (
    auth.uid() IN (challenger_id, challenged_id)
    OR status = 'open'
  );
CREATE POLICY "challenges_insert_challenger" ON public.tetris_challenges
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "challenges_update_participant" ON public.tetris_challenges
  FOR UPDATE USING (auth.uid() IN (challenger_id, challenged_id));

-- 7. 排行榜查詢用 View
CREATE OR REPLACE VIEW public.tetris_leaderboard_scores AS
  SELECT id, display_name, avatar_url, best_score, games_played, best_max_combo, updated_at
  FROM public.tetris_profiles
  ORDER BY best_score DESC;

CREATE OR REPLACE VIEW public.tetris_leaderboard_combos AS
  SELECT id, display_name, avatar_url, best_max_combo, best_score, games_played, updated_at
  FROM public.tetris_profiles
  ORDER BY best_max_combo DESC;

CREATE OR REPLACE VIEW public.tetris_leaderboard_plays AS
  SELECT id, display_name, avatar_url, games_played, best_score, best_max_combo, updated_at
  FROM public.tetris_profiles
  ORDER BY games_played DESC;

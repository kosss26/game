-- =====================================================================
-- «Полночь» — интерактивные чат-истории для Telegram
-- Полная схема БД (для нового проекта Supabase).
-- Для уже существующей базы v0.1 используйте supabase/migrations/002_release_v1.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- Пользователи (синхронизируются из Telegram; гости — отрицательный telegram_id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  language_code TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  skip_credits INT NOT NULL DEFAULT 0 CHECK (skip_credits >= 0),
  bot_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  -- endings: { [story_id]: string[] } — коллекция открытых концовок
  meta JSONB NOT NULL DEFAULT '{}',
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Контент
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  cover_style TEXT DEFAULT 'noir',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order INT NOT NULL DEFAULT 0,
  -- characters, endings, tagline, genre, age_rating, accent
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number > 0),
  title TEXT NOT NULL,
  unlock_at TIMESTAMPTZ,
  estimated_minutes INT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- background_style, recap_text, wait_hours, script, teaser
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, day_number)
);

CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  sort_index INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('message', 'typing', 'pause', 'choice', 'input', 'system', 'jump', 'set', 'end')),
  speaker TEXT CHECK (speaker IN ('npc', 'me', 'system') OR speaker IS NULL),
  text TEXT,
  meta JSONB DEFAULT '{}',
  next_scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenes_tag ON scenes(day_id, tag) WHERE tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scenes_day_sort ON scenes(day_id, sort_index);

CREATE TABLE IF NOT EXISTS choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  goto_tag TEXT,
  goto_scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  set_flags JSONB DEFAULT '{}',
  condition TEXT,
  sort_index INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_choices_scene ON choices(scene_id);

CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot_json JSONB NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day_id, version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_day ON snapshots(day_id, version DESC);

-- ---------------------------------------------------------------------
-- Прогресс игроков
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  -- scene_id хранится как текст из снапшота (без FK: снапшоты неизменяемы,
  -- а черновые сцены могут быть удалены при повторном импорте)
  scene_id TEXT,
  flags JSONB DEFAULT '{}',
  history JSONB NOT NULL DEFAULT '[]',
  state JSONB NOT NULL DEFAULT '{}',
  snapshot_version INT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, story_id, day_id)
);

CREATE INDEX IF NOT EXISTS idx_progresses_user ON progresses(user_id);
CREATE INDEX IF NOT EXISTS idx_progresses_story ON progresses(story_id);
CREATE INDEX IF NOT EXISTS idx_progresses_notify ON progresses(completed, notified_at) WHERE completed = TRUE;

CREATE TABLE IF NOT EXISTS choice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_choice_events_scene ON choice_events(scene_id);
CREATE INDEX IF NOT EXISTS idx_choice_events_day ON choice_events(day_id);
-- Один голос на игрока на сцену выбора: статистика «как выбрали другие» честная
CREATE UNIQUE INDEX IF NOT EXISTS uq_choice_events_user_scene ON choice_events(user_id, scene_id);

-- ---------------------------------------------------------------------
-- Покупки (Telegram Stars)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  product TEXT NOT NULL CHECK (product IN ('skip_day', 'season_pass')),
  day_number INT,
  stars INT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'stars' CHECK (source IN ('stars', 'credit', 'gift')),
  telegram_charge_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_story ON purchases(user_id, story_id);

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_stories_updated_at ON stories;
CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_days_updated_at ON days;
CREATE TRIGGER update_days_updated_at BEFORE UPDATE ON days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_progresses_updated_at ON progresses;
CREATE TRIGGER update_progresses_updated_at BEFORE UPDATE ON progresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- Приложение работает с БД только с сервера через service role key.
-- Публичный anon key может читать лишь опубликованный каталог.
-- ---------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE days ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE progresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE choice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Настройки приложения, которые меняются из студии (например, бесплатный режим)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Журнал ошибок приложения (клиент и сервер). Одинаковые склеиваются по отпечатку.
CREATE TABLE IF NOT EXISTS error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}',
  count INTEGER NOT NULL DEFAULT 1,
  first_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS error_events_last_at ON error_events (last_at DESC);
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published stories" ON stories;
CREATE POLICY "Anyone can read published stories" ON stories
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Anyone can read published days" ON days;
CREATE POLICY "Anyone can read published days" ON days
  FOR SELECT USING (status = 'published');

-- Сцены, выборы и снапшоты — без публичного доступа:
-- контент дня отдаётся только сервером после проверки доступа (платные пропуски).

-- ---------------------------------------------------------------------
-- Функции
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = user_uuid AND role IN ('editor', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Статистика выборов по сцене снапшота
CREATE OR REPLACE FUNCTION get_choice_stats(p_scene_id TEXT)
RETURNS TABLE (choice_id TEXT, count BIGINT) AS $$
  SELECT ce.choice_id, COUNT(*)::BIGINT
  FROM choice_events ce
  WHERE ce.scene_id = p_scene_id
  GROUP BY ce.choice_id;
$$ LANGUAGE sql STABLE SET search_path = public;

-- Атомарное списание бесплатного пропуска
CREATE OR REPLACE FUNCTION consume_skip_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated INT;
BEGIN
  UPDATE users SET skip_credits = skip_credits - 1
  WHERE id = p_user_id AND skip_credits > 0;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Начисление бонуса за приглашённого друга
CREATE OR REPLACE FUNCTION grant_skip_credit(p_user_id UUID, p_amount INT)
RETURNS VOID AS $$
  UPDATE users SET skip_credits = skip_credits + p_amount WHERE id = p_user_id;
$$ LANGUAGE sql SET search_path = public;

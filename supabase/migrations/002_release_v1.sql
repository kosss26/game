-- =====================================================================
-- Миграция существующей базы v0.1 → v1.0
-- Безопасна для повторного запуска. Выполните в Supabase SQL Editor.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- users ---------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS skip_credits INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_blocked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';

-- stories -------------------------------------------------------------
ALTER TABLE stories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS stories_slug_key ON stories(slug);

-- scenes: новые типы jump / set / end --------------------------------
ALTER TABLE scenes DROP CONSTRAINT IF EXISTS scenes_type_check;
ALTER TABLE scenes ADD CONSTRAINT scenes_type_check
  CHECK (type IN ('message', 'typing', 'pause', 'choice', 'input', 'system', 'jump', 'set', 'end'));

-- choices: условия видимости -----------------------------------------
ALTER TABLE choices ADD COLUMN IF NOT EXISTS condition TEXT;

-- progresses: история чата и состояние --------------------------------
ALTER TABLE progresses DROP CONSTRAINT IF EXISTS progresses_scene_id_fkey;
ALTER TABLE progresses ALTER COLUMN scene_id TYPE TEXT USING scene_id::TEXT;
ALTER TABLE progresses ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]';
ALTER TABLE progresses ADD COLUMN IF NOT EXISTS state JSONB NOT NULL DEFAULT '{}';
ALTER TABLE progresses ADD COLUMN IF NOT EXISTS snapshot_version INT;
ALTER TABLE progresses ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE progresses ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
UPDATE progresses SET completed_at = updated_at WHERE completed = TRUE AND completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_progresses_notify ON progresses(completed, notified_at) WHERE completed = TRUE;

-- choice_events: id из снапшота как текст, один голос на сцену --------
ALTER TABLE choice_events DROP CONSTRAINT IF EXISTS choice_events_scene_id_fkey;
ALTER TABLE choice_events DROP CONSTRAINT IF EXISTS choice_events_choice_id_fkey;
ALTER TABLE choice_events ALTER COLUMN scene_id TYPE TEXT USING scene_id::TEXT;
ALTER TABLE choice_events ALTER COLUMN choice_id TYPE TEXT USING choice_id::TEXT;
DELETE FROM choice_events a USING choice_events b
  WHERE a.user_id = b.user_id AND a.scene_id = b.scene_id AND a.created_at > b.created_at;
DELETE FROM choice_events a USING choice_events b
  WHERE a.user_id = b.user_id AND a.scene_id = b.scene_id AND a.created_at = b.created_at AND a.id > b.id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_choice_events_user_scene ON choice_events(user_id, scene_id);

-- purchases -------------------------------------------------------------
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
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- RLS: убираем политики на auth.uid() (приложение не использует Supabase Auth)
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can manage own progress" ON progresses;
DROP POLICY IF EXISTS "Users can insert own choice events" ON choice_events;
DROP POLICY IF EXISTS "Anyone can read scenes from published days" ON scenes;
DROP POLICY IF EXISTS "Anyone can read choices from published scenes" ON choices;
DROP POLICY IF EXISTS "Anyone can read published snapshots" ON snapshots;

-- Функции -----------------------------------------------------------------
DROP FUNCTION IF EXISTS get_choice_stats(UUID);
CREATE OR REPLACE FUNCTION get_choice_stats(p_scene_id TEXT)
RETURNS TABLE (choice_id TEXT, count BIGINT) AS $$
  SELECT ce.choice_id, COUNT(*)::BIGINT
  FROM choice_events ce
  WHERE ce.scene_id = p_scene_id
  GROUP BY ce.choice_id;
$$ LANGUAGE sql STABLE SET search_path = public;

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

CREATE OR REPLACE FUNCTION grant_skip_credit(p_user_id UUID, p_amount INT)
RETURNS VOID AS $$
  UPDATE users SET skip_credits = skip_credits + p_amount WHERE id = p_user_id;
$$ LANGUAGE sql SET search_path = public;

CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = user_uuid AND role IN ('editor', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Telegram MiniApp Stories - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Telegram)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users table
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stories table
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_style TEXT DEFAULT 'noir',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Days table
CREATE TABLE days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  title TEXT NOT NULL,
  unlock_at TIMESTAMPTZ,
  estimated_minutes INT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, day_number)
);

-- Scenes table
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  sort_index INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('message', 'typing', 'pause', 'choice', 'input', 'system')),
  speaker TEXT CHECK (speaker IN ('npc', 'me', 'system') OR speaker IS NULL),
  text TEXT,
  meta JSONB DEFAULT '{}',
  next_scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for tag lookups
CREATE INDEX idx_scenes_tag ON scenes(day_id, tag) WHERE tag IS NOT NULL;
CREATE INDEX idx_scenes_day_sort ON scenes(day_id, sort_index);

-- Choices table
CREATE TABLE choices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  goto_tag TEXT,
  goto_scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  set_flags JSONB DEFAULT '{}',
  sort_index INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_choices_scene ON choices(scene_id);

-- Progress table
CREATE TABLE progresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  flags JSONB DEFAULT '{}',
  completed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, story_id, day_id)
);

CREATE INDEX idx_progresses_user ON progresses(user_id);
CREATE INDEX idx_progresses_story ON progresses(story_id);

-- Choice events for analytics
CREATE TABLE choice_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  choice_id UUID NOT NULL REFERENCES choices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_choice_events_scene ON choice_events(scene_id);
CREATE INDEX idx_choice_events_day ON choice_events(day_id);

-- Snapshots for published versions
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot_json JSONB NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day_id, version)
);

CREATE INDEX idx_snapshots_day ON snapshots(day_id, version DESC);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_days_updated_at
  BEFORE UPDATE ON days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_progresses_updated_at
  BEFORE UPDATE ON progresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS)

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE days ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE progresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE choice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Published stories are readable by everyone
CREATE POLICY "Anyone can read published stories" ON stories
  FOR SELECT USING (status = 'published');

-- Published days are readable by everyone
CREATE POLICY "Anyone can read published days" ON days
  FOR SELECT USING (status = 'published');

-- Scenes from published snapshots are readable
CREATE POLICY "Anyone can read scenes from published days" ON scenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM days WHERE days.id = scenes.day_id AND days.status = 'published'
    )
  );

-- Choices from published scenes are readable
CREATE POLICY "Anyone can read choices from published scenes" ON choices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scenes 
      JOIN days ON days.id = scenes.day_id 
      WHERE scenes.id = choices.scene_id AND days.status = 'published'
    )
  );

-- Users can read/write their own progress
CREATE POLICY "Users can manage own progress" ON progresses
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Users can insert their own choice events
CREATE POLICY "Users can insert own choice events" ON choice_events
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Published snapshots are readable by everyone
CREATE POLICY "Anyone can read published snapshots" ON snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM days WHERE days.id = snapshots.day_id AND days.status = 'published'
    )
  );

-- Admin policies (using service role for admin operations)
-- Admins will use service role key to bypass RLS

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = user_uuid 
    AND role IN ('editor', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get choice statistics for a scene
CREATE OR REPLACE FUNCTION get_choice_stats(p_scene_id UUID)
RETURNS TABLE (
  choice_id UUID,
  label TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_count
  FROM choice_events
  WHERE scene_id = p_scene_id;
  
  RETURN QUERY
  SELECT 
    c.id as choice_id,
    c.label,
    COALESCE(COUNT(ce.id), 0) as count,
    CASE 
      WHEN total_count > 0 THEN ROUND((COUNT(ce.id)::NUMERIC / total_count) * 100, 1)
      ELSE 0
    END as percentage
  FROM choices c
  LEFT JOIN choice_events ce ON ce.choice_id = c.id
  WHERE c.scene_id = p_scene_id
  GROUP BY c.id, c.label
  ORDER BY c.sort_index;
END;
$$ LANGUAGE plpgsql;

-- Insert sample admin user (replace with your Telegram ID after first login)
-- INSERT INTO admin_users (user_id, role) VALUES ('your-user-uuid', 'admin');

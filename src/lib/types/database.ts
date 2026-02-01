// Database types for Supabase

export type StoryStatus = "draft" | "published";
export type DayStatus = "draft" | "published";
export type AdminRole = "viewer" | "editor" | "admin";
export type SceneType = "message" | "typing" | "pause" | "choice" | "input" | "system";
export type Speaker = "npc" | "me" | "system";

export interface Story {
  id: string;
  title: string;
  description: string | null;
  cover_style: string | null;
  status: StoryStatus;
  created_at: string;
  updated_at: string;
}

export interface Day {
  id: string;
  story_id: string;
  day_number: number;
  title: string;
  unlock_at: string | null;
  estimated_minutes: number | null;
  status: DayStatus;
  meta: DayMeta | null;
  created_at: string;
  updated_at: string;
}

export interface DayMeta {
  background_style?: string;
  recap_text?: string;
}

export interface Scene {
  id: string;
  day_id: string;
  sort_index: number;
  type: SceneType;
  speaker: Speaker | null;
  text: string | null;
  meta: SceneMeta | null;
  next_scene_id: string | null;
  tag: string | null;
  created_at: string;
}

export interface SceneMeta {
  typing_delay?: number;
  message_delay?: number;
  pause_duration?: number;
  conditions?: FlagCondition[];
  input_placeholder?: string;
}

export interface FlagCondition {
  flag: string;
  value: string | boolean;
  operator: "eq" | "neq" | "exists";
}

export interface Choice {
  id: string;
  scene_id: string;
  label: string;
  goto_tag: string | null;
  goto_scene_id: string | null;
  set_flags: Record<string, string | boolean> | null;
  sort_index: number;
}

export interface Progress {
  id: string;
  user_id: string;
  story_id: string;
  day_id: string;
  scene_id: string | null;
  flags: Record<string, string | boolean>;
  completed: boolean;
  updated_at: string;
}

export interface ChoiceEvent {
  id: string;
  user_id: string;
  story_id: string;
  day_id: string;
  scene_id: string;
  choice_id: string;
  created_at: string;
}

export interface AdminUser {
  user_id: string;
  role: AdminRole;
  created_at: string;
}

export interface Snapshot {
  id: string;
  day_id: string;
  version: number;
  snapshot_json: SnapshotData;
  published_at: string;
}

export interface SnapshotData {
  day: Omit<Day, "id" | "created_at" | "updated_at">;
  scenes: SnapshotScene[];
  choices: SnapshotChoice[];
}

export interface SnapshotScene {
  id: string;
  sort_index: number;
  type: SceneType;
  speaker: Speaker | null;
  text: string | null;
  meta: SceneMeta | null;
  next_scene_id: string | null;
  tag: string | null;
}

export interface SnapshotChoice {
  id: string;
  scene_id: string;
  label: string;
  goto_scene_id: string | null;
  set_flags: Record<string, string | boolean> | null;
  sort_index: number;
}

// User types
export interface User {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  created_at: string;
}

// Extended types for UI
export interface StoryWithProgress extends Story {
  days: Day[];
  current_progress?: Progress;
}

export interface DayWithScenes extends Day {
  scenes: Scene[];
  choices: Choice[];
}

// Analytics types
export interface ChoiceStats {
  choice_id: string;
  label: string;
  count: number;
  percentage: number;
}

export interface SceneDropoff {
  scene_id: string;
  sort_index: number;
  reached_count: number;
  left_count: number;
  dropoff_rate: number;
}

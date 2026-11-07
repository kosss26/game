// Database & domain types

export type StoryStatus = "draft" | "published";
export type DayStatus = "draft" | "published";
export type AdminRole = "viewer" | "editor" | "admin";
export type SceneType =
  | "message"
  | "typing"
  | "pause"
  | "choice"
  | "input"
  | "system"
  | "jump"
  | "set"
  | "end";
export type Speaker = "npc" | "me" | "system";
export type FlagValue = string | number | boolean;
export type Flags = Record<string, FlagValue>;

export interface Character {
  /** Local portrait asset for the character. */
  avatar?: string;
  name: string;
  /** Hex-цвет имени/аватара */
  color?: string;
  /** 1–2 символа для аватара */
  initials?: string;
  /** Статус в шапке чата, например «в сети» */
  status?: string;
  /** Короткое описание для страницы истории */
  bio?: string;
  /** Система/бот: сообщения приходят без «печатает…» */
  bot?: boolean;
}

/** Чат (тред) внутри истории: групповой или личный */
export interface ChatConfig {
  name: string;
  kind?: "group" | "dm";
  /** Для личного чата — id персонажа */
  character?: string;
  /** Для группы — участники (id персонажей) */
  members?: string[];
  /** Для личного чата — кто ещё может писать с этого «номера» (раскрытая личность) */
  also?: string[];
  color?: string;
  initials?: string;
  status?: string;
}

/** Шкала в шапке чата: значение берётся из числового флага с тем же id */
export interface Meter {
  label: string;
  max: number;
  color?: string;
  /** Показывать, только когда этот флаг истинен (по умолчанию — когда флаг-значение задан) */
  show_when?: string;
  /** Чем больше, тем хуже (красная пульсация при росте) */
  danger?: boolean;
}

/** Улика для блокнота: найдена, если флаг clue_<id> истинен */
export interface Clue {
  title: string;
  text: string;
}

export interface Ending {
  title: string;
  description?: string;
  /** Скрыта до получения */
  secret?: boolean;
}

export interface StoryMeta {
  /** История полностью бесплатна: все главы без ожидания и оплаты */
  free?: boolean;
  /** Short, spoiler-free introduction for the story detail screen. */
  synopsis?: string;
  preview_message?: { character: string; text: string; time?: string };
  tagline?: string;
  /** Текст для кнопки «поделиться» */
  share_text?: string;
  genre?: string;
  age_rating?: string;
  accent?: string;
  /** id персонажа, с которым ведётся чат по умолчанию */
  main_character?: string;
  characters?: Record<string, Character>;
  endings?: Record<string, Ending>;
  /** Флаг, в котором хранится id концовки */
  ending_flag?: string;
  /** Чаты истории (если не заданы — один чат с main_character) */
  chats?: Record<string, ChatConfig>;
  /** Улики для блокнота */
  clues?: Record<string, Clue>;
  /** Шкалы (тревога, доверие и т.п.) */
  meters?: Record<string, Meter>;
}

export interface Story {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  cover_style: string | null;
  status: StoryStatus;
  sort_order: number;
  meta: StoryMeta | null;
  created_at: string;
  updated_at: string;
}

export interface DayMeta {
  background_style?: string;
  recap_text?: string;
  /** Тизер следующего дня на экране завершения */
  teaser?: string;
  /** Текст push-уведомления, когда этот день открывается */
  push?: string;
  /** Через сколько часов после завершения предыдущего дня открывается этот */
  wait_hours?: number;
  /** Исходный скрипт DSL (для повторного редактирования) */
  script?: string;
  /** Персонажи, объявленные в скрипте дня */
  characters?: Record<string, Character>;
  /** Чаты, объявленные в скрипте дня (переопределяют чаты истории) */
  chats?: Record<string, ChatConfig>;
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

export interface SceneMeta {
  typing_delay?: number;
  message_delay?: number;
  pause_duration?: number;
  /** Текст статуса во время паузы («Ася не в сети») */
  pause_label?: string;
  /** id персонажа (для type=message, speaker=npc) */
  character?: string;
  /** Условие (для jump) */
  condition?: string;
  /** Цель перехода (для jump) */
  goto_tag?: string;
  /** Пропустить N следующих сцен (для jump без цели, условные реплики) */
  skip?: number;
  /** Операции над флагами (для set): "trust += 1" */
  ops?: string[];
  /** Ключ флага для input */
  input_key?: string;
  input_placeholder?: string;
  /** Текст подсказки над вариантами выбора */
  prompt?: string;
  /** Таймер выбора (мс) */
  timer_ms?: number;
  /** sort_index варианта по умолчанию (при истечении таймера) */
  default_choice?: number;
  /** id концовки (для end) */
  ending?: string;
  /** Чат, в котором показывается сцена */
  thread?: string;
  /** Архивное сообщение (старая переписка): без набора и без времени */
  past?: boolean;
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

export interface Choice {
  id: string;
  scene_id: string;
  label: string;
  goto_tag: string | null;
  goto_scene_id: string | null;
  set_flags: Flags | null;
  condition: string | null;
  sort_index: number;
}

/** Запись истории чата (что игрок уже видел) */
export interface HistoryEntry {
  /** id сцены снапшота, либо синтетический id ответа игрока */
  id: string;
  kind: "message" | "system" | "reply";
  speaker: Speaker;
  character?: string | null;
  text: string;
  /** время показа, ms epoch */
  at: number;
  /** Не отображается в чате (выбор-действие, служебная отметка) */
  hidden?: boolean;
  /** Чат (тред) */
  thread?: string;
  /** Архивное сообщение */
  past?: boolean;
}

export interface ProgressState {
  /** Ожидание: пауза до момента времени (ms epoch) */
  pause_until?: number;
  pause_label?: string;
}

export interface Progress {
  id: string;
  user_id: string;
  story_id: string;
  day_id: string;
  scene_id: string | null;
  flags: Flags;
  history: HistoryEntry[];
  state: ProgressState;
  snapshot_version: number | null;
  completed: boolean;
  completed_at: string | null;
  notified_at: string | null;
  updated_at: string;
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
  version?: number;
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
  goto_tag?: string | null;
  goto_scene_id: string | null;
  set_flags: Flags | null;
  condition?: string | null;
  sort_index: number;
}

export interface User {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  language_code?: string | null;
  is_guest?: boolean;
  referred_by?: string | null;
  skip_credits?: number;
  bot_blocked?: boolean;
  meta?: {
    endings?: Record<string, string[]>;
    /** Бесплатный доступ ко всем историям, выданный в студии */
    free_access?: boolean;
    free_access_at?: string;
    free_access_note?: string;
  } | null;
  created_at: string;
}

export type PurchaseProduct = "skip_day" | "season_pass";

export interface Purchase {
  id: string;
  user_id: string;
  story_id: string | null;
  product: PurchaseProduct;
  day_number: number | null;
  stars: number;
  source: "stars" | "credit" | "gift";
  telegram_charge_id: string | null;
  created_at: string;
}

export interface StoryWithDays extends Story {
  days: Day[];
}

export interface ChoiceStat {
  choice_id: string;
  label: string;
  count: number;
  percentage: number;
}

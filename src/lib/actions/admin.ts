"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { Story, Day, Scene, Choice, Snapshot, SnapshotData } from "@/lib/types/database";

// ============== STORIES ==============

export async function getAllStories(): Promise<Story[]> {
  // Временно отключаем проверку авторизации для отладки
  // try {
  //   // // await requireAdmin(); // Временно отключено // Временно отключено
  // } catch (err) {
  //   console.log("requireAdmin error (ignored):", err);
  // }
  
  try {
    const supabase = await createAdminSupabaseClient();
    
    console.log("Fetching stories from Supabase...");
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error fetching stories:", error);
      return [];
    }
    
    console.log(`✅ Loaded ${data?.length || 0} stories from DB`);
    if (data && data.length > 0) {
      console.log("Stories:", data.map(s => ({ id: s.id, title: s.title, status: s.status })));
    }
    return (data || []) as Story[];
  } catch (err) {
    console.error("❌ Exception in getAllStories:", err);
    return [];
  }
}

export async function getStory(storyId: string): Promise<Story | null> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .single();

  if (error) return null;
  return data as Story;
}

export async function createStory(data: {
  title: string;
  description?: string;
  cover_style?: string;
}): Promise<Story> {
  // // // await requireAdmin(); // Временно отключено // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data: story, error } = await supabase
    .from("stories")
    .insert({
      title: data.title,
      description: data.description || null,
      cover_style: data.cover_style || "noir",
      status: "draft",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return story as Story;
}

export async function updateStory(
  storyId: string,
  data: Partial<Pick<Story, "title" | "description" | "cover_style" | "status">>
): Promise<Story> {
  // // // await requireAdmin(); // Временно отключено // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data: story, error } = await supabase
    .from("stories")
    .update(data)
    .eq("id", storyId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return story as Story;
}

export async function deleteStory(storyId: string): Promise<void> {
  // // // await requireAdmin(); // Временно отключено // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId);

  if (error) throw new Error(error.message);
}

// ============== DAYS ==============

export async function getStoryDays(storyId: string): Promise<Day[]> {
  // // // await requireAdmin(); // Временно отключено // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("days")
    .select("*")
    .eq("story_id", storyId)
    .order("day_number", { ascending: true });

  if (error) throw new Error(error.message);
  return data as Day[];
}

export async function getDay(dayId: string): Promise<Day | null> {
  // // // await requireAdmin(); // Временно отключено // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("days")
    .select("*")
    .eq("id", dayId)
    .single();

  if (error) return null;
  return data as Day;
}

export async function createDay(data: {
  story_id: string;
  day_number: number;
  title: string;
  unlock_at?: string;
  estimated_minutes?: number;
}): Promise<Day> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data: day, error } = await supabase
    .from("days")
    .insert({
      story_id: data.story_id,
      day_number: data.day_number,
      title: data.title,
      unlock_at: data.unlock_at || null,
      estimated_minutes: data.estimated_minutes || null,
      status: "draft",
      meta: {},
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return day as Day;
}

export async function updateDay(
  dayId: string,
  data: Partial<Pick<Day, "title" | "unlock_at" | "estimated_minutes" | "status" | "meta">>
): Promise<Day> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data: day, error } = await supabase
    .from("days")
    .update(data)
    .eq("id", dayId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return day as Day;
}

export async function deleteDay(dayId: string): Promise<void> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { error } = await supabase
    .from("days")
    .delete()
    .eq("id", dayId);

  if (error) throw new Error(error.message);
}

// ============== SCENES ==============

export async function getDayScenes(dayId: string): Promise<Scene[]> {
  // // // await requireAdmin(); // Временно отключено // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("day_id", dayId)
    .order("sort_index", { ascending: true });

  if (error) throw new Error(error.message);
  return data as Scene[];
}

export async function createScene(data: {
  day_id: string;
  sort_index: number;
  type: Scene["type"];
  speaker?: Scene["speaker"];
  text?: string;
  meta?: Scene["meta"];
  tag?: string;
}): Promise<Scene> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data: scene, error } = await supabase
    .from("scenes")
    .insert({
      day_id: data.day_id,
      sort_index: data.sort_index,
      type: data.type,
      speaker: data.speaker || null,
      text: data.text || null,
      meta: data.meta || {},
      tag: data.tag || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return scene as Scene;
}

export async function updateScene(
  sceneId: string,
  data: Partial<Pick<Scene, "type" | "speaker" | "text" | "meta" | "tag" | "next_scene_id" | "sort_index">>
): Promise<Scene> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data: scene, error } = await supabase
    .from("scenes")
    .update(data)
    .eq("id", sceneId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return scene as Scene;
}

export async function deleteScene(sceneId: string): Promise<void> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { error } = await supabase
    .from("scenes")
    .delete()
    .eq("id", sceneId);

  if (error) throw new Error(error.message);
}

export async function deleteAllDayScenes(dayId: string): Promise<void> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { error } = await supabase
    .from("scenes")
    .delete()
    .eq("day_id", dayId);

  if (error) throw new Error(error.message);
}

// ============== CHOICES ==============

export async function getSceneChoices(sceneIds: string[]): Promise<Choice[]> {
  if (sceneIds.length === 0) return [];
  
  // // // await requireAdmin(); // Временно отключено // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("choices")
    .select("*")
    .in("scene_id", sceneIds)
    .order("sort_index", { ascending: true });

  if (error) throw new Error(error.message);
  return data as Choice[];
}

export async function createChoice(data: {
  scene_id: string;
  label: string;
  goto_tag?: string;
  set_flags?: Record<string, string | boolean>;
  sort_index: number;
}): Promise<Choice> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data: choice, error } = await supabase
    .from("choices")
    .insert({
      scene_id: data.scene_id,
      label: data.label,
      goto_tag: data.goto_tag || null,
      set_flags: data.set_flags || {},
      sort_index: data.sort_index,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return choice as Choice;
}

export async function updateChoice(
  choiceId: string,
  data: Partial<Pick<Choice, "label" | "goto_tag" | "goto_scene_id" | "set_flags" | "sort_index">>
): Promise<Choice> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { data: choice, error } = await supabase
    .from("choices")
    .update(data)
    .eq("id", choiceId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return choice as Choice;
}

export async function deleteChoice(choiceId: string): Promise<void> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();
  
  const { error } = await supabase
    .from("choices")
    .delete()
    .eq("id", choiceId);

  if (error) throw new Error(error.message);
}

// ============== BULK OPERATIONS ==============

export async function bulkCreateScenes(
  dayId: string,
  scenes: Array<{
    type: Scene["type"];
    speaker?: Scene["speaker"];
    text?: string;
    meta?: Scene["meta"];
    tag?: string;
  }>,
  choices: Array<{
    scene_index: number;
    label: string;
    goto_tag?: string;
    set_flags?: Record<string, string | boolean>;
    sort_index: number;
  }>
): Promise<{ scenes: Scene[]; choices: Choice[] }> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();

  // Create scenes with sort_index
  const scenesData = scenes.map((s, index) => ({
    day_id: dayId,
    sort_index: index,
    type: s.type,
    speaker: s.speaker || null,
    text: s.text || null,
    meta: s.meta || {},
    tag: s.tag || null,
  }));

  const { data: createdScenes, error: scenesError } = await supabase
    .from("scenes")
    .insert(scenesData)
    .select();

  if (scenesError) throw new Error(scenesError.message);

  // Create choices with references to created scenes
  const choicesData = choices.map(c => ({
    scene_id: createdScenes[c.scene_index].id,
    label: c.label,
    goto_tag: c.goto_tag || null,
    set_flags: c.set_flags || {},
    sort_index: c.sort_index,
  }));

  let createdChoices: Choice[] = [];
  if (choicesData.length > 0) {
    const { data, error: choicesError } = await supabase
      .from("choices")
      .insert(choicesData)
      .select();

    if (choicesError) throw new Error(choicesError.message);
    createdChoices = data as Choice[];
  }

  // Resolve goto_tag references to goto_scene_id
  const tagToId = new Map<string, string>();
  for (const scene of createdScenes) {
    if (scene.tag) {
      tagToId.set(scene.tag, scene.id);
    }
  }

  // Update choices with resolved goto_scene_id
  for (const choice of createdChoices) {
    if (choice.goto_tag && tagToId.has(choice.goto_tag)) {
      await supabase
        .from("choices")
        .update({ goto_scene_id: tagToId.get(choice.goto_tag) })
        .eq("id", choice.id);
      
      choice.goto_scene_id = tagToId.get(choice.goto_tag) || null;
    }
  }

  return { scenes: createdScenes as Scene[], choices: createdChoices };
}

// ============== PUBLISHING ==============

export async function publishDay(dayId: string): Promise<Snapshot> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();

  // Get day info
  const { data: day, error: dayError } = await supabase
    .from("days")
    .select("*")
    .eq("id", dayId)
    .single();

  if (dayError || !day) throw new Error("Day not found");

  // Get all scenes
  const { data: scenes, error: scenesError } = await supabase
    .from("scenes")
    .select("*")
    .eq("day_id", dayId)
    .order("sort_index", { ascending: true });

  if (scenesError) throw new Error(scenesError.message);

  // Get all choices
  const sceneIds = scenes.map(s => s.id);
  const { data: choices, error: choicesError } = await supabase
    .from("choices")
    .select("*")
    .in("scene_id", sceneIds)
    .order("sort_index", { ascending: true });

  if (choicesError) throw new Error(choicesError.message);

  // Get latest version number
  const { data: latestSnapshot } = await supabase
    .from("snapshots")
    .select("version")
    .eq("day_id", dayId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const newVersion = (latestSnapshot?.version || 0) + 1;

  // Build snapshot data
  const snapshotData: SnapshotData = {
    day: {
      story_id: day.story_id,
      day_number: day.day_number,
      title: day.title,
      unlock_at: day.unlock_at,
      estimated_minutes: day.estimated_minutes,
      status: "published",
      meta: day.meta,
    },
    scenes: scenes.map(s => ({
      id: s.id,
      sort_index: s.sort_index,
      type: s.type,
      speaker: s.speaker,
      text: s.text,
      meta: s.meta,
      next_scene_id: s.next_scene_id,
      tag: s.tag,
    })),
    choices: choices.map(c => ({
      id: c.id,
      scene_id: c.scene_id,
      label: c.label,
      goto_scene_id: c.goto_scene_id,
      set_flags: c.set_flags,
      sort_index: c.sort_index,
    })),
  };

  // Create snapshot
  const { data: snapshot, error: snapshotError } = await supabase
    .from("snapshots")
    .insert({
      day_id: dayId,
      version: newVersion,
      snapshot_json: snapshotData,
    })
    .select()
    .single();

  if (snapshotError) throw new Error(snapshotError.message);

  // Update day status
  await supabase
    .from("days")
    .update({ status: "published" })
    .eq("id", dayId);

  return snapshot as Snapshot;
}

export async function publishStory(storyId: string): Promise<void> {
  // // await requireAdmin(); // Временно отключено // Временно отключено
  const supabase = await createAdminSupabaseClient();

  // Check all days are published
  const { data: days } = await supabase
    .from("days")
    .select("id, status")
    .eq("story_id", storyId);

  const unpublishedDays = days?.filter(d => d.status !== "published") || [];
  
  if (unpublishedDays.length > 0) {
    throw new Error(`Cannot publish story: ${unpublishedDays.length} days are not published`);
  }

  // Update story status
  const { error } = await supabase
    .from("stories")
    .update({ status: "published" })
    .eq("id", storyId);

  if (error) throw new Error(error.message);
}

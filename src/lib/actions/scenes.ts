"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Scene, Choice, SnapshotData } from "@/lib/types/database";

/**
 * Get published snapshot for a day
 */
export async function getPublishedSnapshot(dayId: string): Promise<SnapshotData | null> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("snapshots")
    .select("snapshot_json")
    .eq("day_id", dayId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching snapshot:", error);
    return null;
  }

  return data.snapshot_json as SnapshotData;
}

/**
 * Get scenes for a day (draft)
 */
export async function getDayScenes(dayId: string): Promise<Scene[]> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("day_id", dayId)
    .order("sort_index", { ascending: true });

  if (error) {
    console.error("Error fetching scenes:", error);
    return [];
  }

  return data as Scene[];
}

/**
 * Get choices for scenes
 */
export async function getSceneChoices(sceneIds: string[]): Promise<Choice[]> {
  if (sceneIds.length === 0) return [];
  
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("choices")
    .select("*")
    .in("scene_id", sceneIds)
    .order("sort_index", { ascending: true });

  if (error) {
    console.error("Error fetching choices:", error);
    return [];
  }

  return data as Choice[];
}

/**
 * Get scene by tag within a day
 */
export async function getSceneByTag(dayId: string, tag: string): Promise<Scene | null> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("day_id", dayId)
    .eq("tag", tag)
    .single();

  if (error) {
    console.error("Error fetching scene by tag:", error);
    return null;
  }

  return data as Scene;
}

"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { Progress, ChoiceStats } from "@/lib/types/database";

/**
 * Get user progress for all stories
 */
export async function getUserProgress(userId: string): Promise<Progress[]> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("progresses")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching progress:", error);
    return [];
  }

  return data as Progress[];
}

/**
 * Get user progress for a specific story
 */
export async function getStoryProgress(
  userId: string,
  storyId: string
): Promise<Progress | null> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("progresses")
    .select("*")
    .eq("user_id", userId)
    .eq("story_id", storyId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching story progress:", error);
    return null;
  }

  return data as Progress | null;
}

/**
 * Get user progress for a specific day
 */
export async function getDayProgress(
  userId: string,
  storyId: string,
  dayId: string
): Promise<Progress | null> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("progresses")
    .select("*")
    .eq("user_id", userId)
    .eq("story_id", storyId)
    .eq("day_id", dayId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching day progress:", error);
    return null;
  }

  return data as Progress | null;
}

/**
 * Update user progress
 */
export async function updateProgress(
  storyId: string,
  dayId: string,
  sceneId: string,
  flags: Record<string, string | boolean> = {},
  completed: boolean = false
): Promise<Progress | null> {
  const user = await getCurrentUser();
  
  if (!user) {
    console.error("No user session");
    return null;
  }

  const supabase = await createAdminSupabaseClient();
  
  // Check if progress exists
  const { data: existing } = await supabase
    .from("progresses")
    .select("id, flags")
    .eq("user_id", user.id)
    .eq("story_id", storyId)
    .eq("day_id", dayId)
    .single();

  if (existing) {
    // Merge flags
    const mergedFlags = { ...existing.flags, ...flags };
    
    const { data, error } = await supabase
      .from("progresses")
      .update({
        scene_id: sceneId,
        flags: mergedFlags,
        completed,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating progress:", error);
      return null;
    }

    return data as Progress;
  }

  // Create new progress
  const { data, error } = await supabase
    .from("progresses")
    .insert({
      user_id: user.id,
      story_id: storyId,
      day_id: dayId,
      scene_id: sceneId,
      flags,
      completed,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating progress:", error);
    return null;
  }

  return data as Progress;
}

/**
 * Record a choice event for analytics
 */
export async function recordChoiceEvent(
  storyId: string,
  dayId: string,
  sceneId: string,
  choiceId: string
): Promise<boolean> {
  const user = await getCurrentUser();
  
  if (!user) {
    return false;
  }

  const supabase = await createAdminSupabaseClient();
  
  const { error } = await supabase
    .from("choice_events")
    .insert({
      user_id: user.id,
      story_id: storyId,
      day_id: dayId,
      scene_id: sceneId,
      choice_id: choiceId,
    });

  if (error) {
    console.error("Error recording choice event:", error);
    return false;
  }

  return true;
}

/**
 * Get choice statistics for a scene
 */
export async function getChoiceStats(sceneId: string): Promise<ChoiceStats[]> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase.rpc("get_choice_stats", {
    p_scene_id: sceneId,
  });

  if (error) {
    console.error("Error fetching choice stats:", error);
    return [];
  }

  return data as ChoiceStats[];
}

/**
 * Mark day as completed
 */
export async function completeDay(
  storyId: string,
  dayId: string,
  flags: Record<string, string | boolean>
): Promise<boolean> {
  const user = await getCurrentUser();
  
  if (!user) {
    return false;
  }

  const supabase = await createAdminSupabaseClient();
  
  const { error } = await supabase
    .from("progresses")
    .upsert({
      user_id: user.id,
      story_id: storyId,
      day_id: dayId,
      completed: true,
      flags,
    }, {
      onConflict: "user_id,story_id,day_id",
    });

  if (error) {
    console.error("Error completing day:", error);
    return false;
  }

  return true;
}

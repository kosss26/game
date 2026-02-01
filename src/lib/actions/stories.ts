"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Story, Day, StoryWithProgress } from "@/lib/types/database";

/**
 * Get all published stories
 */
export async function getPublishedStories(): Promise<Story[]> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching stories:", error);
    return [];
  }

  return data as Story[];
}

/**
 * Get story by ID with days
 */
export async function getStoryWithDays(storyId: string): Promise<StoryWithProgress | null> {
  const supabase = await createAdminSupabaseClient();
  
  const { data: story, error: storyError } = await supabase
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .single();

  if (storyError || !story) {
    console.error("Error fetching story:", storyError);
    return null;
  }

  const { data: days, error: daysError } = await supabase
    .from("days")
    .select("*")
    .eq("story_id", storyId)
    .eq("status", "published")
    .order("day_number", { ascending: true });

  if (daysError) {
    console.error("Error fetching days:", daysError);
    return null;
  }

  return {
    ...(story as Story),
    days: days as Day[],
  };
}

/**
 * Get day by story and day number
 */
export async function getDay(storyId: string, dayNumber: number): Promise<Day | null> {
  const supabase = await createAdminSupabaseClient();
  
  const { data, error } = await supabase
    .from("days")
    .select("*")
    .eq("story_id", storyId)
    .eq("day_number", dayNumber)
    .single();

  if (error) {
    console.error("Error fetching day:", error);
    return null;
  }

  return data as Day;
}

/**
 * Check if day is unlocked
 */
export async function isDayUnlocked(day: Day): Promise<boolean> {
  if (!day.unlock_at) {
    return true;
  }
  
  return new Date(day.unlock_at) <= new Date();
}


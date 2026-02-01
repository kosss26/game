import type { Day } from "@/lib/types/database";

/**
 * Get time until day unlocks
 */
export function getTimeUntilUnlock(day: Day): number | null {
  if (!day.unlock_at) {
    return null;
  }
  
  const unlockTime = new Date(day.unlock_at).getTime();
  const now = Date.now();
  
  if (unlockTime <= now) {
    return null;
  }
  
  return unlockTime - now;
}

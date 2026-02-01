import type { SnapshotData, SnapshotScene, SnapshotChoice } from "@/lib/types/database";

/**
 * Build runtime data from snapshot
 */
export function buildRuntimeFromSnapshot(snapshot: SnapshotData): {
  scenes: Map<string, SnapshotScene>;
  choices: Map<string, SnapshotChoice[]>;
  firstSceneId: string | null;
  sceneOrder: string[];
} {
  const scenes = new Map<string, SnapshotScene>();
  const choices = new Map<string, SnapshotChoice[]>();
  const sceneOrder: string[] = [];

  // Build scenes map
  const sortedScenes = [...snapshot.scenes].sort((a, b) => a.sort_index - b.sort_index);
  
  for (const scene of sortedScenes) {
    scenes.set(scene.id, scene);
    sceneOrder.push(scene.id);
  }

  // Build choices map
  for (const choice of snapshot.choices) {
    const existing = choices.get(choice.scene_id) || [];
    existing.push(choice);
    choices.set(choice.scene_id, existing);
  }

  // Sort choices by sort_index
  for (const [sceneId, sceneChoices] of choices) {
    choices.set(sceneId, sceneChoices.sort((a, b) => a.sort_index - b.sort_index));
  }

  return {
    scenes,
    choices,
    firstSceneId: sceneOrder[0] || null,
    sceneOrder,
  };
}

/**
 * Get next scene ID based on current scene
 */
export function getNextSceneId(
  currentScene: SnapshotScene,
  sceneOrder: string[],
  selectedChoiceId?: string,
  choices?: SnapshotChoice[]
): string | null {
  // If choice was selected, use its goto
  if (selectedChoiceId && choices) {
    const choice = choices.find(c => c.id === selectedChoiceId);
    if (choice?.goto_scene_id) {
      return choice.goto_scene_id;
    }
  }

  // Use explicit next_scene_id if set
  if (currentScene.next_scene_id) {
    return currentScene.next_scene_id;
  }

  // Default to next scene in order
  const currentIndex = sceneOrder.indexOf(currentScene.id);
  if (currentIndex >= 0 && currentIndex < sceneOrder.length - 1) {
    return sceneOrder[currentIndex + 1];
  }

  return null;
}

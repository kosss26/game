"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTelegram } from "@/lib/telegram/TelegramProvider";
import { updateProgress, recordChoiceEvent } from "@/lib/actions/progress";
import { buildRuntimeFromSnapshot, getNextSceneId } from "@/lib/utils/runtime";
import type { SnapshotData, SnapshotScene, SnapshotChoice, Progress } from "@/lib/types/database";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { ChoiceButtons } from "./ChoiceButtons";
import { InputPrompt } from "./InputPrompt";
import { PauseOverlay } from "./PauseOverlay";
import { DayComplete } from "./DayComplete";

interface ChatPlayerProps {
  storyId: string;
  dayId: string;
  snapshot: SnapshotData;
  initialProgress: Progress | null;
}

interface DisplayedScene {
  scene: SnapshotScene;
  choices?: SnapshotChoice[];
  timestamp: number;
}

export function ChatPlayer({ storyId, dayId, snapshot, initialProgress }: ChatPlayerProps) {
  const { haptic } = useTelegram();
  const chatRef = useRef<HTMLDivElement>(null);
  
  // Build runtime data
  const runtime = buildRuntimeFromSnapshot(snapshot);
  
  // State
  const [displayedScenes, setDisplayedScenes] = useState<DisplayedScene[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, string | boolean>>(initialProgress?.flags || {});
  const [isTyping, setIsTyping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [isWaitingForChoice, setIsWaitingForChoice] = useState(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize from progress or start fresh
  useEffect(() => {
    if (initialProgress?.scene_id && runtime.scenes.has(initialProgress.scene_id)) {
      // Resume from saved position
      const sceneIndex = runtime.sceneOrder.indexOf(initialProgress.scene_id);
      if (sceneIndex > 0) {
        // Restore previous scenes as already displayed
        const previousScenes = runtime.sceneOrder.slice(0, sceneIndex).map(id => ({
          scene: runtime.scenes.get(id)!,
          choices: runtime.choices.get(id),
          timestamp: Date.now(),
        }));
        setDisplayedScenes(previousScenes);
      }
      setCurrentSceneId(initialProgress.scene_id);
    } else {
      // Start from beginning
      setCurrentSceneId(runtime.firstSceneId);
    }
  }, []);

  // Process current scene
  useEffect(() => {
    if (!currentSceneId || isProcessing) return;
    
    const scene = runtime.scenes.get(currentSceneId);
    if (!scene) {
      setIsComplete(true);
      return;
    }

    processScene(scene);
  }, [currentSceneId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [displayedScenes, isTyping]);

  const processScene = async (scene: SnapshotScene) => {
    setIsProcessing(true);

    // Handle typing delay
    const typingDelay = scene.meta?.typing_delay ?? (scene.type === "message" ? 800 : 0);
    if (typingDelay > 0 && scene.type === "message") {
      setIsTyping(true);
      await delay(typingDelay);
      setIsTyping(false);
    }

    // Handle message delay
    const messageDelay = scene.meta?.message_delay ?? 0;
    if (messageDelay > 0) {
      await delay(messageDelay);
    }

    switch (scene.type) {
      case "message":
      case "system":
        displayScene(scene);
        haptic?.impactOccurred("light");
        await delay(300);
        advanceToNextScene(scene);
        break;

      case "typing":
        const duration = scene.meta?.typing_delay ?? 1200;
        setIsTyping(true);
        await delay(duration);
        setIsTyping(false);
        advanceToNextScene(scene);
        break;

      case "pause":
        const pauseDuration = scene.meta?.pause_duration ?? 10000;
        setIsPaused(true);
        setPauseRemaining(pauseDuration);
        // Pause countdown is handled in PauseOverlay
        break;

      case "choice":
        displayScene(scene, runtime.choices.get(scene.id));
        setIsWaitingForChoice(true);
        break;

      case "input":
        displayScene(scene);
        setIsWaitingForInput(true);
        break;

      default:
        advanceToNextScene(scene);
    }

    setIsProcessing(false);
  };

  const displayScene = (scene: SnapshotScene, choices?: SnapshotChoice[]) => {
    setDisplayedScenes(prev => [
      ...prev,
      { scene, choices, timestamp: Date.now() },
    ]);
  };

  const advanceToNextScene = (currentScene: SnapshotScene, choiceId?: string) => {
    const choices = runtime.choices.get(currentScene.id);
    const nextId = getNextSceneId(currentScene, runtime.sceneOrder, choiceId, choices);
    
    if (nextId) {
      setCurrentSceneId(nextId);
      // Save progress
      updateProgress(storyId, dayId, nextId, flags);
    } else {
      setIsComplete(true);
    }
  };

  const handleChoice = useCallback(async (choice: SnapshotChoice) => {
    if (!currentSceneId) return;
    
    haptic?.impactOccurred("medium");
    setIsWaitingForChoice(false);
    
    // Apply flags
    if (choice.set_flags) {
      setFlags(prev => ({ ...prev, ...choice.set_flags }));
    }
    
    // Record analytics
    await recordChoiceEvent(storyId, dayId, currentSceneId, choice.id);
    
    // Navigate to target
    if (choice.goto_scene_id) {
      setCurrentSceneId(choice.goto_scene_id);
      updateProgress(storyId, dayId, choice.goto_scene_id, { ...flags, ...choice.set_flags });
    } else {
      const currentScene = runtime.scenes.get(currentSceneId);
      if (currentScene) {
        advanceToNextScene(currentScene, choice.id);
      }
    }
  }, [currentSceneId, flags, storyId, dayId, haptic]);

  const handleInput = useCallback(async (value: string) => {
    if (!currentSceneId) return;
    
    haptic?.impactOccurred("light");
    setIsWaitingForInput(false);
    
    const currentScene = runtime.scenes.get(currentSceneId);
    if (!currentScene) return;

    // Store input in flags
    const inputKey = `input_${currentSceneId}`;
    const newFlags = { ...flags, [inputKey]: value };
    setFlags(newFlags);
    
    // Add user's response as a bubble
    const userResponse: SnapshotScene = {
      id: `user_input_${Date.now()}`,
      sort_index: -1,
      type: "message",
      speaker: "me",
      text: value,
      meta: null,
      next_scene_id: null,
      tag: null,
    };
    displayScene(userResponse);
    
    await delay(500);
    advanceToNextScene(currentScene);
  }, [currentSceneId, flags, haptic]);

  const handlePauseComplete = useCallback(() => {
    setIsPaused(false);
    const currentScene = runtime.scenes.get(currentSceneId!);
    if (currentScene) {
      advanceToNextScene(currentScene);
    }
  }, [currentSceneId]);

  if (isComplete) {
    return (
      <DayComplete
        storyId={storyId}
        dayId={dayId}
        snapshot={snapshot}
        flags={flags}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-tg-bg">
      {/* Progress indicator */}
      <div className="sticky top-0 z-20 bg-tg-bg/95 backdrop-blur-sm border-b border-tg-border px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-tg-text-secondary">
            День {snapshot.day.day_number}: {snapshot.day.title}
          </span>
          <span className="text-tg-text-hint">
            {displayedScenes.length}/{runtime.scenes.size}
          </span>
        </div>
        <div className="h-1 bg-tg-bg-secondary rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-tg-accent transition-all duration-300"
            style={{ width: `${(displayedScenes.length / runtime.scenes.size) * 100}%` }}
          />
        </div>
      </div>

      {/* Chat area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scrollbar"
      >
        {displayedScenes.map((item, index) => (
          <div key={`${item.scene.id}-${index}`} className="animate-fade-in">
            <MessageBubble scene={item.scene} />
            
            {/* Show choices if this is a choice scene and waiting */}
            {item.choices && isWaitingForChoice && index === displayedScenes.length - 1 && (
              <ChoiceButtons choices={item.choices} onSelect={handleChoice} />
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="animate-fade-in">
            <TypingIndicator />
          </div>
        )}
        
        {isWaitingForInput && currentSceneId && (
          <InputPrompt
            scene={runtime.scenes.get(currentSceneId)!}
            onSubmit={handleInput}
          />
        )}
      </div>

      {/* Pause overlay */}
      {isPaused && (
        <PauseOverlay
          duration={pauseRemaining}
          onComplete={handlePauseComplete}
        />
      )}
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

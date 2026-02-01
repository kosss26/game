"use client";

import type { SnapshotScene } from "@/lib/types/database";

interface MessageBubbleProps {
  scene: SnapshotScene;
}

export function MessageBubble({ scene }: MessageBubbleProps) {
  if (scene.type === "system" || scene.speaker === "system") {
    return (
      <div className="flex justify-center px-4">
        <div className="bubble-system px-4 py-2 max-w-[85%]">
          <p className="text-sm text-tg-text-secondary text-center">
            {scene.text}
          </p>
        </div>
      </div>
    );
  }

  const isMe = scene.speaker === "me";

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 ${
          isMe ? "bubble-me" : "bubble-npc"
        }`}
      >
        {!isMe && scene.speaker && (
          <p className="text-xs font-medium text-tg-accent mb-1">
            {getSpeakerName(scene.speaker)}
          </p>
        )}
        <p className="text-[15px] text-tg-text leading-relaxed whitespace-pre-wrap">
          {scene.text}
        </p>
      </div>
    </div>
  );
}

function getSpeakerName(speaker: string): string {
  // В реальном приложении можно хранить имена NPC в метаданных
  switch (speaker) {
    case "npc":
      return "Собеседник";
    case "me":
      return "Вы";
    default:
      return speaker;
  }
}

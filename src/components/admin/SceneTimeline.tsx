"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteScene } from "@/lib/actions/admin";
import type { Day, Scene, Choice } from "@/lib/types/database";

interface SceneTimelineProps {
  day: Day;
  scenes: Scene[];
  choices: Choice[];
}


export function SceneTimeline({ day: _day, scenes, choices }: SceneTimelineProps) {
  const router = useRouter();
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  
  const choicesByScene = new Map<string, Choice[]>();
  for (const choice of choices) {
    const existing = choicesByScene.get(choice.scene_id) || [];
    existing.push(choice);
    choicesByScene.set(choice.scene_id, existing);
  }

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm("Удалить сцену?")) return;
    try {
      await deleteScene(sceneId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  if (scenes.length === 0) {
    return (
      <div className="text-center py-12 bg-tg-bg-secondary rounded-xl">
        <p className="text-tg-text-hint mb-2">Сцен пока нет</p>
        <p className="text-sm text-tg-text-secondary">
          Используйте вкладку &quot;Импорт&quot; для добавления сцен из скрипта
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {scenes.map((scene, index) => {
        const sceneChoices = choicesByScene.get(scene.id) || [];
        const isExpanded = expandedScene === scene.id;
        
        return (
          <div
            key={scene.id}
            className="bg-tg-bg-secondary rounded-xl border border-tg-border overflow-hidden"
          >
            {/* Scene header */}
            <div
              onClick={() => setExpandedScene(isExpanded ? null : scene.id)}
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-tg-bg-tertiary transition-colors"
            >
              <span className="text-xs text-tg-text-hint w-8 text-right">
                #{index + 1}
              </span>
              
              <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(scene.type)}`}>
                {getTypeLabel(scene.type)}
              </span>
              
              {scene.speaker && (
                <span className="text-xs text-tg-accent">
                  {scene.speaker.toUpperCase()}
                </span>
              )}
              
              <span className="flex-1 text-sm text-tg-text truncate">
                {scene.text || getTypePlaceholder(scene.type)}
              </span>
              
              {scene.tag && (
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                  #{scene.tag}
                </span>
              )}
              
              <svg
                className={`w-4 h-4 text-tg-text-hint transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-tg-border p-3 space-y-3">
                {/* Full text */}
                {scene.text && (
                  <div>
                    <p className="text-xs text-tg-text-hint mb-1">Текст:</p>
                    <p className="text-sm text-tg-text bg-tg-bg rounded-lg p-2">
                      {scene.text}
                    </p>
                  </div>
                )}

                {/* Meta */}
                {scene.meta && Object.keys(scene.meta).length > 0 && (
                  <div>
                    <p className="text-xs text-tg-text-hint mb-1">Мета:</p>
                    <pre className="text-xs text-tg-text-secondary bg-tg-bg rounded-lg p-2 overflow-x-auto">
                      {JSON.stringify(scene.meta, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Choices */}
                {sceneChoices.length > 0 && (
                  <div>
                    <p className="text-xs text-tg-text-hint mb-1">Варианты ответа:</p>
                    <div className="space-y-1">
                      {sceneChoices.map((choice) => (
                        <div
                          key={choice.id}
                          className="flex items-center gap-2 text-sm bg-tg-bg rounded-lg p-2"
                        >
                          <span className="text-tg-text">{choice.label}</span>
                          {choice.goto_tag && (
                            <span className="text-xs text-tg-accent">
                              → {choice.goto_tag}
                            </span>
                          )}
                          {choice.set_flags && Object.keys(choice.set_flags).length > 0 && (
                            <span className="text-xs text-yellow-400">
                              [flags]
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleDeleteScene(scene.id)}
                    className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getTypeColor(type: Scene["type"]): string {
  switch (type) {
    case "message":
      return "bg-blue-500/20 text-blue-400";
    case "system":
      return "bg-gray-500/20 text-gray-400";
    case "typing":
      return "bg-cyan-500/20 text-cyan-400";
    case "pause":
      return "bg-orange-500/20 text-orange-400";
    case "choice":
      return "bg-green-500/20 text-green-400";
    case "input":
      return "bg-purple-500/20 text-purple-400";
    default:
      return "bg-tg-bg text-tg-text-secondary";
  }
}

function getTypeLabel(type: Scene["type"]): string {
  switch (type) {
    case "message":
      return "сообщение";
    case "system":
      return "система";
    case "typing":
      return "печатает...";
    case "pause":
      return "пауза";
    case "choice":
      return "выбор";
    case "input":
      return "ввод";
    default:
      return type;
  }
}

function getTypePlaceholder(type: Scene["type"]): string {
  switch (type) {
    case "typing":
      return "Печатает сообщение...";
    case "pause":
      return "Пауза";
    default:
      return "";
  }
}

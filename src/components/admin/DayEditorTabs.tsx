"use client";

import { useState } from "react";
import type { Day, Scene, Choice } from "@/lib/types/database";
import { SceneTimeline } from "./SceneTimeline";
import { ScriptImporter } from "./ScriptImporter";
import { DayValidator } from "./DayValidator";
import { DayPublisher } from "./DayPublisher";
import { DaySettings } from "./DaySettings";

interface DayEditorTabsProps {
  day: Day;
  scenes: Scene[];
  choices: Choice[];
}

type Tab = "timeline" | "import" | "validate" | "publish" | "settings";

export function DayEditorTabs({ day, scenes, choices }: DayEditorTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("timeline");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "timeline", label: "Сцены", icon: "📝" },
    { id: "import", label: "Импорт", icon: "📄" },
    { id: "validate", label: "Проверка", icon: "✓" },
    { id: "publish", label: "Публикация", icon: "🚀" },
    { id: "settings", label: "Настройки", icon: "⚙" },
  ];

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex border-b border-tg-border overflow-x-auto -mx-4 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "text-tg-accent border-tg-accent"
                : "text-tg-text-secondary border-transparent"
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "timeline" && (
          <SceneTimeline day={day} scenes={scenes} choices={choices} />
        )}
        {activeTab === "import" && (
          <ScriptImporter day={day} existingScenesCount={scenes.length} />
        )}
        {activeTab === "validate" && (
          <DayValidator day={day} scenes={scenes} choices={choices} />
        )}
        {activeTab === "publish" && (
          <DayPublisher day={day} scenes={scenes} />
        )}
        {activeTab === "settings" && (
          <DaySettings day={day} />
        )}
      </div>
    </div>
  );
}

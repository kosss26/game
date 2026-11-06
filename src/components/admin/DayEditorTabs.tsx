"use client";
import { useState } from "react";
import type {
  Day,
  Scene,
  Choice,
  Character,
  ChatConfig,
} from "@/lib/types/database";
import { Icon, type IconName } from "@/components/ui/Icon";
import { DayPreview } from "./DayPreview";
import { SceneTimeline } from "./SceneTimeline";
import { ScriptImporter } from "./ScriptImporter";
import { DayValidator } from "./DayValidator";
import { DayPublisher } from "./DayPublisher";
import { DaySettings } from "./DaySettings";

type Tab =
  | "import"
  | "timeline"
  | "preview"
  | "validate"
  | "publish"
  | "settings";
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "import", label: "Сценарий", icon: "file" },
  { id: "preview", label: "Тест", icon: "play" },
  { id: "validate", label: "Проверка", icon: "check" },
  { id: "timeline", label: "Сцены", icon: "chat" },
  { id: "publish", label: "Публикация", icon: "forward" },
  { id: "settings", label: "Настройки", icon: "settings" },
];
interface Props {
  day: Day;
  scenes: Scene[];
  choices: Choice[];
  storyCharacters?: Record<string, Character>;
  storyChats?: Record<string, ChatConfig>;
  mainCharacter?: string;
}
export function DayEditorTabs({
  day,
  scenes,
  choices,
  storyCharacters,
  storyChats,
  mainCharacter,
}: Props) {
  const [active, setActive] = useState<Tab>("import");
  const [visited, setVisited] = useState<Tab[]>(["import"]);
  const [scriptDirty, setScriptDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const select = (tab: Tab) => {
    setActive(tab);
    setVisited((previous) =>
      previous.includes(tab) ? previous : [...previous, tab],
    );
  };
  return (
    <div>
      <div
        className="studio-editor-tabs"
        role="tablist"
        aria-label="Редактор главы"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-controls={`panel-${tab.id}`}
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
              else if (event.key === "ArrowLeft")
                next = (index + TABS.length - 1) % TABS.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = TABS.length - 1;
              else return;
              event.preventDefault();
              select(TABS[next].id);
              document.getElementById(`tab-${TABS[next].id}`)?.focus();
            }}
          >
            <Icon name={tab.icon} size={16} />
            {tab.label}
            {tab.id === "import" && scriptDirty && (
              <span aria-label="Есть несохранённые изменения">●</span>
            )}
          </button>
        ))}
      </div>
      {((scriptDirty && active !== "import") ||
        (settingsDirty && active !== "settings")) && (
        <div className="studio-tab-note">
          <p>
            Есть несохранённые изменения. Тест и проверка используют последнюю
            сохранённую версию. Сохраните изменения перед публикацией.
          </p>
          <button onClick={() => select(scriptDirty ? "import" : "settings")}>
            {scriptDirty ? "К сценарию" : "К настройкам"}
          </button>
        </div>
      )}
      {TABS.map((tab) => (
        <div
          key={tab.id}
          className="studio-tab-panel"
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={active !== tab.id}
        >
          {visited.includes(tab.id) && (
            <>
              {tab.id === "import" && (
                <ScriptImporter
                  day={day}
                  existingScenesCount={scenes.length}
                  storyCharacters={storyCharacters}
                  storyChats={storyChats}
                  onDirtyChange={setScriptDirty}
                />
              )}
              {tab.id === "timeline" && (
                <SceneTimeline day={day} scenes={scenes} choices={choices} />
              )}
              {tab.id === "preview" && (
                <DayPreview day={day} mainCharacter={mainCharacter} />
              )}
              {tab.id === "validate" && (
                <DayValidator day={day} scenes={scenes} choices={choices} />
              )}
              {tab.id === "publish" && (
                <DayPublisher
                  day={day}
                  scenes={scenes}
                  hasUnsavedChanges={scriptDirty || settingsDirty}
                />
              )}
              {tab.id === "settings" && (
                <DaySettings day={day} onDirtyChange={setSettingsDirty} />
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

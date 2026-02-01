"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseScript, validateScript, convertToDbFormat, type ParseResult } from "@/lib/parser/dsl-parser";
import { deleteAllDayScenes, bulkCreateScenes, updateDay } from "@/lib/actions/admin";
import type { Day } from "@/lib/types/database";

interface ScriptImporterProps {
  day: Day;
  existingScenesCount: number;
}

export function ScriptImporter({ day, existingScenesCount }: ScriptImporterProps) {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"input" | "preview" | "success">("input");

  const handleParse = () => {
    const result = parseScript(script);
    const validationErrors = validateScript(result);
    result.errors = [...result.errors, ...validationErrors];
    setParseResult(result);
    
    if (result.errors.length === 0) {
      setStep("preview");
    }
  };

  const handleImport = async () => {
    if (!parseResult) return;
    
    setIsLoading(true);
    
    try {
      // Confirm if existing scenes
      if (existingScenesCount > 0) {
        const confirmed = confirm(
          `У этого дня уже есть ${existingScenesCount} сцен. Импорт заменит их все. Продолжить?`
        );
        if (!confirmed) {
          setIsLoading(false);
          return;
        }
        
        // Delete existing scenes
        await deleteAllDayScenes(day.id);
      }

      // Convert and create scenes
      const dbData = convertToDbFormat(parseResult);
      await bulkCreateScenes(day.id, dbData.scenes, dbData.choices);

      // Update day meta if background style was set
      if (parseResult.dayMeta.backgroundStyle) {
        await updateDay(day.id, {
          meta: {
            ...day.meta,
            background_style: parseResult.dayMeta.backgroundStyle,
          },
        });
      }

      setStep("success");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="text-center py-12 bg-tg-bg-secondary rounded-xl">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-lg font-bold text-tg-text mb-2">Импорт завершён!</h3>
        <p className="text-tg-text-secondary mb-4">
          Создано {parseResult?.scenes.length} сцен
        </p>
        <button
          onClick={() => {
            setStep("input");
            setScript("");
            setParseResult(null);
          }}
          className="px-6 py-2 bg-tg-accent text-white rounded-xl"
        >
          Импортировать ещё
        </button>
      </div>
    );
  }

  if (step === "preview" && parseResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-tg-text">Предпросмотр</h3>
          <button
            onClick={() => setStep("input")}
            className="text-sm text-tg-accent"
          >
            ← Назад к редактору
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-tg-bg-secondary rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-tg-accent">{parseResult.scenes.length}</p>
            <p className="text-xs text-tg-text-hint">сцен</p>
          </div>
          <div className="bg-tg-bg-secondary rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">
              {parseResult.choices.filter(c => c.label !== "__input__").length}
            </p>
            <p className="text-xs text-tg-text-hint">выборов</p>
          </div>
          <div className="bg-tg-bg-secondary rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-purple-400">
              {parseResult.scenes.filter(s => s.tag).length}
            </p>
            <p className="text-xs text-tg-text-hint">тегов</p>
          </div>
        </div>

        {/* Scene preview */}
        <div className="bg-tg-bg-secondary rounded-xl p-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-2">
            {parseResult.scenes.slice(0, 20).map((scene, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-tg-text-hint w-6">#{i + 1}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${getTypeColor(scene.type)}`}>
                  {scene.type}
                </span>
                {scene.speaker && (
                  <span className="text-tg-accent text-xs">{scene.speaker}</span>
                )}
                <span className="text-tg-text truncate flex-1">
                  {scene.text || "-"}
                </span>
                {scene.tag && (
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 rounded">
                    #{scene.tag}
                  </span>
                )}
              </div>
            ))}
            {parseResult.scenes.length > 20 && (
              <p className="text-center text-tg-text-hint text-sm pt-2">
                ... и ещё {parseResult.scenes.length - 20} сцен
              </p>
            )}
          </div>
        </div>

        {/* Warnings */}
        {parseResult.warnings.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <h4 className="text-sm font-medium text-yellow-400 mb-2">
              Предупреждения ({parseResult.warnings.length})
            </h4>
            <ul className="text-sm text-yellow-300/80 space-y-1">
              {parseResult.warnings.slice(0, 5).map((w, i) => (
                <li key={i}>Строка {w.line}: {w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Import button */}
        <button
          onClick={handleImport}
          disabled={isLoading}
          className="w-full py-4 bg-tg-accent text-white font-medium rounded-xl disabled:opacity-50"
        >
          {isLoading ? "Импортирование..." : "Импортировать сцены"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-tg-text mb-2">Импорт скрипта</h3>
        <p className="text-sm text-tg-text-secondary">
          Вставьте текст сценария в формате DSL. Парсер автоматически создаст сцены.
        </p>
      </div>

      {/* Script input */}
      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder={SCRIPT_PLACEHOLDER}
        className="w-full h-[400px] bg-tg-bg-secondary border border-tg-border rounded-xl px-4 py-3 text-tg-text placeholder-tg-text-hint focus:outline-none focus:border-tg-accent resize-none font-mono text-sm"
      />

      {/* Errors */}
      {parseResult && parseResult.errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-red-400 mb-2">
            Ошибки ({parseResult.errors.length})
          </h4>
          <ul className="text-sm text-red-300/80 space-y-1">
            {parseResult.errors.map((e, i) => (
              <li key={i}>
                {e.line > 0 && `Строка ${e.line}: `}
                {e.message}
                {e.content && <code className="ml-2 text-xs opacity-70">({e.content})</code>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parse button */}
      <button
        onClick={handleParse}
        disabled={!script.trim()}
        className="w-full py-4 bg-tg-accent text-white font-medium rounded-xl disabled:opacity-50"
      >
        Разобрать скрипт
      </button>

      {/* Syntax help */}
      <details className="bg-tg-bg-secondary rounded-xl">
        <summary className="px-4 py-3 cursor-pointer text-sm text-tg-text-secondary">
          📖 Справка по синтаксису DSL
        </summary>
        <div className="px-4 pb-4 text-sm text-tg-text-hint space-y-2">
          <p><code className="text-tg-accent">NPC:</code> — сообщение от NPC</p>
          <p><code className="text-tg-accent">ME:</code> — сообщение от игрока</p>
          <p><code className="text-tg-accent">SYS:</code> — системное сообщение</p>
          <p><code className="text-tg-accent">...</code> — индикатор печати (1.2 сек)</p>
          <p><code className="text-tg-accent">[pause 10s]</code> — пауза 10 секунд</p>
          <p><code className="text-tg-accent">[delay 800ms]</code> — задержка перед следующим</p>
          <p><code className="text-tg-accent">[typing 1500ms]</code> — время печати</p>
          <p><code className="text-tg-accent">[bg noir]</code> — стиль фона</p>
          <p><code className="text-tg-accent">#tag:NAME</code> — метка для перехода</p>
          <p><code className="text-tg-accent">CHOICE:</code> — начало блока выбора</p>
          <p><code className="text-tg-accent">- Текст -{">"} goto TAG</code> — вариант</p>
          <p><code className="text-tg-accent">INPUT: Текст -{">"} goto TAG</code> — ввод</p>
        </div>
      </details>
    </div>
  );
}

function getTypeColor(type: string): string {
  switch (type) {
    case "message": return "bg-blue-500/20 text-blue-400";
    case "system": return "bg-gray-500/20 text-gray-400";
    case "typing": return "bg-cyan-500/20 text-cyan-400";
    case "pause": return "bg-orange-500/20 text-orange-400";
    case "choice": return "bg-green-500/20 text-green-400";
    case "input": return "bg-purple-500/20 text-purple-400";
    default: return "bg-tg-bg text-tg-text-secondary";
  }
}

const SCRIPT_PLACEHOLDER = `// Пример скрипта дня

[bg noir]

SYS: День 1. Знакомство.

...
NPC: Привет! Ты новенький? #tag:start

...
ME: Да, первый день на работе.

[delay 500ms]
NPC: Отлично! Я покажу тебе всё вокруг.

[pause 3s]

NPC: Кстати, как тебя зовут?

INPUT: Введи своё имя -> goto after_name [set flag:name_entered=true]

NPC: Приятно познакомиться! #tag:after_name

CHOICE:
- Пойти в офис -> goto office [set mood=professional]
- Сначала выпить кофе -> goto coffee [set mood=relaxed]

NPC: Отличный выбор! #tag:office
...
NPC: Идём, покажу твоё рабочее место.

NPC: Хорошая идея! #tag:coffee
...
NPC: Кофе здесь делают отменный.`;

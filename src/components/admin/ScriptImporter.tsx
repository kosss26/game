"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseScript, validateScript } from "@/lib/parser/dsl-parser";
import { importScript } from "@/lib/actions/admin";
import type { Character, ChatConfig, Day } from "@/lib/types/database";
import { Icon } from "@/components/ui/Icon";
import { useUnsavedChanges } from "./useUnsavedChanges";

const CHEATSHEET = `@title Название главы
@minutes 12
@wait 12h
@recap Цитата в конце
@teaser Тизер следующей главы
@push Текст уведомления
@char asya Ася | color=#e17076

asya: Реплика персонажа
ME: Реплика игрока
SYS: Системное сообщение

[typing 1500ms]
[delay 500ms]
[pause 2m Ася не в сети]

:: метка
-> метка
IF trust >= 2 -> метка
SET trust += 1, met = true

CHOICE: Как ответить?
- Ответ -> метка [set trust += 1]
- (Действие без сообщения)

INPUT name: Как тебя зовут?
asya: Привет, {name}!
END
END концовка`;

interface Props {
  day: Day;
  existingScenesCount: number;
  storyCharacters?: Record<string, Character>;
  storyChats?: Record<string, ChatConfig>;
  onDirtyChange?: (dirty: boolean) => void;
}
export function ScriptImporter({
  day,
  existingScenesCount,
  storyCharacters = {},
  storyChats = {},
  onDirtyChange,
}: Props) {
  const router = useRouter();
  const editor = useRef<HTMLTextAreaElement>(null);
  const [script, setScript] = useState(day.meta?.script || "");
  const [savedScript, setSavedScript] = useState(day.meta?.script || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [serverErrors, setServerErrors] = useState<
    Array<{ line: number; message: string }>
  >([]);
  const dirty = script !== savedScript;
  useUnsavedChanges(dirty);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const parsed = useMemo(() => {
    const r = parseScript(script, {
      characters: storyCharacters,
      chats: storyChats,
    });
    r.errors = [...r.errors, ...(script.trim() ? validateScript(r) : [])];
    return r;
  }, [script, storyCharacters, storyChats]);
  const stats = {
    messages: parsed.scenes.filter(
      (s) => s.type === "message" || s.type === "system",
    ).length,
    choices: parsed.scenes.filter((s) => s.type === "choice").length,
    labels: parsed.scenes.filter((s) => s.tag).length,
    words: script.split(/\s+/).filter(Boolean).length,
  };
  const canSave =
    !saving &&
    !parsed.errors.length &&
    !!script.trim() &&
    (dirty || !existingScenesCount);
  const save = async () => {
    if (!canSave) return;
    if (
      existingScenesCount > 0 &&
      day.status === "published" &&
      !confirm(
        "Сцены черновика будут заменены. Опубликованная версия не изменится до повторной публикации. Продолжить?",
      )
    )
      return;
    setSaving(true);
    setMessage(null);
    setServerErrors([]);
    const res = await importScript(day.id, script).catch(
      (e) =>
        ({ ok: false, error: String(e?.message || e) }) as Awaited<
          ReturnType<typeof importScript>
        >,
    );
    setSaving(false);
    if (res.ok) {
      setSavedScript(script);
      setMessage({
        ok: true,
        text: `Черновик сохранён: ${res.scenes} сцен, ${res.choices} вариантов выбора. Для игроков изменения появятся после публикации.`,
      });
      router.refresh();
    } else {
      setServerErrors(res.errors || []);
      setMessage({
        ok: false,
        text: res.error || "Исправьте ошибки в сценарии",
      });
    }
  };
  const goToLine = (line: number) => {
    const textarea = editor.current;
    if (!textarea || line < 1) return;
    const lines = script.split("\n");
    const offset = lines
      .slice(0, line - 1)
      .reduce((n, text) => n + text.length + 1, 0);
    textarea.focus();
    textarea.setSelectionRange(offset, offset + (lines[line - 1]?.length || 0));
    textarea.scrollTop = Math.max(
      0,
      (line - 1) * parseFloat(getComputedStyle(textarea).lineHeight) -
        textarea.clientHeight / 3,
    );
  };
  const errors = serverErrors.length ? serverErrors : parsed.errors;
  return (
    <div className="studio-script-grid">
      <div>
        <div className="studio-script-toolbar">
          <span>
            <Icon name="file" size={15} />
            <label htmlFor={`script-${day.id}`}>Сценарий главы</label>
          </span>
          <span>{script.split("\n").length} строк</span>
        </div>
        <textarea
          id={`script-${day.id}`}
          ref={editor}
          value={script}
          disabled={saving}
          onChange={(e) => {
            setScript(e.target.value);
            setMessage(null);
            setServerErrors([]);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
              e.preventDefault();
              void save();
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Напишите первую реплику…"
          className="studio-script-code"
        />
        {errors.length > 0 && (
          <section
            className="studio-script-issues"
            aria-label="Ошибки сценария"
          >
            <h3>Нужно исправить · {errors.length}</h3>
            {errors.slice(0, 20).map((error, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToLine(error.line)}
              >
                {error.line > 0 && <b>Строка {error.line} · </b>}
                {error.message}
              </button>
            ))}
          </section>
        )}
        {parsed.warnings.length > 0 && (
          <section className="studio-script-issues is-warning">
            <h3>Стоит проверить · {parsed.warnings.length}</h3>
            {parsed.warnings.slice(0, 10).map((warning, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToLine(warning.line)}
              >
                Строка {warning.line} · {warning.message}
              </button>
            ))}
          </section>
        )}
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={`mt-4 ${message.ok ? "studio-success" : "studio-error"}`}
          >
            {message.text}
          </p>
        )}
        <div className="studio-script-footer">
          <p
            className={`studio-save-state ${dirty ? "is-dirty" : ""}`}
            role="status"
          >
            {saving
              ? "Сохраняем черновик…"
              : dirty
                ? "● Есть несохранённые изменения"
                : !script.trim() && !existingScenesCount
                  ? "Сценарий пока пуст"
                  : "✓ Черновик сохранён"}
            <br />
            <span>⌘ / Ctrl + S — сохранить</span>
          </p>
          <button
            type="button"
            className="studio-button"
            disabled={!canSave}
            onClick={() => void save()}
          >
            {saving
              ? "Сохраняем…"
              : dirty || !existingScenesCount
                ? "Сохранить сценарий"
                : "Сохранено"}
          </button>
        </div>
      </div>
      <aside className="studio-script-aside">
        <section>
          <h3>В этой главе</h3>
          <dl>
            <dt>Реплики</dt>
            <dd>{stats.messages}</dd>
            <dt>Выборы</dt>
            <dd>{stats.choices}</dd>
            <dt>Метки</dt>
            <dd>{stats.labels}</dd>
            <dt>Чтение</dt>
            <dd>~{Math.max(1, Math.round(stats.words / 180))} мин</dd>
          </dl>
        </section>
        <section>
          <h3>Пишите. Проверяйте. Публикуйте.</h3>
          <p>
            Сохраните сценарий, затем откройте «Тест» и «Проверка». Публикация —
            отдельный шаг.
          </p>
          <p>
            Переключение вкладок сохраняет текст в редакторе. Перед уходом
            сохраните изменения.
          </p>
        </section>
        <details>
          <summary>Справочник синтаксиса</summary>
          <pre>{CHEATSHEET}</pre>
        </details>
      </aside>
    </div>
  );
}

/**
 * DSL Parser for Story Scripts
 * 
 * Supported syntax:
 * - NPC: message from npc
 * - ME: message from user avatar
 * - SYS: system message (centered)
 * - ... indicates typing indicator (default 1200ms)
 * - [pause 10s] creates a pause scene
 * - [delay 800ms] applies delay meta to next message
 * - [typing 1500ms] applies typing meta to next message
 * - [bg noir] background style tag
 * - CHOICE: starts choice block
 *   - option -> goto <TAG> [set flag:key=val]
 * - INPUT: <prompt> -> goto <TAG> [set flag:key=val]
 * - #tag:TAG at end of line marks a jump target
 */

import type { SceneMeta, Speaker, SceneType } from "@/lib/types/database";

export interface ParsedScene {
  type: SceneType;
  speaker: Speaker | null;
  text: string | null;
  meta: SceneMeta;
  tag: string | null;
}

export interface ParsedChoice {
  sceneIndex: number;
  label: string;
  gotoTag: string | null;
  setFlags: Record<string, string | boolean>;
  sortIndex: number;
}

export interface ParseResult {
  scenes: ParsedScene[];
  choices: ParsedChoice[];
  dayMeta: { backgroundStyle?: string };
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  line: number;
  message: string;
  content: string;
}

export interface ParseWarning {
  line: number;
  message: string;
}

interface ParserState {
  pendingDelay: number | null;
  pendingTyping: number | null;
  inChoiceBlock: boolean;
  currentChoiceSceneIndex: number | null;
  choiceSortIndex: number;
}

// Regex patterns
const PATTERNS = {
  npc: /^NPC:\s*(.+)$/i,
  me: /^ME:\s*(.+)$/i,
  sys: /^SYS:\s*(.+)$/i,
  typing: /^\.\.\.$/,
  pause: /^\[pause\s+(\d+)(s|ms)?\]$/i,
  delay: /^\[delay\s+(\d+)(ms)?\]$/i,
  typingMeta: /^\[typing\s+(\d+)(ms)?\]$/i,
  background: /^\[bg\s+(\w+)\]$/i,
  choice: /^CHOICE:$/i,
  choiceOption: /^-\s*(.+?)\s*->\s*goto\s+(\w+)(?:\s+\[set\s+(.+)\])?$/i,
  input: /^INPUT:\s*(.+?)\s*->\s*goto\s+(\w+)(?:\s+\[set\s+(.+)\])?$/i,
  tag: /#tag:(\w+)\s*$/i,
};

export function parseScript(script: string): ParseResult {
  const lines = script.split("\n");
  const scenes: ParsedScene[] = [];
  const choices: ParsedChoice[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const dayMeta: { backgroundStyle?: string } = {};
  
  const state: ParserState = {
    pendingDelay: null,
    pendingTyping: null,
    inChoiceBlock: false,
    currentChoiceSceneIndex: null,
    choiceSortIndex: 0,
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Skip empty lines
    if (!line) {
      // End choice block if we hit empty line after choices
      if (state.inChoiceBlock && state.choiceSortIndex > 0) {
        state.inChoiceBlock = false;
        state.currentChoiceSceneIndex = null;
        state.choiceSortIndex = 0;
      }
      continue;
    }

    // Skip comments
    if (line.startsWith("//") || line.startsWith("#") && !line.includes("#tag:")) {
      continue;
    }

    try {
      // Background meta
      const bgMatch = line.match(PATTERNS.background);
      if (bgMatch) {
        dayMeta.backgroundStyle = bgMatch[1].toLowerCase();
        continue;
      }

      // Delay meta for next message
      const delayMatch = line.match(PATTERNS.delay);
      if (delayMatch) {
        const value = parseInt(delayMatch[1], 10);
        const unit = delayMatch[2]?.toLowerCase() || "ms";
        state.pendingDelay = unit === "s" ? value * 1000 : value;
        continue;
      }

      // Typing meta for next message
      const typingMetaMatch = line.match(PATTERNS.typingMeta);
      if (typingMetaMatch) {
        const value = parseInt(typingMetaMatch[1], 10);
        const unit = typingMetaMatch[2]?.toLowerCase() || "ms";
        state.pendingTyping = unit === "s" ? value * 1000 : value;
        continue;
      }

      // Typing indicator scene
      if (PATTERNS.typing.test(line)) {
        scenes.push({
          type: "typing",
          speaker: null,
          text: null,
          meta: { typing_delay: state.pendingTyping || 1200 },
          tag: null,
        });
        state.pendingTyping = null;
        continue;
      }

      // Pause scene
      const pauseMatch = line.match(PATTERNS.pause);
      if (pauseMatch) {
        const value = parseInt(pauseMatch[1], 10);
        const unit = pauseMatch[2]?.toLowerCase() || "s";
        const durationMs = unit === "ms" ? value : value * 1000;
        
        scenes.push({
          type: "pause",
          speaker: null,
          text: null,
          meta: { pause_duration: durationMs },
          tag: null,
        });
        continue;
      }

      // Choice block start
      if (PATTERNS.choice.test(line)) {
        state.inChoiceBlock = true;
        state.choiceSortIndex = 0;
        
        // Create choice scene
        scenes.push({
          type: "choice",
          speaker: null,
          text: "Выберите действие",
          meta: {},
          tag: null,
        });
        state.currentChoiceSceneIndex = scenes.length - 1;
        continue;
      }

      // Choice option
      const choiceMatch = line.match(PATTERNS.choiceOption);
      if (choiceMatch) {
        if (!state.inChoiceBlock || state.currentChoiceSceneIndex === null) {
          errors.push({
            line: lineNumber,
            message: "Вариант выбора вне блока CHOICE:",
            content: line,
          });
          continue;
        }

        const [, label, gotoTag, flagsStr] = choiceMatch;
        const setFlags = parseFlagsString(flagsStr);

        choices.push({
          sceneIndex: state.currentChoiceSceneIndex,
          label: label.trim(),
          gotoTag: gotoTag.trim(),
          setFlags,
          sortIndex: state.choiceSortIndex++,
        });
        continue;
      }

      // Input prompt
      const inputMatch = line.match(PATTERNS.input);
      if (inputMatch) {
        const [, prompt, gotoTag, flagsStr] = inputMatch;
        const setFlags = parseFlagsString(flagsStr);

        // Extract tag if present
        const tagMatch = prompt.match(PATTERNS.tag);
        const sceneTag = tagMatch ? tagMatch[1] : null;
        const cleanPrompt = tagMatch ? prompt.replace(PATTERNS.tag, "").trim() : prompt;

        scenes.push({
          type: "input",
          speaker: null,
          text: cleanPrompt.trim(),
          meta: { input_placeholder: "Введите ответ..." },
          tag: sceneTag,
        });

        // Input acts like a choice with single option
        choices.push({
          sceneIndex: scenes.length - 1,
          label: "__input__",
          gotoTag: gotoTag.trim(),
          setFlags,
          sortIndex: 0,
        });
        continue;
      }

      // NPC message
      const npcMatch = line.match(PATTERNS.npc);
      if (npcMatch) {
        const text = npcMatch[1];
        addMessageScene(scenes, "npc", text, state);
        continue;
      }

      // ME message
      const meMatch = line.match(PATTERNS.me);
      if (meMatch) {
        const text = meMatch[1];
        addMessageScene(scenes, "me", text, state);
        continue;
      }

      // System message
      const sysMatch = line.match(PATTERNS.sys);
      if (sysMatch) {
        const text = sysMatch[1];
        addMessageScene(scenes, "system", text, state, "system");
        continue;
      }

      // Unknown line
      if (line.length > 0 && !line.startsWith("[") && !line.startsWith("-")) {
        warnings.push({
          line: lineNumber,
          message: `Непонятная строка, проигнорирована: "${line.substring(0, 50)}..."`,
        });
      }
    } catch (err) {
      errors.push({
        line: lineNumber,
        message: err instanceof Error ? err.message : "Неизвестная ошибка",
        content: line,
      });
    }
  }

  // Validate goto tags
  const definedTags = new Set(scenes.filter(s => s.tag).map(s => s.tag!));
  for (const choice of choices) {
    if (choice.gotoTag && !definedTags.has(choice.gotoTag)) {
      errors.push({
        line: 0,
        message: `Тег "${choice.gotoTag}" не найден в скрипте`,
        content: `Выбор: "${choice.label}"`,
      });
    }
  }

  return { scenes, choices, dayMeta, errors, warnings };
}

function addMessageScene(
  scenes: ParsedScene[],
  speaker: Speaker,
  rawText: string,
  state: ParserState,
  type: SceneType = "message"
): void {
  // Extract tag if present
  const tagMatch = rawText.match(PATTERNS.tag);
  const sceneTag = tagMatch ? tagMatch[1] : null;
  const text = tagMatch ? rawText.replace(PATTERNS.tag, "").trim() : rawText.trim();

  const meta: SceneMeta = {};
  
  if (state.pendingDelay) {
    meta.message_delay = state.pendingDelay;
    state.pendingDelay = null;
  }
  
  if (state.pendingTyping) {
    meta.typing_delay = state.pendingTyping;
    state.pendingTyping = null;
  }

  scenes.push({
    type,
    speaker,
    text,
    meta,
    tag: sceneTag,
  });
}

function parseFlagsString(flagsStr: string | undefined): Record<string, string | boolean> {
  if (!flagsStr) return {};

  const flags: Record<string, string | boolean> = {};
  
  // Format: flag:key=val,flag2=val2 or key=val,key2=val2
  const pairs = flagsStr.split(",").map(s => s.trim());
  
  for (const pair of pairs) {
    // Remove "flag:" prefix if present
    const cleanPair = pair.replace(/^flag:/i, "");
    const [key, value] = cleanPair.split("=").map(s => s.trim());
    
    if (key) {
      if (value === undefined || value === "true") {
        flags[key] = true;
      } else if (value === "false") {
        flags[key] = false;
      } else {
        flags[key] = value;
      }
    }
  }

  return flags;
}

/**
 * Validate parsed script for common issues
 */
export function validateScript(result: ParseResult): ParseError[] {
  const errors: ParseError[] = [...result.errors];

  // Check for empty script
  if (result.scenes.length === 0) {
    errors.push({
      line: 0,
      message: "Скрипт пустой или не содержит распознанных сцен",
      content: "",
    });
    return errors;
  }

  // Check for dead ends (scenes with no next and not at the end)
  const tagsWithIncoming = new Set<string>();
  for (const choice of result.choices) {
    if (choice.gotoTag) {
      tagsWithIncoming.add(choice.gotoTag);
    }
  }

  // Check choice scenes have choices
  for (let i = 0; i < result.scenes.length; i++) {
    const scene = result.scenes[i];
    if (scene.type === "choice") {
      const sceneChoices = result.choices.filter(c => c.sceneIndex === i);
      if (sceneChoices.length === 0) {
        errors.push({
          line: 0,
          message: `Сцена выбора #${i + 1} не имеет вариантов ответа`,
          content: scene.text || "",
        });
      }
    }
  }

  return errors;
}

/**
 * Convert parsed result to DB-ready format
 */
export function convertToDbFormat(result: ParseResult): {
  scenes: Array<{
    type: SceneType;
    speaker?: Speaker | null;
    text?: string;
    meta?: SceneMeta | null;
    tag?: string;
  }>;
  choices: Array<{
    scene_index: number;
    label: string;
    goto_tag?: string;
    set_flags?: Record<string, string | boolean>;
    sort_index: number;
  }>;
} {
  return {
    scenes: result.scenes.map(s => ({
      type: s.type,
      speaker: s.speaker,
      text: s.text || undefined,
      meta: s.meta,
      tag: s.tag || undefined,
    })),
    choices: result.choices
      .filter(c => c.label !== "__input__") // Filter out input pseudo-choices
      .map(c => ({
        scene_index: c.sceneIndex,
        label: c.label,
        goto_tag: c.gotoTag || undefined,
        set_flags: Object.keys(c.setFlags).length > 0 ? c.setFlags : undefined,
        sort_index: c.sortIndex,
      })),
  };
}

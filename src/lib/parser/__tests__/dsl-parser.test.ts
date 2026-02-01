import { parseScript, validateScript, convertToDbFormat } from "../dsl-parser";

describe("DSL Parser", () => {
  describe("Basic message parsing", () => {
    it("should parse NPC message", () => {
      const result = parseScript("NPC: Привет!");
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]).toMatchObject({
        type: "message",
        speaker: "npc",
        text: "Привет!",
      });
    });

    it("should parse ME message", () => {
      const result = parseScript("ME: Привет в ответ");
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]).toMatchObject({
        type: "message",
        speaker: "me",
        text: "Привет в ответ",
      });
    });

    it("should parse SYS message", () => {
      const result = parseScript("SYS: День 1");
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]).toMatchObject({
        type: "system",
        speaker: "system",
        text: "День 1",
      });
    });

    it("should parse multiple messages", () => {
      const script = `
NPC: Первое
ME: Второе
SYS: Третье
      `;
      const result = parseScript(script);
      expect(result.scenes).toHaveLength(3);
    });
  });

  describe("Typing indicator", () => {
    it("should parse ... as typing indicator", () => {
      const result = parseScript("...");
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]).toMatchObject({
        type: "typing",
        meta: { typing_delay: 1200 },
      });
    });

    it("should apply custom typing delay", () => {
      const script = `
[typing 2000ms]
...
      `;
      const result = parseScript(script);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].meta?.typing_delay).toBe(2000);
    });
  });

  describe("Pause scenes", () => {
    it("should parse pause in seconds", () => {
      const result = parseScript("[pause 10s]");
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]).toMatchObject({
        type: "pause",
        meta: { pause_duration: 10000 },
      });
    });

    it("should parse pause in milliseconds", () => {
      const result = parseScript("[pause 500ms]");
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].meta?.pause_duration).toBe(500);
    });

    it("should default to seconds if no unit", () => {
      const result = parseScript("[pause 5]");
      expect(result.scenes[0].meta?.pause_duration).toBe(5000);
    });
  });

  describe("Delay and meta modifiers", () => {
    it("should apply delay to next message", () => {
      const script = `
[delay 800ms]
NPC: Сообщение с задержкой
      `;
      const result = parseScript(script);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].meta?.message_delay).toBe(800);
    });

    it("should apply typing delay to next message", () => {
      const script = `
[typing 1500ms]
NPC: Долго печатаю
      `;
      const result = parseScript(script);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].meta?.typing_delay).toBe(1500);
    });
  });

  describe("Tags", () => {
    it("should parse tag at end of message", () => {
      const result = parseScript("NPC: Важная точка #tag:important_point");
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].tag).toBe("important_point");
      expect(result.scenes[0].text).toBe("Важная точка");
    });

    it("should handle tags with underscores", () => {
      const result = parseScript("NPC: Текст #tag:some_long_tag_name");
      expect(result.scenes[0].tag).toBe("some_long_tag_name");
    });
  });

  describe("Background meta", () => {
    it("should parse background style", () => {
      const result = parseScript("[bg noir]");
      expect(result.dayMeta.backgroundStyle).toBe("noir");
      expect(result.scenes).toHaveLength(0);
    });

    it("should handle different background styles", () => {
      expect(parseScript("[bg romance]").dayMeta.backgroundStyle).toBe("romance");
      expect(parseScript("[bg thriller]").dayMeta.backgroundStyle).toBe("thriller");
      expect(parseScript("[bg mystery]").dayMeta.backgroundStyle).toBe("mystery");
    });
  });

  describe("Choice blocks", () => {
    it("should parse choice block with options", () => {
      const script = `
CHOICE:
- Вариант 1 -> goto tag1
- Вариант 2 -> goto tag2
      `;
      const result = parseScript(script);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].type).toBe("choice");
      expect(result.choices).toHaveLength(2);
      expect(result.choices[0].label).toBe("Вариант 1");
      expect(result.choices[0].gotoTag).toBe("tag1");
      expect(result.choices[1].label).toBe("Вариант 2");
      expect(result.choices[1].gotoTag).toBe("tag2");
    });

    it("should parse choice with flags", () => {
      const script = `
CHOICE:
- Быть добрым -> goto good [set flag:mood=good,karma=true]
      `;
      const result = parseScript(script);
      expect(result.choices[0].setFlags).toEqual({
        mood: "good",
        karma: true,
      });
    });

    it("should parse choice with simple flags", () => {
      const script = `
CHOICE:
- Выбор -> goto next [set chosen=true]
      `;
      const result = parseScript(script);
      expect(result.choices[0].setFlags).toEqual({ chosen: true });
    });
  });

  describe("Input scenes", () => {
    it("should parse input prompt", () => {
      const result = parseScript("INPUT: Как тебя зовут? -> goto after_name");
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]).toMatchObject({
        type: "input",
        text: "Как тебя зовут?",
      });
    });

    it("should parse input with flags", () => {
      const script = "INPUT: Введи код -> goto check [set code_entered=true]";
      const result = parseScript(script);
      expect(result.choices[0].setFlags).toEqual({ code_entered: true });
    });
  });

  describe("Error handling", () => {
    it("should report missing goto tag", () => {
      const script = `
NPC: Начало
CHOICE:
- Вариант -> goto nonexistent_tag
      `;
      const result = parseScript(script);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("nonexistent_tag");
    });

    it("should report choice outside block", () => {
      const script = "- Одинокий вариант -> goto somewhere";
      const result = parseScript(script);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("вне блока CHOICE");
    });

    it("should report empty script", () => {
      const result = parseScript("");
      const validated = validateScript(result);
      expect(validated.some(e => e.message.includes("пустой"))).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should warn about choice scene without choices", () => {
      const script = `
NPC: Текст #tag:start
CHOICE:
      `;
      const result = parseScript(script);
      const errors = validateScript(result);
      expect(errors.some(e => e.message.includes("не имеет вариантов"))).toBe(true);
    });
  });

  describe("Complex script", () => {
    it("should parse a complete day script", () => {
      const script = `
[bg noir]

SYS: День 1. Знакомство.

...
NPC: Привет! Ты новенький? #tag:start

[delay 500ms]
...
ME: Да, первый день.

[pause 3s]

NPC: Кстати, как тебя зовут?

INPUT: Введи имя -> goto after_name [set name_entered=true]

NPC: Приятно познакомиться! #tag:after_name

CHOICE:
- Пойти в офис -> goto office [set location=office]
- Выпить кофе -> goto coffee [set location=coffee]

NPC: Идём в офис! #tag:office

NPC: Пойдём за кофе! #tag:coffee
      `;

      const result = parseScript(script);
      
      expect(result.errors).toHaveLength(0);
      expect(result.dayMeta.backgroundStyle).toBe("noir");
      expect(result.scenes.length).toBeGreaterThan(5);
      // 2 choices from CHOICE block + 1 pseudo-choice from INPUT
      expect(result.choices.length).toBe(3);
      
      // Check for all scene types
      const types = result.scenes.map(s => s.type);
      expect(types).toContain("message");
      expect(types).toContain("system");
      expect(types).toContain("typing");
      expect(types).toContain("pause");
      expect(types).toContain("choice");
      expect(types).toContain("input");
    });
  });

  describe("convertToDbFormat", () => {
    it("should convert parsed result to DB format", () => {
      const script = `
NPC: Привет #tag:start
CHOICE:
- Вариант -> goto start
      `;
      const result = parseScript(script);
      const dbFormat = convertToDbFormat(result);
      
      expect(dbFormat.scenes).toHaveLength(2);
      expect(dbFormat.choices).toHaveLength(1);
      expect(dbFormat.scenes[0].tag).toBe("start");
      expect(dbFormat.choices[0].goto_tag).toBe("start");
    });

    it("should filter out input pseudo-choices", () => {
      const script = "INPUT: Текст -> goto next";
      const result = parseScript(script);
      const dbFormat = convertToDbFormat(result);
      
      expect(dbFormat.choices).toHaveLength(0); // __input__ filtered out
    });
  });

  describe("Edge cases", () => {
    it("should ignore comments starting with //", () => {
      const script = `
// Это комментарий
NPC: Текст
      `;
      const result = parseScript(script);
      expect(result.scenes).toHaveLength(1);
    });

    it("should handle empty lines gracefully", () => {
      const script = `
NPC: Первое



NPC: Второе

      `;
      const result = parseScript(script);
      expect(result.scenes).toHaveLength(2);
    });

    it("should be case-insensitive for prefixes", () => {
      const script = `
npc: Нижний регистр
NPC: Верхний регистр
Npc: Смешанный
      `;
      const result = parseScript(script);
      expect(result.scenes).toHaveLength(3);
      expect(result.scenes.every(s => s.speaker === "npc")).toBe(true);
    });

    it("should preserve message text with special characters", () => {
      const result = parseScript("NPC: Привет! Как дела? :) #tag:special");
      expect(result.scenes[0].text).toBe("Привет! Как дела? :)");
    });
  });
});

import { parseScript, validateScript, convertToDbFormat, parseFlagsString } from "../dsl-parser";

describe("DSL parser — реплики", () => {
  it("парсит NPC / ME / SYS", () => {
    const r = parseScript("NPC: Привет\nME: Здравствуй\nSYS: 03:12");
    expect(r.errors).toEqual([]);
    expect(r.scenes.map(s => [s.type, s.speaker, s.text])).toEqual([
      ["message", "npc", "Привет"],
      ["message", "me", "Здравствуй"],
      ["system", "system", "03:12"],
    ]);
  });

  it("регистронезависимые префиксы и спецсимволы в тексте", () => {
    const r = parseScript('npc: Цена: 100$ — "дорого"?! 😅');
    expect(r.scenes[0].text).toBe('Цена: 100$ — "дорого"?! 😅');
  });

  it("персонажи через @char", () => {
    const r = parseScript("@char asya Ася | color=#e17076 | initials=А | status=в сети\nasya: Ты здесь?");
    expect(r.errors).toEqual([]);
    expect(r.dayMeta.characters.asya).toEqual({ name: "Ася", color: "#e17076", initials: "А", status: "в сети" });
    expect(r.scenes[0]).toMatchObject({ type: "message", speaker: "npc", text: "Ты здесь?", meta: { character: "asya" } });
  });

  it("персонажи истории из опций", () => {
    const r = parseScript("gleb: Кто это?", { characters: { gleb: { name: "Глеб" } } });
    expect(r.errors).toEqual([]);
    expect(r.scenes[0].meta.character).toBe("gleb");
  });

  it("ошибка на необъявленного персонажа", () => {
    const r = parseScript("unknown: текст");
    expect(r.errors[0].message).toMatch(/Неизвестный персонаж/);
  });

  it("строки с двоеточием, не похожие на реплику, — предупреждение", () => {
    const r = parseScript("Примечание: это не реплика");
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });

  it("комментарии и пустые строки игнорируются", () => {
    const r = parseScript("// коммент\n# тоже\n\nNPC: Текст");
    expect(r.scenes).toHaveLength(1);
  });
});

describe("DSL parser — темп", () => {
  it("печатает, задержки, паузы", () => {
    const r = parseScript("...\n... 2s\n[typing 1500ms]\n[delay 300ms]\nNPC: Т\n[pause 10s]\n[pause 5m Ася не в сети]\n[pause 500ms]");
    expect(r.errors).toEqual([]);
    expect(r.scenes[0]).toMatchObject({ type: "typing", meta: { typing_delay: 1200 } });
    expect(r.scenes[1]).toMatchObject({ type: "typing", meta: { typing_delay: 2000 } });
    expect(r.scenes[2].meta).toEqual({ typing_delay: 1500, message_delay: 300 });
    expect(r.scenes[3].meta).toEqual({ pause_duration: 10000 });
    expect(r.scenes[4].meta).toEqual({ pause_duration: 300000, pause_label: "Ася не в сети" });
    expect(r.scenes[5].meta).toEqual({ pause_duration: 500 });
  });

  it("метаданные дня", () => {
    const r = parseScript("@title Неизвестный номер\n@minutes 15\n@wait 12h\n@recap Цитата\n@teaser Дальше\n@bg mystery\nNPC: x");
    expect(r.dayMeta).toMatchObject({ title: "Неизвестный номер", minutes: 15, waitHours: 12, recap: "Цитата", teaser: "Дальше", backgroundStyle: "mystery" });
    expect(parseScript("@wait 30m\nNPC: x").dayMeta.waitHours).toBe(0.5);
    expect(parseScript("[bg noir]\nNPC: x").dayMeta.backgroundStyle).toBe("noir");
  });
});

describe("DSL parser — ветвление", () => {
  it("метки трёх видов", () => {
    const r = parseScript(":: a\nNPC: 1\n== b ==\nNPC: 2\nNPC: 3 #tag:c\n#tag:d\nNPC: 4");
    expect(r.errors).toEqual([]);
    expect(r.scenes.map(s => s.tag)).toEqual(["a", "b", "c", "d"]);
  });

  it("несколько меток подряд не теряются", () => {
    const r = parseScript(":: a\n:: b\nNPC: x\n-> a\n-> b");
    expect(r.errors).toEqual([]);
    const tags = r.scenes.map(s => s.tag).filter(Boolean);
    expect(tags).toEqual(["a", "b"]);
  });

  it("переходы, конец, условия, SET", () => {
    const r = parseScript(":: top\nNPC: x\nIF trust >= 2 -> top\nSET trust += 1, met\n-> top\nGOTO top\nEND good\n-> END");
    expect(r.errors).toEqual([]);
    expect(r.scenes.slice(1).map(s => s.type)).toEqual(["jump", "set", "jump", "jump", "end", "end"]);
    expect(r.scenes[1].meta).toEqual({ condition: "trust >= 2", goto_tag: "top" });
    expect(r.scenes[2].meta).toEqual({ ops: ["trust += 1", "met"] });
    expect(r.scenes[5].meta).toEqual({ ending: "good" });
  });

  it("условная реплика превращается в jump со skip", () => {
    const r = parseScript("[if told] NPC: Спасибо");
    expect(r.errors).toEqual([]);
    expect(r.scenes[0]).toMatchObject({ type: "jump", meta: { condition: "!(told)", skip: 1 } });
    expect(r.scenes[1]).toMatchObject({ type: "message", text: "Спасибо" });
  });

  it("неизвестная метка — ошибка", () => {
    const r = parseScript("-> nowhere");
    expect(r.errors[0].message).toMatch(/не найдена/);
  });

  it("дублирующаяся метка — ошибка", () => {
    const r = parseScript(":: a\nNPC: 1\n:: a\nNPC: 2");
    expect(r.errors[0].message).toMatch(/дважды/);
  });

  it("ошибка в условии", () => {
    const r = parseScript("IF (a -> x\n:: x\nNPC: y");
    expect(r.errors.some(e => /скобки|условии/.test(e.message))).toBe(true);
  });

  it("висящая метка в конце становится концом дня", () => {
    const r = parseScript("NPC: x\n-> fin\n:: fin");
    expect(r.errors).toEqual([]);
    expect(r.scenes[r.scenes.length - 1]).toMatchObject({ type: "end", tag: "fin" });
  });
});

describe("DSL parser — выбор и ввод", () => {
  const script = `:: a
NPC: q
CHOICE: Что ответить?
- Кто ты? -> a [set trust -= 1]
- Помогу [set trust += 1, helper]
- (Промолчать) -> a
- Секрет [if knows] [set x = "строка, с запятой"]
NPC: after`;

  it("варианты с переходами, флагами, условиями", () => {
    const r = parseScript(script);
    expect(r.errors).toEqual([]);
    const choiceScene = r.scenes.find(s => s.type === "choice")!;
    expect(choiceScene.meta.prompt).toBe("Что ответить?");
    expect(r.choices.map(c => [c.label, c.gotoTag, c.setFlags, c.condition])).toEqual([
      ["Кто ты?", "a", { trust: "-=1" }, null],
      ["Помогу", null, { trust: "+=1", helper: true }, null],
      ["(Промолчать)", "a", {}, null],
      ["Секрет", null, { x: "строка, с запятой" }, "knows"],
    ]);
    // Блок выбора закрывается первой не-вариантной строкой
    expect(r.scenes[r.scenes.length - 1].text).toBe("after");
  });

  it("формат v1: -> goto tag [set flag:x=true]", () => {
    const r = parseScript("CHOICE:\n- Да -> goto yes [set flag:angry=true]\n- Нет -> goto no\n\nNPC: y #tag:yes\nNPC: n #tag:no");
    expect(r.errors).toEqual([]);
    expect(r.choices[0]).toMatchObject({ label: "Да", gotoTag: "yes", setFlags: { angry: true } });
  });

  it("вариант вне блока — ошибка; пустой CHOICE — ошибка", () => {
    expect(parseScript("- Вариант -> x").errors[0].message).toMatch(/вне блока/);
    expect(parseScript("CHOICE:\nNPC: x").errors[0].message).toMatch(/без вариантов/);
  });

  it("INPUT v2 и v1", () => {
    const r = parseScript("INPUT name: Как тебя зовут?\nINPUT: Код? -> goto ok [set coded=true]\n:: ok\nNPC: Привет, {name}");
    expect(r.errors).toEqual([]);
    expect(r.scenes[0]).toMatchObject({ type: "input", text: "Как тебя зовут?", meta: { input_key: "name" } });
    expect(r.scenes[1]).toMatchObject({ type: "input", text: "Код?" });
    expect(r.scenes[2]).toMatchObject({ type: "set", meta: { ops: ["coded=true"] } });
    expect(r.scenes[3]).toMatchObject({ type: "jump", meta: { goto_tag: "ok" } });
  });
});

describe("validate / convert", () => {
  it("пустой скрипт", () => {
    expect(validateScript(parseScript(""))[0].message).toMatch(/пустой/);
  });

  it("convertToDbFormat сохраняет условия и метки", () => {
    const r = parseScript("CHOICE:\n- A -> x [if t]\n:: x\nNPC: done");
    const db = convertToDbFormat(r);
    expect(db.choices[0]).toEqual({ scene_index: 0, label: "A", goto_tag: "x", set_flags: undefined, condition: "t", sort_index: 0 });
    expect(db.scenes[1].tag).toBe("x");
  });

  it("parseFlagsString", () => {
    expect(parseFlagsString("a, !b, c=2, d=false, e+=3, f='x'")).toEqual({ a: true, b: false, c: 2, d: false, e: "+=3", f: "x" });
    expect(parseFlagsString(undefined)).toEqual({});
  });
});

import { evaluateCondition, applyOp, applyOps, applyChoiceFlags, interpolate, checkCondition } from "../expressions";
import { buildRuntime, resolve, applyChoice, applyInput, isActionChoice } from "../runtime";
import { parseScript, convertToDbFormat } from "@/lib/parser/dsl-parser";
import type { SnapshotData, Flags } from "@/lib/types/database";

describe("условия", () => {
  const f: Flags = { trust: 3, lied: false, name: "Аня", met: true, zero: 0 };
  it.each([
    ["trust >= 3", true],
    ["trust > 3", false],
    ["trust < 4 && met", true],
    ["lied || zero", false],
    ["!lied", true],
    ["not lied and met", true],
    ['name == "аня"', true],
    ["name != 'Аня'", false],
    ["missing", false],
    ["!missing", true],
    ["(trust >= 5 || met) && !lied", true],
    ["met == true", true],
    ["trust = 3", true],
    ["unknown_count >= 0", true],
  ])("%s → %s", (src, expected) => {
    expect(evaluateCondition(src, f)).toBe(expected);
  });

  it("пустое условие истинно, ошибочное ложно", () => {
    expect(evaluateCondition("", f)).toBe(true);
    expect(evaluateCondition(null, f)).toBe(true);
    expect(evaluateCondition("trust >=", f)).toBe(false);
    expect(checkCondition("(a")).not.toBeNull();
    expect(checkCondition("a && b")).toBeNull();
  });
});

describe("операции над флагами", () => {
  it("присваивание, инкремент, булевы", () => {
    let f: Flags = {};
    f = applyOp(f, "trust += 2");
    f = applyOp(f, "trust -= 1");
    f = applyOp(f, "met");
    f = applyOp(f, "!scared");
    f = applyOp(f, 'name = "Ася"');
    f = applyOp(f, "flag:legacy=true");
    expect(f).toEqual({ trust: 1, met: true, scared: false, name: "Ася", legacy: true });
    expect(applyOps({}, ["a = 5", "a += 1"])).toEqual({ a: 6 });
  });

  it("set_flags выбора с инкрементами", () => {
    expect(applyChoiceFlags({ trust: 1 }, { trust: "+=2", x: true })).toEqual({ trust: 3, x: true });
  });

  it("подстановка флагов", () => {
    expect(interpolate("Привет, {name}! {missing}.", { name: "Костя" })).toBe("Привет, Костя! .");
  });
});

function snapshotFrom(script: string): SnapshotData {
  const parsed = parseScript(script);
  if (parsed.errors.length) throw new Error(JSON.stringify(parsed.errors));
  const db = convertToDbFormat(parsed);
  const scenes = db.scenes.map((s, i) => ({
    id: `s${i}`,
    sort_index: i,
    type: s.type,
    speaker: s.speaker ?? null,
    text: s.text ?? null,
    meta: s.meta ?? null,
    next_scene_id: null,
    tag: s.tag ?? null,
  }));
  const choices = db.choices.map((c, i) => ({
    id: `c${i}`,
    scene_id: `s${c.scene_index}`,
    label: c.label,
    goto_tag: c.goto_tag ?? null,
    goto_scene_id: null,
    set_flags: c.set_flags ?? null,
    condition: c.condition ?? null,
    sort_index: c.sort_index,
  }));
  return {
    day: { story_id: "x", day_number: 1, title: "t", unlock_at: null, estimated_minutes: null, status: "published", meta: null },
    scenes,
    choices,
  };
}

/** Прогон дня с заранее заданными ответами; возвращает тексты и итоговые флаги */
function play(script: string, answers: Array<number | string>, start: Flags = {}) {
  const rt = buildRuntime(snapshotFrom(script));
  let pointer = rt.firstSceneId;
  let flags = start;
  const out: string[] = [];
  let ending: string | null = null;
  for (let guard = 0; guard < 1000; guard++) {
    const r = resolve(rt, pointer, flags);
    flags = r.flags;
    const step = r.step;
    if (step.kind === "end") {
      ending = step.ending;
      break;
    }
    if (step.kind === "message") {
      out.push(step.text);
      pointer = rt.scenes[rt.indexById.get(step.scene.id)! + 1]?.id ?? null;
    } else if (step.kind === "typing" || step.kind === "pause") {
      pointer = rt.scenes[rt.indexById.get(step.scene.id)! + 1]?.id ?? null;
    } else if (step.kind === "choice") {
      const a = answers.shift();
      const opt = step.options[a as number];
      out.push(`> ${opt.text}`);
      ({ pointer, flags } = applyChoice(rt, step.scene.id, opt, flags));
    } else if (step.kind === "input") {
      const a = String(answers.shift());
      out.push(`> ${a}`);
      ({ pointer, flags } = applyInput(rt, step.scene.id, step.key, a, flags));
    }
  }
  return { out, flags, ending };
}

describe("рантайм", () => {
  const script = `
NPC: Привет
INPUT name: Как тебя зовут?
NPC: Рад знакомству, {name}.
CHOICE:
- Доверяю [set trust += 2]
- Не доверяю -> cold [set trust -= 1]
- (Секрет) [if vip] -> secret
NPC: Спасибо.
-> merge
:: cold
NPC: Жаль.
:: merge
[if trust >= 2] NPC: Ты настоящий друг.
IF trust < 0 -> bad
NPC: До завтра.
END
:: bad
NPC: Прощай.
END lonely
:: secret
NPC: Тсс.
`;

  it("ветка доверия: флаги, подстановка, условная реплика, слияние", () => {
    const r = play(script, ["Костя", 0]);
    expect(r.out).toEqual([
      "Привет",
      "> Костя",
      "Рад знакомству, Костя.",
      "> Доверяю",
      "Спасибо.",
      "Ты настоящий друг.",
      "До завтра.",
    ]);
    expect(r.flags).toMatchObject({ name: "Костя", trust: 2 });
    expect(r.ending).toBeNull();
  });

  it("ветки не «проваливаются» друг в друга и концовка передаётся", () => {
    const r = play(script, ["Аня", 1]);
    expect(r.out).toEqual(["Привет", "> Аня", "Рад знакомству, Аня.", "> Не доверяю", "Жаль.", "Прощай."]);
    expect(r.ending).toBe("lonely");
  });

  it("условные варианты скрыты без флага и видны с ним", () => {
    const rt = buildRuntime(snapshotFrom(script));
    const findChoice = (flags: Flags) => {
      let pointer = rt.firstSceneId;
      for (;;) {
        const r = resolve(rt, pointer, flags);
        if (r.step.kind === "choice") return r.step.options.length;
        if (r.step.kind === "input") return -1;
        pointer = rt.scenes[rt.indexById.get(r.pointer!)! + 1].id;
      }
    };
    expect(findChoice({})).toBe(-1); // сначала ввод
    const choiceScene = rt.scenes.find(s => s.type === "choice")!;
    expect(resolve(rt, choiceScene.id, {}).step).toMatchObject({ kind: "choice" });
    expect((resolve(rt, choiceScene.id, {}).step as { options: unknown[] }).options).toHaveLength(2);
    expect((resolve(rt, choiceScene.id, { vip: true }).step as { options: unknown[] }).options).toHaveLength(3);
  });

  it("флаги из прошлых дней влияют на текущий", () => {
    const r = play("IF helped -> warm\nNPC: Мы знакомы?\nEND\n:: warm\nNPC: Снова ты!", [], { helped: true });
    expect(r.out).toEqual(["Снова ты!"]);
  });

  it("конец файла — конец дня; битая цель — конец дня", () => {
    expect(play("NPC: a", []).out).toEqual(["a"]);
  });

  it("бесконечный цикл не вешает рантайм", () => {
    const r = play(":: loop\n-> loop", []);
    expect(r.out).toEqual([]);
  });

  it("isActionChoice", () => {
    expect(isActionChoice("(Промолчать)")).toBe(true);
    expect(isActionChoice("*уйти*")).toBe(true);
    expect(isActionChoice("Привет (как дела)")).toBe(false);
  });
});

describe("род игрока и архив", () => {
  it("{м|ж} выбирает форму по флагу gender", () => {
    expect(interpolate("ты {спал|спала}, {брат|сестра}", { gender: "f" })).toBe("ты спала, сестра");
    expect(interpolate("ты {спал|спала}", {})).toBe("ты спал");
    expect(interpolate("{name}, ты {пришёл|пришла}", { name: "Аня", gender: "f" })).toBe("Аня, ты пришла");
  });
  it("архивные сообщения без набора", () => {
    const r = play("[history]\nNPC: давно\n[/history]\nNPC: сейчас", []);
    expect(r.out).toEqual(["давно", "сейчас"]);
    const rt = buildRuntime(snapshotFrom("[history]\nNPC: давно\n[/history]"));
    const step = resolve(rt, rt.firstSceneId, {}).step;
    expect(step.kind === "message" && step.typingMs).toBe(0);
  });
});

describe("выбор на время", () => {
  it("defaultId — помеченный вариант, иначе последний видимый", () => {
    const rt = buildRuntime(snapshotFrom("CHOICE: Быстро [timer 5s]\n- A\n- B [default]\n- C\nNPC: x"));
    const st = resolve(rt, rt.firstSceneId, {}).step;
    expect(st.kind === "choice" && st.timerMs).toBe(5000);
    expect(st.kind === "choice" && st.options.find(o => o.id === st.defaultId)?.label).toBe("B");
    const rt2 = buildRuntime(snapshotFrom("CHOICE: Быстро [timer 5s]\n- A\n- B [default] [if never]\n- C\nNPC: x"));
    const st2 = resolve(rt2, rt2.firstSceneId, {}).step;
    expect(st2.kind === "choice" && st2.options.find(o => o.id === st2.defaultId)?.label).toBe("C");
    const st3 = resolve(buildRuntime(snapshotFrom("CHOICE:\n- A\nNPC: x")), "s0", {}).step;
    expect(st3.kind === "choice" && st3.timerMs).toBeNull();
  });
});

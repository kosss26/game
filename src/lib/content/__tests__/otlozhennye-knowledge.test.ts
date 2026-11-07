import { loadContent } from '../loader';
import { parseDayScript } from '../importer';
import { convertToDbFormat } from '@/lib/parser/dsl-parser';
import { buildRuntime, resolve, applyChoice, applyInput, nextAfter, type Runtime, type Step } from '@/lib/engine/runtime';
import type { Flags, SnapshotData } from '@/lib/types/database';

const story = loadContent().find(s => s.slug === 'otlozhennye')!;
function runtime(day: number): Runtime {
  const parsed = parseDayScript(story.days.find(d => d.number === day)!.script, story.meta.characters, story.meta.chats);
  if (parsed.errors.length) throw new Error(JSON.stringify(parsed.errors));
  const db = convertToDbFormat(parsed);
  return buildRuntime({
    day: { story_id: 's', day_number: day, title: '', unlock_at: null, estimated_minutes: null, status: 'published', meta: null },
    scenes: db.scenes.map((s, i) => ({ ...s, id: `s${i}`, sort_index: i, speaker: s.speaker ?? null, text: s.text ?? null, meta: s.meta ?? null, next_scene_id: null, tag: s.tag ?? null })),
    choices: db.choices.map((c, i) => ({ ...c, id: `c${i}`, scene_id: `s${c.scene_index}`, goto_scene_id: null, set_flags: c.set_flags ?? null, condition: c.condition ?? null })),
  } as SnapshotData);
}

function walk(rt: Runtime, start: Flags, choose: (step: Extract<Step, {kind:'choice'}>) => string | undefined, tag?: string) {
  let pointer = tag ? rt.scenes[rt.indexByTag.get(tag)!].id : rt.firstSceneId;
  let flags = { ...start };
  const messages: string[] = [];
  const prompts: string[] = [];
  for (let guard = 0; guard < 1000; guard++) {
    const result = resolve(rt, pointer, flags);
    flags = result.flags;
    const step = result.step;
    if (step.kind === 'end') return { flags, messages, prompts };
    if (step.kind === 'choice') {
      prompts.push(step.prompt || '');
      const target = choose(step);
      const option = target ? step.options.find(o => o.goto_tag === target) : step.options[0];
      if (!option) throw new Error(`Missing option: ${target}`);
      ({ pointer, flags } = applyChoice(rt, step.scene.id, option, flags));
    } else if (step.kind === 'input') {
      ({ pointer, flags } = applyInput(rt, step.scene.id, step.key, 'Женя', flags));
    } else {
      if (step.kind === 'message') messages.push(step.text);
      pointer = nextAfter(rt, step.scene.id);
    }
  }
  throw new Error('Story did not finish');
}

const d1 = runtime(1);
const d2 = runtime(2);
const d4 = runtime(4);
const d5 = runtime(5);
const d6 = runtime(6);
const offer = 'вторым доверенным';

test('the reported hidden-role path never gives Stas private knowledge on the next day', () => {
  const first = walk(d1, {}, step => ['s_hide', 'l1_send', 'l1_defend', 'ns_s_end'].find(tag => step.options.some(o => o.goto_tag === tag)));
  expect(first.flags.l1_sent).toBeTruthy();
  expect(first.flags.stas_knows_keeper).toBeFalsy();
  expect(first.flags.stas_knows_murder).toBeFalsy();
  const second = walk(d2, first.flags, step => step.options.some(o => o.goto_tag === 'fs_keep_quiet') ? 'fs_keep_quiet' : undefined);
  expect(second.prompts).toContain('Стас не знает о вашей роли в «Хранителе».');
  expect(second.messages.join('\n')).not.toContain(offer);
  expect(second.flags.stas_knows_keeper).toBeFalsy();
  expect(second.flags.stas_consult).toBeFalsy();
});

test.each(['stas_knows_keeper', 'stas_knows_murder'])('previous disclosure via %s permits the control proposal', key => {
  const result = walk(d2, { l1_sent: true, [key]: true }, () => undefined, 'fam_sent');
  expect(result.messages.join('\n')).toContain(offer);
  expect(result.prompts).not.toContain('Стас не знает о вашей роли в «Хранителе».');
});

test('only a new explicit disclosure unlocks the proposal on the hidden-role branch', () => {
  const result = walk(d2, { l1_sent: true }, step => step.options.some(o => o.goto_tag === 'fs_reveal') ? 'fs_reveal' : undefined, 'fam_sent');
  expect(result.flags.stas_knows_keeper).toBe(true);
  expect(result.messages.join('\n')).toContain(offer);
});

test('questioning Stas does not reveal the role or silently enable consultation', () => {
  const result = walk(d2, { l1_sent: true }, step => step.options.some(o => o.goto_tag === 'fs_unknown_why') ? 'fs_unknown_why' : undefined, 'fam_sent');
  expect(result.messages.join('\n')).not.toContain(offer);
  expect(result.flags.stas_knows_keeper).toBeFalsy();
  expect(result.flags.stas_consult).toBeFalsy();
});

test('a cancelled first letter keeps the quiet family scene', () => {
  const result = walk(d2, { l1_cancelled: true }, () => undefined);
  expect(result.messages.join('\n')).toContain('Нужно заказать пироги');
  expect(result.messages.join('\n')).not.toContain(offer);
  expect(result.prompts).not.toContain('Стас не знает о вашей роли в «Хранителе».');
});

test('asking Stas whether to send the letter already gives him knowledge that night', () => {
  const result = walk(d1, {}, step => ['s_hide', 'l1_ask', 'l1_stas', 'l1_send', 'l1_defend', 'ns_s_end'].find(tag => step.options.some(o => o.goto_tag === tag)));
  expect(result.flags.stas_knows_murder).toBeTruthy();
  expect(result.prompts).not.toContain('Стас не знает, что письма читаете вы.');
  expect(result.messages.join('\n')).toContain('А что там дальше, в письмах?');
});

test('telling Stas about the eight o’clock preview records the disclosure', () => {
  const result = walk(d4, {}, () => undefined, 'stas_day');
  expect(result.flags.stas_knows_keeper).toBe(true);
});

test.each([false, true])('the chapter-five accusation requires disclosure: %s', known => {
  const result = walk(d5, { stas_knows_keeper: known }, () => undefined, 'n_stas_family');
  expect(result.messages.join('\n').includes('Ты зачем это отправил')).toBe(known);
});

test('Stas cannot see the queue or know the last recipient while the role stays hidden', () => {
  const result = walk(d6, {}, step => step.options.some(o => o.goto_tag === 'st_still_hidden') ? 'st_still_hidden' : undefined, 'a_end');
  expect(result.prompts).toContain('Стас всё ещё не знает о вашей роли в «Хранителе».');
  expect(result.messages.join('\n')).not.toMatch(/Ты ведь сможешь|оно же тебе|Ты же видишь всю очередь/);
  expect(result.flags.stas_knows_keeper).toBeFalsy();
  expect(result.flags.stas_meet).toBeFalsy();
});

test('late disclosure allows a request to see the letter, without inventing knowledge of its recipient', () => {
  const result = walk(d6, {}, step => step.options.some(o => o.goto_tag === 'st_reveal') ? 'st_reveal' : undefined, 'a_end');
  expect(result.flags.stas_knows_keeper).toBe(true);
  expect(result.messages.join('\n')).toContain('Ты ведь сможешь прочитать его раньше остальных?');
  expect(result.messages.join('\n')).not.toMatch(/оно же тебе|Ты же видишь всю очередь/);
});

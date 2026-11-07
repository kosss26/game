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

function walk(rt: Runtime, start: Flags, choose: (step: Extract<Step, {kind:'choice'}>) => string | undefined, tag?: string, inspect?: (text:string, flags:Flags, chosen:string[])=>void) {
  let pointer = tag ? rt.scenes[rt.indexByTag.get(tag)!].id : rt.firstSceneId;
  let flags = { ...start };
  const messages: string[] = [];
  const prompts: string[] = [];
  const chosen: string[] = [];
  for (let guard = 0; guard < 1000; guard++) {
    const result = resolve(rt, pointer, flags);
    flags = result.flags;
    const step = result.step;
    if (step.kind === 'end') return { flags, messages, prompts, ending:step.ending, chosen };
    if (step.kind === 'choice') {
      prompts.push(step.prompt || '');
      const target = choose(step);
      const option = target ? step.options.find(o => o.goto_tag === target || o.id === target) : step.options[0];
      if (!option) throw new Error(`Missing option: ${target}`);
      if(option.goto_tag)chosen.push(option.goto_tag);
      ({ pointer, flags } = applyChoice(rt, step.scene.id, option, flags));
    } else if (step.kind === 'input') {
      ({ pointer, flags } = applyInput(rt, step.scene.id, step.key, 'Женя', flags));
    } else {
      if (step.kind === 'message') { messages.push(step.text); inspect?.(step.text,flags,chosen); }
      pointer = nextAfter(rt, step.scene.id);
    }
  }
  throw new Error('Story did not finish');
}

const d1 = runtime(1);
const d2 = runtime(2);
const d3 = runtime(3);
const d4 = runtime(4);
const d5 = runtime(5);
const d6 = runtime(6);
const d7 = runtime(7);
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

const chooseTags = (...tags:string[]) => (step:Extract<Step,{kind:'choice'}>) => tags.find(tag=>step.options.some(o=>o.goto_tag===tag));

test('Roman does not reveal the medical diagnosis before the fourth letter', () => {
  const result=walk(d2,{},()=>undefined,'rp_confess');
  expect(result.messages.join('\n')).not.toMatch(/рак|поджелудочн/i);
});

test.each(['l3_family','l3_private','l3_cancel'])('Stas only knows the contents of the third letter when shared: %s', delivery => {
  const result=walk(d3,{alert:2,t_alla:3},chooseTags(delivery,'at_rest','sp_calm'),'l3_window');
  expect(result.messages.some(t=>t.includes('Медсестра, судимость, таблетки'))).toBe(delivery==='l3_family');
});

test.each(['l3f_defend','l3f_silent','l3f_sharp'])('Alla thanks only the actual defense, not another choice: %s', answer => {
  const result=walk(d3,{t_alla:3},chooseTags('l3_family',answer,'at_rest'),'l3_window');
  expect(result.messages.some(t=>t.includes('спасибо, что сказал'))).toBe(answer==='l3f_defend');
  expect(!!result.flags.defended_alla_letter).toBe(answer==='l3f_defend');
});

test.each(['l3_family','l3_private','l3_cancelled'])('the next-day reaction respects the third letter delivery: %s', delivery => {
  const result=walk(d4,{[delivery]:true},()=>undefined,'stas_day');
  expect(result.messages.some(t=>t.includes('после вчерашнего про Аллу'))).toBe(delivery==='l3_family');
});

test.each(['l2_family','l2_private','l2_cancelled'])('Varya only reproaches a public letter when it was public: %s', delivery => {
  const result=walk(d4,{[delivery]:true},chooseTags('vm_skip'),'vm_refuse');
  expect(result.messages.some(t=>t.includes('как папино'))).toBe(delivery==='l2_family');
});

test('refusing callback and postponing an own message does not contact the investigator', () => {
  const result=walk(d4,{},chooseTags('ch_end'),'g_wait');
  expect(result.flags.valiev_known).toBe(true);
  expect(result.flags.valiev_callback).toBeFalsy();
  expect(result.flags.police_contact).toBeFalsy();
  expect(result.messages.join('\n')).not.toMatch(/Ефим Давидович дал ваш номер|Добрый вечер\. Валиев/);
  expect(result.messages.join('\n')).toContain('Сам я ему ваш не передавал');
});

test('the player may initiate contact after declining a callback', () => {
  const result=walk(d4,{},chooseTags('valiev_initiated','v_later'),'g_wait');
  expect(result.flags.police_contact).toBe(true);
  expect(result.flags.valiev_callback).toBeFalsy();
  expect(result.messages.join('\n')).toContain('Гарин дал мне ваш номер');
  expect(result.messages.join('\n')).not.toContain('Ефим Давидович дал ваш номер');
});

test('consenting to a callback permits the investigator to initiate contact', () => {
  const result=walk(d4,{},()=>undefined,'g_valiev');
  expect(result.flags.valiev_callback).toBe(true);
  expect(result.messages.join('\n')).toContain('Ефим Давидович дал ваш номер');
});

test('obtaining a number after the cancelled letter still leaves contact to the player', () => {
  const result=walk(d4,{clue_pharmacy:true},chooseTags('ch_end'),'gc_ask');
  expect(result.flags.clue_lab).toBe(true);
  expect(result.flags.police_contact).toBeFalsy();
  expect(result.messages.join('\n')).not.toContain('Ефим Давидович дал ваш номер');
});

test('Varya asks about the recipient before the player explicitly tells her', () => {
  const result=walk(d5,{},()=>undefined,'n_varya');
  expect(result.messages.join('\n')).not.toContain('шестое. мне.');
  expect(result.messages.join('\n')).toContain('кому следующее');
});

test('the unannounced early visit is acknowledged instead of pretending tomorrow has arrived', () => {
  const result=walk(d6,{alert:3,stas_knows_keeper:true},chooseTags('st_hot_yes'),'a_end');
  expect(result.chosen).toContain('st_hot_yes');
  expect(result.messages.join('\n')).toContain('Вы договаривались на завтра');
  expect(result.messages.join('\n')).toContain('Ты зачем приехал сегодня?');
  expect(result.messages.join('\n')).not.toContain('Сегодня — Варино.');
});

test.each([false,true])('holding new evidence does not transmit it or fabricate an arrest; prior contact: %s', contacted => {
  const result=walk(d7,{proof:3,clue_log:true,police_contact:contacted},chooseTags('fled_hold'),'fled_end');
  expect(result.ending).toBe('sbros');
  expect(result.flags.flight_evidence_sent).toBeFalsy();
  expect(result.messages.join('\n')).not.toMatch(/достаточно для задержания|задержан на паспортном/);
});

test.each([false,true])('an explicit evidence handoff precedes acknowledgement; prior contact: %s', contacted => {
  const result=walk(d7,{proof:3,clue_log:true,clue_corridor:true,police_contact:contacted},chooseTags(contacted?'fled_send_known':'fled_send_via_garin'),'fled_end', (text,flags)=>{
    if(text.includes('достаточно для задержания'))expect(flags.flight_evidence_sent).toBe(true);
  });
  expect(result.flags.police_sent).toBe(true);
  expect(result.flags.police_contact).toBe(true);
  expect(result.messages.join('\n')).toContain('Прошу проверить: вот всё');
  expect(result.ending).toBe('devyat_dney');
});

test.each([false,true])('the finale remembers the car check only if it happened: %s', checked => {
  const result=walk(d7,{clue_gps:checked},()=>undefined,'case_strong');
  expect(result.messages.some(t=>t.includes('Позавчера она проверяла'))).toBe(checked);
  expect(result.messages.join('\n')).not.toContain('Неделю назад она проверяла');
});

test('3000 complete routes keep disclosures, consent and evidence reactions consistent', () => {
  const runtimes=[d1,d2,d3,d4,d5,d6,d7];
  for(let seed=1;seed<=3000;seed++) {
    let state=seed>>>0;
    let flags:Flags={};
    for(let day=0;day<runtimes.length;day++) {
      const result=walk(runtimes[day],flags,step=>{
        state=(state*1664525+1013904223)>>>0;
        return step.options[Math.floor((state/4294967296)*step.options.length)].id;
      },undefined,(text,current)=>{
        let problem='';
        if(text.includes('Медсестра, судимость, таблетки')&&!current.l3_family)problem='private conviction';
        if(text.includes('после вчерашнего про Аллу')&&!current.l3_family)problem='private letter reaction';
        if(text.includes('как папино')&&!current.l2_family)problem='unsent public letter';
        if(text.includes('спасибо, что сказал')&&!current.defended_alla_letter)problem='unchosen defense';
        if(text.includes('Ефим Давидович дал ваш номер')&&!current.valiev_callback)problem='unconsented callback';
        if(text.includes('достаточно для задержания')&&!current.flight_evidence_sent)problem='unsent evidence';
        if(text.includes('Позавчера она проверяла')&&!current.clue_gps)problem='invented car check';
        if(problem)throw new Error(`seed ${seed}, chapter ${day+1}: ${problem}`);
      });
      flags=result.flags;
    }
  }
});

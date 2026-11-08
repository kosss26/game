import { chooseTags, runStoryDay } from './helpers/story-runner';
import { loadContent } from '../loader';
import type { Flags } from '@/lib/types/database';

const text = (r: ReturnType<typeof runStoryDay>) => r.messages.join('\n');

describe('Повторный аудит: источник сведений и реальные действия', () => {
  test.each([false, true])('Ася знает о разнице в сутки только после сообщения игрока: %s', told => {
    const second = runStoryDay('tihiy-chas', 2, { choose: chooseTags(told ? 'day_gap' : 'back') });
    expect(Boolean(second.flags.told_day_gap)).toBe(told);
    const third = runStoryDay('tihiy-chas', 3, { flags: second.flags, choose: chooseTags('truth') });
    expect(text(third).includes('это объясняет почему ты сутки')).toBe(told);
  });

  test.each([false, true])('знакомство с историей Ани не подменяет мнение Степана: %s', heard => {
    const r = runStoryDay('beliy-shum', 3, { tag: 'm_anya', flags: { stepan_doubt: heard } });
    expect(r.offered.some(options => options.includes('m_anya_stepan'))).toBe(heard);
  });

  test.each([false, true])('Тёма отличает сделанную передачу сведений от опасения: %s', leaked => {
    const r = runStoryDay('beliy-shum', 4, { tag: 'u_threat_why', flags: { leak_location: leaked } });
    expect(text(r).includes('ты уже передавал')).toBe(leaked);
    expect(text(r).includes('я боюсь, что ты предупредишь')).toBe(!leaked);
    expect(text(r)).toContain('Степан Ильич вернулся с санками и фонарём');
  });

  test.each([false, true])('Тёма ссылается на обещание только после договорённости: %s', promised => {
    const r = runStoryDay('beliy-shum', 7, { tag: 'night_locked', flags: { tema_calmed: promised } });
    expect(text(r).includes('я обещал тебе')).toBe(promised);
  });

  test.each([false, true])('смерть матери Лизы не известна ведущему заранее: %s', known => {
    let question = '';
    runStoryDay('ne-spitsya', 3, { tag: 'g3', flags: { knows_mother_death: known }, choose: step => {
      question ||= step.options.find(o => o.goto_tag === 'g3_mother')?.text || '';
      return chooseTags('g3_mother')(step);
    } });
    expect(question.includes('умерла весной')).toBe(known);
    expect(question).not.toBe('');
  });

  test('получение личной фотографии становится публичным до локализации слушателем', () => {
    const r = runStoryDay('ne-spitsya', 3, { tag: 'ch_air' });
    const source = r.messages.findIndex(t => t.includes('Вы добавляете в эфире'));
    const inference = r.messages.findIndex(t => t.includes('куранты + отражение'));
    expect(source).toBeGreaterThanOrEqual(0);
    expect(inference).toBeGreaterThan(source);
  });

  test.each([false, true])('финальное освобождение Груздева показано и не повторяется: %s', freed => {
    const r = runStoryDay('ne-spitsya', 5, { tag: 'last_req', flags: { gruzdev_free: freed } });
    expect(r.flags.gruzdev_free).toBe(true);
    expect(text(r).includes('Груздев вышел. Приняли, живой')).toBe(!freed);
    expect(text(r).includes('я разрезала скотч')).toBe(!freed);
  });

  test.each(['d_key_yes', 'd_key_maybe'])('согласие отдать ключ отличается от сомнения: %s', answer => {
    const r = runStoryDay('petlya', 1, { tag: 'd_key', choose: chooseTags('d_key_mira', answer, 'stay_baba') });
    expect(Boolean(r.flags.d_key_promised)).toBe(answer === 'd_key_yes');
    expect(text(r).includes('положил ключ П-1 под журнал')).toBe(answer === 'd_key_yes');
    expect(r.flags.d_exit_asked).toBe(true);
    expect(text(r)).toContain('в 04:30 сошлись на живот');
  });

  test('новая петля сбрасывает прежнюю договорённость с Даней', () => {
    // Проверяем сброс в начале, до возможной новой просьбы внутри этой ночи.
    let reset = false;
    runStoryDay('petlya', 2, { flags: { d_exit_asked: true }, inspect: (_t, f) => { reset ||= f.d_exit_asked === false; } });
    expect(reset).toBe(true);
  });

  test('объезд заменяет проезд машины сквозь провал старого моста', () => {
    const r = runStoryDay('petlya', 4, { tag: 'bridge_drive' });
    expect(text(r)).toContain('перед въездом');
    expect(text(r)).toContain('через новый мост по указателю объезда');
    expect(text(r)).not.toContain('Вы медленно едете по мосту');
  });

  test.each([false, true])('финальный телефон Миры остаётся у рубильника: crowbar=%s', crowbar => {
    const r = runStoryDay('petlya', 5, { tag: 'lab_up', flags: { has_lom: crowbar, has_dup: true, has_gurov_key: true, has_dir_key: true }, choose: chooseTags('go_early') });
    expect(text(r).includes('забираете лом из багажника')).toBe(crowbar);
    const ending = runStoryDay('petlya', 5, { tag: 'end_tsena' });
    expect(text(ending)).toContain('на полу рядом с ней, у рубильника');
    expect(text(ending)).not.toContain('всё ещё лежит на пульте');
  });

  test.each([false, true])('вечная ночь сохраняет выбранное безопасное место Сони: %s', baba => {
    const r = runStoryDay('petlya', 5, { tag: 'deal_yes', flags: { plan_baba_sonya: baba } });
    expect(text(r)).not.toContain('Соня на соседней крыше');
    expect(text(r).includes('Соня у бабушки')).toBe(baba);
    expect(text(r).includes('Соня снимает звёзды из окна дома')).toBe(!baba);
  });

  test.each([false, true])('личное воспоминание Кости требует его рассказа: %s', heard => {
    const r = runStoryDay('severnoe-siyanie', 5, { tag: 'reunion', flags: { heard_kostya_childhood: heard } });
    expect(r.offered.some(options => options.includes('ru_jump'))).toBe(heard);
  });

  test('полицейский получает оригиналы до сообщения игрока о передаче', () => {
    let handoffSeen = false;
    let reportOfferedAfterHandoff = false;
    const r = runStoryDay('severnoe-siyanie', 5, { tag: 'sting_go', flags: { envelope: true }, inspect: t => {
      handoffSeen ||= t.includes('передаёт оригинал конверта Зелинского');
    }, choose: step => {
      if (step.options.some(o => o.text.includes('Конверт Зелинского у майора'))) reportOfferedAfterHandoff = handoffSeen;
      return undefined;
    } });
    expect(r.flags.envelope).toBe(false);
    expect(r.flags.envelope_police).toBe(true);
    const handoff = r.messages.findIndex(t => t.includes('передаёт оригинал конверта Зелинского'));
    expect(handoff).toBeGreaterThanOrEqual(0);
    expect(reportOfferedAfterHandoff).toBe(true);
  });
});

describe('Отложенные сообщения: повторная проверка приватности и хронологии', () => {
  test.each(['l1_varya', 'l1_stas', 'l1_alla'])('консультация с %s не превращается в «только вы знаете»', person => {
    const r = runStoryDay('otlozhennye', 1, { tag: person, choose: chooseTags('l1_cancel') });
    expect(text(r)).not.toContain('Только вы знаете');
    expect(text(r)).not.toContain('Никто не знает');
    expect(r.flags.l1_cancelled).toBe(true);
  });

  test.each([false, true])('анализ крови используется в защите Аллы только после источника: %s', known => {
    let defense = '';
    const r = runStoryDay('otlozhennye', 1, { tag: 'l1_send', flags: { knows_blood_test: known }, choose: step => {
      defense ||= step.options.find(o => o.goto_tag === 'l1_defend')?.text || '';
      return chooseTags('l1_defend')(step);
    } });
    expect(defense.includes('сдавал кровь')).toBe(known);
    expect(r.flags.knows_blood_test).toBe(true);
    expect(text(r).includes('Сдавал кровь. И что?')).toBe(known);
  });

  test.each([false, true])('Варя не обвиняет скрытое доверенное лицо в отправке: %s', known => {
    const r = runStoryDay('otlozhennye', 2, { tag: 'l2_family', flags: { l2_family: true, varya_knows_keeper: known }, choose: chooseTags('nh_cold') });
    expect(text(r).includes('зачем ты это отправил')).toBe(known);
    expect(text(r).includes('спасибо,')).toBe(known);
    expect(Boolean(r.flags.varya_knows_keeper)).toBe(known);
  });

  test('признание Варе действительно меняет её дальнейшие знания', () => {
    const second = runStoryDay('otlozhennye', 2, { tag: 'l2_family', flags: { l2_family: true }, choose: chooseTags('nh_sorry') });
    expect(second.flags.varya_knows_keeper).toBe(true);
    const fourth = runStoryDay('otlozhennye', 4, { tag: 'vm_refuse', flags: second.flags });
    expect(text(fourth)).toContain('чтобы потом отправить это всем');
  });

  test.each([false, true])('вскрытие: игрок спрашивает факт до причины: %s', known => {
    let questions: string[] = [];
    const r = runStoryDay('otlozhennye', 3, { tag: 'family_day', flags: { knows_no_autopsy: known }, choose: step => {
      if (step.options.some(o => o.goto_tag?.startsWith('fd_autopsy'))) questions = step.options.map(o => o.text);
      return chooseTags('fd_autopsy', 'fd_autopsy_unknown', 'l3_cancel')(step);
    } });
    expect(questions.some(t => t.includes('почему ты попросила'))).toBe(known);
    expect(questions.some(t => t.includes('вскрытие делали'))).toBe(!known);
    expect(r.flags.knows_no_autopsy).toBe(true);
    expect(text(r).includes('Я попросила обойтись без него')).toBe(!known);
  });

  test.each([false, true])('Марина просит управлять письмами только после раскрытия роли: %s', reveal => {
    const r = runStoryDay('otlozhennye', 4, { tag: 'marina_day', choose: chooseTags(reveal ? 'marina_reveal' : 'pre_letter', 'l4_cancel', 'g_end') });
    expect(Boolean(r.flags.marina_knows_keeper)).toBe(reveal);
    expect(text(r).includes('сначала мне. Не в чат')).toBe(reveal);
    expect(Boolean(r.flags.marina_promise)).toBe(reveal);
  });

  test.each([false, true])('Варя не читает очередь игрока без объяснения: %s', reveal => {
    const r = runStoryDay('otlozhennye', 5, { tag: 'n_varya', choose: chooseTags(reveal ? 'nv_reveal' : 'nv_unknown') });
    expect(Boolean(r.flags.varya_knows_keeper)).toBe(reveal);
    expect(text(r).includes('ты можешь посмотреть, кому следующее')).toBe(reveal);
  });

  test.each([[2, 'l2_private'], [3, 'l3_private'], [5, 'l5_private']] as const)(
    'личная доставка №%s объясняет адресату, кто изменил отправку', (day, tag) => {
      const r = runStoryDay('otlozhennye', day, { tag });
      const source = r.messages.findIndex(t => t.includes('Адресаты изменены доверенным лицом'));
      const reply = r.messages.findIndex(t => /Ты мог|Ты прочитал|Ты имеешь право/.test(t));
      expect(source).toBeGreaterThanOrEqual(0);
      expect(reply).toBeGreaterThan(source);
    },
  );

  test.each([false, true])('сделка Стаса не раскрывает ему скрытую роль: %s', known => {
    const r = runStoryDay('otlozhennye', 7, { tag: 'deal_check', flags: { alert: 2, stas_knows_keeper: known }, choose: chooseTags('deal_no') });
    expect(r.offered.some(options => options.includes('deal_yes'))).toBe(known);
  });

  test('успешное следствие не достаёт рецепт из закрытого ящика', () => {
    const r = runStoryDay('otlozhennye', 7, { tag: 'arrest_end', flags: { varya_gift: false } });
    expect(text(r)).toContain('тетрадь ей так и не досталась');
    expect(text(r)).not.toContain('По рецепту из тетради');
  });

  test('целый скрытый маршрут не сообщает семье роль игрока автоматически', () => {
    let flags: Flags = {};
    const path = ['s_hide', 'l1_cancel', 'nq_bye', 'fam_quiet', 'l2_cancel', 'l3_cancel', 'sd_care', 'pre_letter', 'l4_cancel', 'g_end', 'mt_ok', 'l5_cancel', 'nv_unknown', 'st_still_hidden', 'l6_cancel', 'l6_after', 'nc_hide', 'l7_keep', 'acc_none'];
    for (let day = 1; day <= 7; day++) {
      const r = runStoryDay('otlozhennye', day, { flags, choose: chooseTags(...path) });
      flags = r.flags;
      expect(Boolean(flags.varya_knows_keeper)).toBe(false);
      expect(Boolean(flags.marina_knows_keeper)).toBe(false);
      expect(Boolean(flags.stas_knows_keeper)).toBe(false);
      expect(text(r)).not.toContain('ты можешь посмотреть, кому следующее');
      expect(text(r)).not.toContain('сначала мне. Не в чат');
    }
  });
});

describe.each(loadContent().map(story => [story.slug, story] as const))('полные маршруты повторного аудита: %s', (slug, story) => {
  test('новые условия знаний соблюдаются на 500 маршрутах с переносом состояния', () => {
    let checked = 0;
    for (let seed = 1; seed <= 500; seed++) {
      let random = seed >>> 0;
      let flags: Flags = {};
      for (const day of story.days) {
        const r = runStoryDay(slug, day.number, { flags, choose: step => {
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          return step.options[Math.floor((random / 0x100000000) * step.options.length)].id;
        }, inspect: (t, f) => {
          checked++;
          if (slug === 'tihiy-chas' && t.includes('объясняет почему ты сутки')) expect(f.told_day_gap).toBe(true);
          if (slug === 'beliy-shum' && t.includes('я обещал тебе. и себе')) expect(f.tema_calmed).toBe(true);
          if (slug === 'otlozhennye') {
            if (t.includes('ты можешь посмотреть, кому следующее')) expect(f.varya_knows_keeper).toBe(true);
            if (t.includes('зачем ты это отправил')) expect(f.varya_knows_keeper).toBe(true);
            if (t.includes('сначала мне. Не в чат')) expect(f.marina_knows_keeper).toBe(true);
            if (t.includes('Мои десять процентов — тебе')) expect(Boolean(f.stas_knows_keeper || f.stas_knows_murder)).toBe(true);
          }
          if (slug === 'petlya' && t.includes('Он заперт в кабинете, ключ уже у нас')) expect(f.shtern_key_taken).toBe(true);
        } });
        flags = r.flags;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

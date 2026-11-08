import { chooseTags, runStoryDay } from './helpers/story-runner';
import { loadContent } from '../loader';
import type { Flags } from '@/lib/types/database';

describe('Тихий час: знания и присутствие',()=>{
  test('withholding names does not tell Asya that Gleb is among the dead',()=>{
    const r=runStoryDay('tihiy-chas',3,{choose:step=>step.options.find(o=>o.text.includes('Это неважно'))?.id});
    expect(r.messages).not.toContain('глеб тоже');
  });
  test.each([false,true])('sleeping patients cannot open a door or accompany Asya: awake=%s',awake=>{
    const r=runStoryDay('tihiy-chas',4,{tag:'leave_office',flags:{has_key:true,woke_others:awake},choose:chooseTags('no_gleb')});
    expect(r.offered.some(list=>list.includes('delegate'))).toBe(awake);
    expect(r.messages.includes('Лиза и тот мужчина со мной')).toBe(awake);
  });
  test.each([false,true])('an unrevealed fire deadline is not known to Asya: told=%s',told=>{
    const r=runStoryDay('tihiy-chas',4,{tag:'smell',flags:{told_fire_time:told}});
    expect(r.messages.some(t=>t.includes('раньше, чем ты говорил'))).toBe(told);
  });
  test('window escape without waking anyone does not invent Lisa',()=>{
    const r=runStoryDay('tihiy-chas',5,{tag:'window',flags:{trust:5}});
    expect(r.messages.join('\n')).not.toContain('Лиза');
  });
  test('failure after Nina saved Gleb changes the article instead of killing him again',()=>{
    const r=runStoryDay('tihiy-chas',5,{tag:'e_silence',flags:{gleb_alive:true}});
    expect(r.messages.join('\n')).toContain('Глеба Ершова и медсестру успели спасти');
    expect(r.messages.join('\n')).not.toContain('ничего не изменилось');
  });
});

describe('Не спится: эфир и личная переписка', () => {
  test.each([false, true])('город слышит второй вопрос только после эфира: %s', aired => {
    const r = runStoryDay('ne-spitsya', 2, {
      tag: 'q2', choose: chooseTags(aired ? 'q2_read' : 'q2_soft'),
    });
    expect(r.messages.includes('так кто звонил??')).toBe(aired);
    expect(Boolean(r.flags.q2_aired)).toBe(aired);
  });

  test.each([false, true])('до публичной локализации Лиза сама сообщает адрес: %s', known => {
    const r = runStoryDay('ne-spitsya', 4, {
      tag: 'lz_life', flags: { clue_location: known },
    });
    const permission = r.messages.findIndex(t => t.includes('теперь можете сказать в эфире'));
    const broadcast = r.messages.findIndex(t => t.includes('Звонившая назвалась Лизой'));
    expect(permission).toBeGreaterThanOrEqual(0);
    expect(broadcast).toBeGreaterThan(permission);
    expect(r.messages.some(t => t.includes('и если ещё не нашли'))).toBe(!known);
    expect(r.flags.lisa_public).toBe(true);
    expect(r.flags.clue_location).toBe(true);
  });

  test.each([false, true])('вопрос про понедельники требует предшествующего рассказа: %s', known => {
    let specificQuestion = false;
    runStoryDay('ne-spitsya', 4, {
      flags: { gruzdev_mother_seen: known },
      choose: step => {
        if (step.options.some(o => o.goto_tag === 'gp_mother')) {
          specificQuestion = step.options.some(o => o.text.includes('каждый понедельник'));
        }
        return undefined;
      },
    });
    expect(specificQuestion).toBe(known);
  });
});

describe('04:44: память петель и реальные действия', () => {
  test('знакомство с третьим ключом не заменяет его получение в новой петле', () => {
    const r = runStoryDay('petlya', 4, { tag: 'g_key_remembered', flags: { clue_gurov_key: true } });
    expect(r.flags.has_gurov_key).toBe(true);
    expect(r.messages.some(t => t.includes('Гуров роется в жестяной банке'))).toBe(true);
  });

  test.each([false, true])('выбор отвлечения сохраняется даже при наличии ключа Гурова: %s', gurov => {
    const r = runStoryDay('petlya', 5, {
      tag: 'lure', flags: { has_gurov_key: true, plan_lure_gurov: gurov },
    });
    expect(Boolean(r.flags.lured)).toBe(gurov);
    expect(r.messages.includes('Включаю пожарную тревогу')).toBe(!gurov);
  });

  test('Мира, оставшаяся у рубильника, не пишет после гибели', () => {
    const r = runStoryDay('petlya', 5, { tag: 'end_most', flags: { mira_holds: true } });
    expect(r.messages).not.toContain('Солнце');
    expect(r.messages).not.toContain('Тринадцатое августа');
    expect(r.messages.join('\n')).toContain('Её телефон молчит');
  });
});

describe('Северное сияние: предметы, свидетели и время', () => {
  test('не закольцованная камера не превращается в работающую петлю', () => {
    const r = runStoryDay('severnoe-siyanie', 3, { tag: 'countdown', flags: { loop_missed_08: true } });
    expect(r.messages).toContain('Кольцевание активно: камера 07. Камера 08 — прямая трансляция');
    expect(r.messages.some(t => t.startsWith('Кольцевание активно: камеры 07, 08'))).toBe(false);
  });

  test('резервный канал действительно исправляет пропущенную камеру и учитывает задержку', () => {
    const r = runStoryDay('severnoe-siyanie', 3, { tag: 'sv_reroute', flags: { loop_missed_08: true, loop_broken: true } });
    expect(r.flags.loop_missed_08).toBe(false);
    expect(r.flags.loop_broken).toBe(false);
    expect(r.messages.some(t => t.includes('23:58:20 · Резервный запуск'))).toBe(true);
  });

  test('запоздалое свидетельство позволяет исправить ошибочное обвинение и вернуть конверт', () => {
    const r = runStoryDay('severnoe-siyanie', 5, {
      flags: { found_shmel: true, wrong_rat: true, envelope_taken: true, prof_tied: true },
      choose: chooseTags('sh_correct', 'ka_kind', 'pd_env_keep'),
    });
    expect(r.choices).toContain('sh_correct');
    expect(r.flags.rat_found).toBe(true);
    expect(r.flags.wrong_rat).toBe(false);
    expect(r.flags.prof_tied).toBe(false);
    expect(r.flags.envelope_taken).toBe(false);
    expect(r.flags.envelope_copy).toBe(true);
  });

  test('Профессору освобождают руки до работы', () => {
    const r = runStoryDay('severnoe-siyanie', 4, { tag: 'pl_replica', flags: { prof_tied: true } });
    expect(r.flags.prof_tied).toBe(false);
    expect(r.flags.prof_fix_shaky).toBe(true);
    expect(r.messages.join('\n')).toContain('Ника снимает с Профессора стяжки');
  });

  test('поздний рассказ Савельеву отмечает реальное раскрытие обстоятельств', () => {
    const r = runStoryDay('severnoe-siyanie', 5, { tag: 'lt_s_late', flags: { s_knows: true, rat_found: true } });
    expect(r.flags.s_told_heist).toBe(true);
    expect(r.messages.join('\n')).toContain('Ты сказал');
  });

  test('переставленный механизм не работает одновременно в подлиннике и копии', () => {
    const r = runStoryDay('severnoe-siyanie', 5, {
      tag: 'km_end', flags: { prof_fix: true, plan: 'replica', found_shmel: true, rat_found: true },
      choose: chooseTags('pr_shmel'),
    });
    expect(r.flags.real_home).toBe(true);
    expect(r.messages.join('\n')).toContain('Механизм сияния временно в копии');
    expect(r.messages.join('\n')).not.toContain('купол ожил — он перекрестился');
  });

  test('если конверт отобрали, он появляется из кармана Бахрама, а не из пустого тайника', () => {
    const r = runStoryDay('severnoe-siyanie', 5, { tag: 'deliver_moment', flags: { envelope_taken: true } });
    expect(r.messages.join('\n')).toContain('Бахрам выходит с отобранным у Лис конвертом');
    expect(r.messages.some(t => t.startsWith('Внутри — конверт.'))).toBe(false);
  });

  test('переданный Шольцу конверт больше не числится у Лис', () => {
    const r = runStoryDay('severnoe-siyanie', 5, { tag: 'dm_give', flags: { envelope: true, rat_found: true } });
    expect(r.flags.envelope).toBe(false);
    expect(r.messages.join('\n')).not.toContain('конверт у меня. дед просил');
  });

  test('связанный предатель не стреляет при провале подмены: действуют люди Шольца', () => {
    const r = runStoryDay('severnoe-siyanie', 5, { tag: 'rm_caught', flags: { rat_found: true } });
    expect(r.messages.join('\n')).not.toContain('Бахрам выходит из фургона');
    expect(r.messages.join('\n')).toContain('Шольц жестом подзывает людей в пальто');
  });
});

describe('Отложенные сообщения: оставшиеся ссылки на несделанные действия', () => {
  test.each<Flags>([{}, { l2_family: true }, { l1_sent: true }])('вопрос Стаса учитывает публичные письма: %j', flags => {
    const r = runStoryDay('otlozhennye', 6, { flags, choose: chooseTags('st_still_hidden') });
    expect(r.messages.some(t => t.includes('Дед обещал всё рассказать'))).toBe(Boolean('l1_sent' in flags));
    expect(r.messages.some(t => t.includes('Ты разобрал'))).toBe(Object.keys(flags).length === 0);
  });
  test.each([false, true])('Варя ссылается только на настоящее обещание шахмат: %s', promised => {
    const r = runStoryDay('otlozhennye', 2, { tag: 'night', flags: { chess_promised: promised } });
    expect(r.messages.some(t => t.startsWith('как обещал'))).toBe(promised);
  });
  test('за тихим столом семья не знает о непрочитанных ей письмах', () => {
    const r = runStoryDay('otlozhennye', 7, { tag: 'table_quiet', choose: chooseTags('acc_none') });
    expect(r.messages.join('\n')).not.toContain('вы всю неделю читали письма');
  });
});

describe.each(loadContent().map(s => [s.slug, s] as const))('полные маршруты: %s', (slug, story) => {
  test('реплики соблюдают условия знания, присутствия и передачи предметов', () => {
    for (let run = 1; run <= 400; run++) {
      let seed = run;
      let flags: Flags = {};
      for (const day of story.days) {
        const r = runStoryDay(slug, day.number, {
          flags,
          choose: step => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return step.options[Math.floor(seed / 4294967296 * step.options.length)].id;
          },
          inspect: (text, current, step) => {
            const speaker = step.kind === 'message' ? step.scene.meta?.character : null;
            if (slug === 'tihiy-chas' && text === 'глеб тоже') expect(current.told_death_list).toBe(true);
            if (slug === 'tihiy-chas' && text === 'Лиза и тот мужчина со мной') expect(current.woke_others).toBe(true);
            if (slug === 'beliy-shum' && day.number === 7 && speaker === 'mark') expect(current.tema_revenge).toBeFalsy();
            if (slug === 'ne-spitsya' && text === 'так кто звонил??') expect(current.q2_aired).toBe(true);
            if (slug === 'petlya' && day.number === 5 && current.mira_holds && speaker === 'mira' && text === 'Солнце') throw new Error('Dead Mira wrote at dawn');
            if (slug === 'severnoe-siyanie' && text.includes('Бахрам выходит из фургона. Медленно. В руке у него пистолет')) expect(current.rat_found).toBeFalsy();
            if (slug === 'severnoe-siyanie' && text.includes('конверт у меня. дед просил')) expect(current.envelope).toBe(true);
            if (slug === 'severnoe-siyanie' && text.includes('Гоша, выезжай')) expect(current.gosha_tied).toBeFalsy();
          },
        });
        flags = r.flags;
      }
    }
  });
});

describe('Белый шум: частные сведения и финалы',()=>{
  test('leaking location disables the later trace and the attic accusation',()=>{
    const r=runStoryDay('beliy-shum',2,{tag:'geo_check',flags:{clue_location:true,leak_location:true},choose:chooseTags('believe','stay_believe')});
    expect(r.flags.clue_location2).toBeFalsy();
    expect(r.offered.some(list=>list.includes('accuse_attic'))).toBe(false);
  });
  test('a private hint to Mark is not automatically known to Polina',()=>{
    const r=runStoryDay('beliy-shum',4,{tag:'polina_night',flags:{leak_key:true}});
    expect(r.messages.join('\n')).not.toContain('«Запись, как ба… ключ»');
    expect(r.messages.join('\n')).toContain('Она тебе ничего не писала');
  });
  test('Mark cannot attribute a safety vote to a player who only exposed messages',()=>{
    const r=runStoryDay('beliy-shum',4,{tag:'v_lock_silent',flags:{exposed_unknown:true}});
    expect(r.messages.join('\n')).not.toContain('днём сам');
  });
  test('a revenge victim does not continue sending messages before police arrive',()=>{
    const r=runStoryDay('beliy-shum',7,{tag:'lh_mark',flags:{tema_revenge:true,found:true,found_at:5,mark_exposed:true}});
    expect(r.messages.join('\n')).not.toContain('Я знаю, что ты меня ненавидишь');
  });
  test('when searches failed, police must find the body before the transport scene',()=>{
    const r=runStoryDay('beliy-shum',7,{tag:'dawn',flags:{dead:true}});
    expect(r.messages.join('\n')).not.toContain('Я поправила на ней пуховик');
    expect(r.messages.join('\n')).toContain('Спасатели поднимают лодку');
    expect(r.flags.found).toBe(true);
  });
  test('a completed confession preserves the collected truth in the alive ending',()=>{
    const r=runStoryDay('beliy-shum',7,{tag:'e_zhivaya',flags:{anya_truth:true,clue_photo:true}});
    expect(r.messages.join('\n')).not.toMatch(/А у нас нет ничего|я не успела/);
    expect(r.messages.join('\n')).toContain('Фото и показания передадим');
  });
});

describe('Аудит: знания игрока и уже увиденное', () => {
  test.each([false, true])('04:44: про проверку в 09:00 можно сказать Штерну, только если о ней известно: %s', audit => {
    let texts: string[] = [];
    runStoryDay('petlya', 5, {
      tag: 'hall_shtern', flags: { clue_audit: audit },
      choose: step => {
        const talk = step.options.filter(o => o.goto_tag === 'talk_shtern');
        if (talk.length) texts = talk.map(o => o.text);
        return talk[0]?.id;
      },
    });
    expect(texts).toHaveLength(1);
    expect(texts[0].includes('09:00')).toBe(audit);
  });

  test.each([false, true])('04:44: бабушку отправляют за ключом Гурова, только зная о ключе: %s', known => {
    const r = runStoryDay('petlya', 5, { flags: { clue_gurov_key: known } });
    expect(r.offered.some(list => list.includes('baba_gurov'))).toBe(known);
  });

  test.each([false, true])('04:44: без знания о третьем ключе игрок узнаёт о нём из сообщения Штерна: %s', known => {
    const r = runStoryDay('petlya', 5, { tag: 'c_key', flags: { clue_gurov_key: known } });
    expect(r.messages.some(t => t.includes('Ключ старика заберёт'))).toBe(!known);
  });

  test.each([false, true])('04:44: финал «Мост» помнит, погиб ли Даня: %s', died => {
    const r = runStoryDay('petlya', 5, { tag: 'end_most', flags: { dania_died: died } });
    expect(r.messages.some(t => t.includes('Даня не отвечает'))).toBe(died);
    expect(r.messages.some(t => t.includes('Даня уже здесь'))).toBe(!died);
  });

  test('Северное сияние: уже просмотренную камеру банкетного зала не предлагают снова', () => {
    const r = runStoryDay('severnoe-siyanie', 2, { tag: 'k_banquet' });
    expect(r.offered[0]).not.toContain('k_banquet');
  });
});

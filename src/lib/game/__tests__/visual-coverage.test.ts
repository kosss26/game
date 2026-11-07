import fs from 'node:fs';
import path from 'node:path';
import { evidenceText } from '../visual-catalog';
import { CHARACTER_ICONS, CHARACTER_PORTRAITS, storyVisual } from '../story-media';

const root=path.join(process.cwd(),'content/stories');
const stories=fs.readdirSync(root).filter(slug=>fs.existsSync(path.join(root,slug,'story.json')));

test.each(stories)('%s: every published character and photo has an authored visual',slug=>{
  const dir=path.join(root,slug);
  const story=JSON.parse(fs.readFileSync(path.join(dir,'story.json'),'utf8'));
  for(const character of Object.values(story.meta.characters) as Array<{name:string}>) {
    const portrait=CHARACTER_PORTRAITS[character.name];
    expect(portrait || CHARACTER_ICONS[character.name]).toBeTruthy();
    if(portrait)expect(fs.existsSync(path.join(process.cwd(),'public',portrait))).toBe(true);
  }
  for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.story'))) {
    for(const line of fs.readFileSync(path.join(dir,file),'utf8').split('\n').filter(l=>l.includes('[фото]'))) {
      const raw=line.split('[фото]')[1].trim();
      for(const gender of [0,1]) {
        const body=raw.replace(/\{name\}/g,'Александра').replace(/\{([^{}]*\|[^{}]*)\}/g,(_,choice:string)=>choice.split('|')[gender]||'');
        const visual=storyVisual(body);
        expect({slug,file,body,found:!!visual}).toEqual({slug,file,body,found:true});
        if(visual?.kind==='photo')expect(fs.existsSync(path.join(process.cwd(),'public',visual.src))).toBe(true);
      }
    }
  }
});

test('anonymous and system identities remain anonymous',()=>{
  for(const name of ['Неизвестный номер','Слушатель','Хранитель','Цербер','Наталья_К','Сергей1975']) {
    expect(CHARACTER_PORTRAITS[name]).toBeUndefined();
    expect(CHARACTER_ICONS[name]).toBeTruthy();
  }
});
test('repeated boat evidence uses the same image and date',()=>{
  const first=storyVisual("14.07.2017, 01:52. За рулём ты");
  const second=storyVisual("Ночь. Лодка. За рулём Марк, рядом Дима и Кира. 14 7 '17 1:52");
  expect(first?.kind).toBe('photo');
  expect(first?.kind==='photo' && first.src).toBe(second?.kind==='photo' && second.src);
});

test('document typography preserves evidence dates and resolved names',()=>{
  const phone='Старая кнопочная «нокия» на ладони Лис. На экране последнее сообщение: «Встреча в шесть. Все шестеро. Часы — первым. Потом — как договаривались»';
  expect(evidenceText('phone',phone)).toBe('Встреча в шесть. Все шестеро. Часы — первым. Потом — как договаривались');
  const receipt='Пачка аптечных чеков. «Дигоксин». Даты: 28.09, 24.10, 03.11, 11.11';
  expect(evidenceText('receipt',receipt)).toBe(receipt);
  expect(evidenceText('grid','Ниже, ручкой: «14.11. Утром спросить Александру»')).toBe('14.11. Утром спросить Александру');
});

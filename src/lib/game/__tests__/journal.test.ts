import {buildJournal,withLiveJournal,shouldOfferRecap,RECAP_AFTER_MS,recapMemory,lastConfirmedRead,readingStampKey} from '../journal';
import type {JournalSource} from '../journal';
import type {HistoryEntry} from '@/lib/types/database';
const entry=(id:string,text:string,extra:Partial<HistoryEntry>={}):HistoryEntry=>({id,text,at:1,kind:'message',speaker:'npc',character:'a',...extra});
const source=(history:HistoryEntry[],flags={}):JournalSource=>({dayId:'d1',progressId:'p1',number:1,title:'Начало',updatedAt:'',history,flags});
const chars={a:{name:'Ася',bio:'FUTURE BIO'},b:{name:'FUTURE PERSON'}};
const meta={clues:{found:{title:'Ключ',text:'Найденный ключ'},secret:{title:'FUTURE CLUE',text:'SPOILER'}}};

test('uses only actual seen history, earned clues and chosen replies',()=>{
 const view=buildJournal('Story',[source([
  entry('1','Вы открыли дверь',{kind:'system',speaker:'system'}),entry('2','Привет'),
  entry('time','00:44',{kind:'system',speaker:'system'}),
  entry('3','HIDDEN INTERNAL',{hidden:true}),entry('4','[удалено] REMOVED'),
  entry('5','[пересланное Ася] [удалено] REMOVED FORWARDED'),
  entry('reply:s:c','Не отвечать',{kind:'reply',speaker:'me',hidden:true}),
  entry('input:name','Евгений',{kind:'reply',speaker:'me'}),
  entry('6','[фото] Фото улики'),
 ],{clue_found:true})],chars,meta);
 expect(Object.keys(view.people)).toEqual(['a']);expect(view.people.a.character.bio).toBeUndefined();
 expect(view.clues.map(c=>c.id)).toEqual(['found']);expect(view.chapters[0].materials).toHaveLength(1);
 expect(view.chapters[0].events.map(e=>e.text)).toEqual(['Вы открыли дверь']);
 expect(view.chapters[0].decisions.map(e=>e.text)).toEqual(['Не отвечать']);
 expect(JSON.stringify(view)).not.toMatch(/FUTURE|SPOILER|REMOVED|HIDDEN/);
});
test('recap quotes the actual path, not an author summary or alternate answers',()=>{
 const view=buildJournal('Story',[source([entry('1','Лера ответила'),entry('reply:s:c','Я помогу',{kind:'reply',speaker:'me'})])],chars,meta);
 expect(recapMemory(view).messages.map(e=>e.text)).toEqual(['Лера ответила']);
 expect(recapMemory(view).decision?.text).toBe('Я помогу');
});
test('live unsaved read messages join journal; reset runs cannot resurrect old memory',()=>{
 const view=buildJournal('Story',[source([entry('1','Было')])],chars,meta);
 const newer=source([entry('1','Было'),entry('2','Новое событие',{kind:'system'})]);
 expect(withLiveJournal(view,newer,chars,meta).chapters[0].events[0].text).toBe('Новое событие');
 expect(withLiveJournal(view,{...newer,progressId:'other-run'},chars,meta)).toBe(view);
});
test('offers recap after six hours, never for invalid or future timestamps',()=>{
 const now=Date.now();expect(shouldOfferRecap(new Date(now-RECAP_AFTER_MS).toISOString(),now)).toBe(true);
 expect(shouldOfferRecap(new Date(now-1000).toISOString(),now)).toBe(false);
 for(const value of [undefined,null,'invalid',new Date(now+1000).toISOString()])expect(shouldOfferRecap(value,now)).toBe(false);
});

test('notification updates do not count as reading; local stamps are account-scoped',()=>{
 const old='2026-01-01T10:00:00.000Z';
 expect(lastConfirmedRead([old],[entry('1','Seen',{at:Date.parse('2026-01-01T11:00:00Z')})])).toBe('2026-01-01T11:00:00.000Z');
 expect(lastConfirmedRead([],[])).toBeNull();
 expect(readingStampKey('a','story')).not.toBe(readingStampKey('b','story'));
});

test('untrusted history character IDs cannot alter object prototypes',()=>{
 const view=buildJournal('Story',[source([entry('x','PRIVATE',{character:'__proto__'}),entry('y','PRIVATE',{character:'constructor'})])],chars,meta);
 expect(Object.keys(view.people)).toEqual([]);
 expect(Object.prototype.hasOwnProperty.call(Object.prototype,'lastLine')).toBe(false);
});

test('a removed or empty new run cannot be replaced with an old local branch',()=>{
 const old=source([entry('old','Old path')]);
 const removed=buildJournal('Story',[],chars,meta);
 expect(withLiveJournal(removed,old,chars,meta)).toBe(removed);
 const restarted=buildJournal('Story',[{...source([]),progressId:'new-run'}],chars,meta);
 expect(withLiveJournal(restarted,old,chars,meta)).toBe(restarted);
});

test('a stale client payload cannot truncate a fresher confirmed journal',()=>{
 const old=source([entry('1','First')]);
 const saved=buildJournal('Story',[source([entry('1','First'),entry('2','Later')])],chars,meta);
 expect(withLiveJournal(saved,old,chars,meta)).toBe(saved);
});

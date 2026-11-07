import type { Character, Flags, HistoryEntry, StoryMeta } from '@/lib/types/database';

export interface JournalSource { dayId:string; progressId:string; number:number; title:string; history:HistoryEntry[]; flags:Flags; updatedAt:string }
export interface JournalChapter { dayId:string; progressId:string; number:number; title:string; readCount:number; events:HistoryEntry[]; materials:HistoryEntry[]; decisions:HistoryEntry[]; recent:HistoryEntry[] }
export interface JournalPerson { character:Character; firstChapter:number; lastLine?:string }
export interface JournalView { title:string; runs:Record<string,string>; chapters:JournalChapter[]; people:Record<string,JournalPerson>; clues:Array<{id:string;title:string;text:string}> }
export const RECAP_AFTER_MS=6*60*60*1000;
export function shouldOfferRecap(lastPlayedAt?:string|null,now=Date.now()):boolean {
  const at=Date.parse(lastPlayedAt||'');return Number.isFinite(at)&&now>=at&&now-at>=RECAP_AFTER_MS;
}
export function readableMemory(text:string):string { return text.replace(/^(?:\[[^\]]+\]\s*)+/,'').trim(); }
export function visibleMemory(h:HistoryEntry):boolean {
  return !h.hidden && !/(?:^|\]\s*)\[(?:удалено|deleted)(?:\s|\])/i.test(h.text);
}
export function chapterMemory(source:JournalSource):JournalChapter {
  const visible=source.history.filter(visibleMemory);
  return {dayId:source.dayId,progressId:source.progressId,number:source.number,title:source.title,readCount:source.history.length,
    events:visible.filter(h=>h.kind==='system'&&h.text.trim()!=='Перед началом'&&!/^\d{1,2}:\d{2}(?:\s*[·—–-]\s*\d{1,2}:\d{2})?$/.test(h.text.trim())),
    materials:visible.filter(h=>/\[(?:фото|photo|файл|file|гео|геолокация|location|голосовое|voice|камера|cam|звонок|call)(?:\s|\])/i.test(h.text)),
    decisions:source.history.filter(h=>h.kind==='reply'&&h.id.startsWith('reply:')),
    recent:visible.filter(h=>h.speaker==='npc').slice(-3)};
}
function knownPerson(c:Character):Character { return {name:c.name,color:c.color,initials:c.initials,avatar:c.avatar,bot:c.bot}; }
export function buildJournal(title:string,sources:JournalSource[],characters:Record<string,Character>,meta:StoryMeta):JournalView {
  const people:JournalView['people']={};const found=new Set<string>();
  const ordered=[...sources].sort((a,b)=>a.number-b.number);
  for(const source of ordered){
    for(const h of source.history){if(!visibleMemory(h)||h.speaker!=='npc'||!h.character||['__proto__','constructor','prototype'].includes(h.character)||!Object.prototype.hasOwnProperty.call(characters,h.character))continue;
      if(!people[h.character])people[h.character]={character:knownPerson(characters[h.character]),firstChapter:source.number};
      people[h.character].lastLine=readableMemory(h.text).slice(0,180);
    }
    for(const [id,value] of Object.entries(source.flags))if(id.startsWith('clue_')&&value!==false&&value!==0&&value!==''&&value!==undefined)found.add(id.slice(5));
  }
  return {title,runs:Object.fromEntries(ordered.map(s=>[s.dayId,s.progressId])),chapters:ordered.map(chapterMemory).filter(c=>c.events.length||c.materials.length||c.decisions.length||c.recent.length),people,
    clues:Object.entries(meta.clues||{}).filter(([id])=>found.has(id)).map(([id,c])=>({id,title:c.title,text:c.text}))};
}
/** Merge only the currently open run; never resurrect a reset run's local history. */
export function withLiveJournal(saved:JournalView,live:JournalSource,characters:Record<string,Character>,meta:StoryMeta):JournalView {
  if(saved.runs[live.dayId]!==live.progressId)return saved;
  const existing=saved.chapters.find(c=>c.dayId===live.dayId);
  if(existing&&existing.readCount>live.history.length)return saved;
  const current=buildJournal(saved.title,[live],characters,meta);
  const people={...saved.people};for(const [id,p] of Object.entries(current.people))people[id]={...p,firstChapter:people[id]?.firstChapter??p.firstChapter};
  const clues=new Map(saved.clues.map(c=>[c.id,c]));for(const c of current.clues)clues.set(c.id,c);
  return {...saved,chapters:[...saved.chapters.filter(c=>c.dayId!==live.dayId),...current.chapters].sort((a,b)=>a.number-b.number),people,clues:[...clues.values()]};
}
export function recapMemory(view:JournalView) {
  const chapter=view.chapters[view.chapters.length-1];
  return {chapter,events:chapter?.events.slice(-2)||[],messages:chapter?.recent.slice(-2)||[],decision:chapter?.decisions.slice(-1)[0]};
}

export function readingStampKey(userId:string,storyId:string):string { return `pl_last_read:${userId}:${storyId}`; }
/** Notification delivery updates updated_at too; only actual read/finish times count. */
export function lastConfirmedRead(completedAt:Array<string|null>,history:HistoryEntry[]):string|null {
  const times=[...completedAt.map(v=>Date.parse(v||'')),...history.map(h=>h.at)].filter(t=>Number.isFinite(t)&&t>0&&t<8.64e15);
  return times.length?new Date(Math.max(...times)).toISOString():null;
}

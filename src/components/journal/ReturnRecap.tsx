"use client";
import { useEffect, useState } from 'react';
import { useApp, useBackButton } from '@/lib/telegram/TelegramProvider';
import { getStoryJournal } from '@/lib/actions/journal';
import { recapMemory, readableMemory, withLiveJournal, type JournalSource, type JournalView } from '@/lib/game/journal';
import { withTimeout } from '@/lib/utils/with-timeout';
import { dismissPhoto } from '@/lib/utils/modal-scroll';
import type { Character, StoryMeta } from '@/lib/types/database';
import { JournalPanel } from './JournalPanel';

export function ReturnRecap({storyId,title,dayNumber,onContinue,onBack,live,characters,meta}:{storyId:string;title:string;dayNumber:number;onContinue:()=>void;onBack:()=>void;live?:JournalSource;characters:Record<string,Character>;meta:StoryMeta}) {
  const {token}=useApp();const [data,setData]=useState<JournalView|null>(null);const [failed,setFailed]=useState(false);const [journal,setJournal]=useState(false);
  useBackButton(()=>{if(dismissPhoto())return;if(journal)setJournal(false);else onBack()});
  useEffect(()=>{let active=true;withTimeout(getStoryJournal(token,storyId,dayNumber),8000).then(v=>{if(active)setData(live?withLiveJournal(v,live,characters,meta):v)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[token,storyId,dayNumber,live,characters,meta]);
  const recap=data?recapMemory(data):null;
  return <main className="return-recap px-safe pt-safe pb-safe"><div className="return-recap-content">
    <span className="journal-eyebrow">С возвращением</span><h1>Ранее в истории</h1><p className="return-story-title">{title}</p>
    {!data&&!failed&&<p className="journal-empty">Вспоминаем последние события…</p>}
    {failed&&<p className="journal-empty">Не получилось загрузить напоминание. Можно продолжить историю.</p>}
    {recap?.chapter&&<>
      <span className="return-chapter">Глава {recap.chapter.number} · {recap.chapter.title}</span>
      {recap.events.map((h,i)=><blockquote key={`${h.id}:${i}`}>{readableMemory(h.text)}</blockquote>)}
      {recap.messages.map((h,i)=><div className="return-message" key={`${h.id}:${i}`}><small>{data?.people[h.character||'']?.character.name||'Из переписки'}</small><p>{readableMemory(h.text).slice(0,360)}{readableMemory(h.text).length>360?'…':''}</p></div>)}
      {recap.decision&&<div className="return-decision"><small>{recap.decision.hidden?'Вы решили':'Ваш последний ответ'}</small><p>«{recap.decision.text}»</p></div>}
    </>}
    {data&&!recap?.chapter&&<p className="journal-empty">Вы готовы продолжить историю.</p>}
    <div className="return-actions"><button className="btn-primary w-full" onClick={onContinue}>Продолжить историю</button><button className="library-secondary" onClick={()=>setJournal(true)}>Открыть журнал</button><p>Можно сразу продолжить — напоминание необязательно</p></div>
  </div>{journal&&<JournalPanel storyId={storyId} throughDay={dayNumber} onClose={()=>setJournal(false)} live={live} characters={characters} meta={meta}/>}</main>;
}

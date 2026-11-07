"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStoryJournal } from '@/lib/actions/journal';
import { withLiveJournal, readableMemory, type JournalSource, type JournalView } from '@/lib/game/journal';
import type { Character, StoryMeta } from '@/lib/types/database';
import { useApp } from '@/lib/telegram/TelegramProvider';
import { withTimeout } from '@/lib/utils/with-timeout';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar } from '@/components/ui/Avatar';
import { MessageList } from '@/components/chat/Messages';

export function JournalPanel({storyId,throughDay,onClose,live,characters={},meta={}}:{storyId:string;throughDay?:number;onClose:()=>void;live?:JournalSource;characters?:Record<string,Character>;meta?:StoryMeta}) {
  const {token}=useApp();const [data,setData]=useState<JournalView|null>(null);const [failed,setFailed]=useState(false);
  const [tab,setTab]=useState('events');const [limit,setLimit]=useState(40);const request=useRef(0);
  const load=useCallback(()=>{const id=++request.current;setFailed(false);withTimeout(getStoryJournal(token,storyId,throughDay),8000).then(v=>{if(request.current===id)setData(v)}).catch(()=>{if(request.current===id)setFailed(true)});},[token,storyId,throughDay]);
  useEffect(()=>{const requests=request;load();return()=>{requests.current++}},[load]);
  const view=useMemo(()=>data&&live?withLiveJournal(data,live,characters,meta):data,[data,live,characters,meta]);
  const entries=view?.chapters.flatMap(c=>(tab==='events'?c.events:tab==='decisions'?c.decisions:c.materials).map(entry=>({entry,chapter:c.number}))).reverse()||[];
  const knownCharacters=Object.fromEntries(Object.entries(view?.people||{}).map(([id,p])=>[id,p.character]));
  return <Sheet label="Журнал истории" onClose={onClose}><div className="journal-panel">
    <header className="journal-header"><div><span className="journal-eyebrow">Ваше прохождение</span><h2>Журнал истории</h2><p>{view?.title||'Всё, что вы уже знаете'}</p></div><button type="button" onClick={onClose} aria-label="Закрыть журнал">✕</button></header>
    <div className="journal-tabs" role="group" aria-label="Раздел журнала">{[['events','События'],['materials','Материалы'],['people','Персонажи'],['decisions','Решения']].map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>{setTab(id);setLimit(40)}}>{label}</button>)}</div>
    <div className="journal-body" aria-live="polite">
      {!view&&!failed&&<p className="journal-empty">Открываем ваши записи…</p>}
      {failed&&<div role="alert" className="journal-empty">Не получилось открыть журнал. <button onClick={load}>Повторить</button></div>}
      {view&&<>
        {tab==='people'?Object.keys(view.people).length?Object.entries(view.people).map(([id,p])=><article className="journal-person" key={id}><Avatar id={id} character={p.character} size={48}/><div><h3>{p.character.name}</h3><small>Впервые в главе {p.firstChapter}</small>{p.lastLine&&<p>«{p.lastLine}»</p>}</div></article>):<p className="journal-empty">Здесь появятся собеседники, которые уже писали вам.</p>:<>
          {tab==='materials'&&view.clues.length>0&&<section className="journal-clues"><h3>Найденные улики</h3>{view.clues.map(c=><article className="journal-entry" key={c.id}><h4>{c.title}</h4><p>{c.text}</p></article>)}</section>}
          {entries.length===0&&!(tab==='materials'&&view.clues.length)&&<p className="journal-empty">{tab==='decisions'?'Ваши решения появятся здесь после первых выборов.':tab==='materials'?'Здесь будут найденные улики, документы и вложения.':'События появятся по мере прохождения истории.'}</p>}
          {entries.slice(0,limit).map(({entry,chapter},i)=><article className="journal-entry" key={`${entry.id}:${i}`}><small>Глава {chapter}{tab==='decisions'?(entry.hidden?' · Вы решили':' · Вы ответили'):''}</small>{tab==='materials'?<MessageList entries={[entry]} characters={knownCharacters} multiParty={false} defaultCharacter={entry.character||'npc'} animateFrom={1}/>:<p>{readableMemory(entry.text)}</p>}</article>)}
          {entries.length>limit&&<button className="library-secondary" onClick={()=>setLimit(n=>n+40)}>Показать ещё</button>}
        </>}
      </>}
    </div>
    <footer className="journal-footer">Только события и материалы вашего прохождения</footer>
  </div></Sheet>;
}

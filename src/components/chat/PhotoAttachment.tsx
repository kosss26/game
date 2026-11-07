"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DocumentEvidence } from "./DocumentEvidence";
import { storyVisual } from '@/lib/game/story-media';

export function PhotoAttachment({body, source}: {body:string; source?:string}) {
  const visual = storyVisual(body, source);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if (!open) return;
    const returnFocus = trigger.current;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return ()=>{ document.body.style.overflow = previous; returnFocus?.focus(); };
  },[open]);
  if (!visual || failed) return <div className="photo-description"><span>Фотография</span><p>{body}</p></div>;
  return <figure className="story-photo">
    <button type="button" ref={trigger} onClick={()=>setOpen(true)} aria-label="Открыть фотографию">{visual.kind === 'photo' ? <><Image unoptimized width={visual.width || 600} height={visual.height || 800} src={visual.src} alt={body || 'Фотография из переписки'} loading="lazy" onError={()=>setFailed(true)}/>{visual.stamp && <span className="evidence-stamp">{visual.stamp}</span>}{visual.greeting && <span className="evidence-greeting">{visual.greeting}</span>}</> : <DocumentEvidence visual={visual} body={body}/>}<span>Открыть фото ↗</span></button>
    {visual.kind === "photo" && visual.fragment && <small className="evidence-fragment">Иллюстрация сцены</small>}
    {body && <figcaption>{body}</figcaption>}
    {open && createPortal(<dialog ref={dialog} className="photo-viewer" aria-label="Фотография из переписки" onCancel={()=>setOpen(false)} onClick={e=>{if(e.target === e.currentTarget)setOpen(false)}}>
      <button type="button" className="photo-close" autoFocus onClick={()=>setOpen(false)} aria-label="Закрыть фотографию">✕</button>
      {visual.kind === 'photo' ? <div className="evidence-full-photo"><Image unoptimized width={visual.width || 600} height={visual.height || 800} src={visual.src} alt={body || 'Фотография из переписки'}/>{visual.stamp && <span className="evidence-stamp">{visual.stamp}</span>}{visual.greeting && <span className="evidence-greeting">{visual.greeting}</span>}</div> : <DocumentEvidence visual={visual} body={body}/>}<p>{body}</p>
    </dialog>,document.body)}
  </figure>;
}

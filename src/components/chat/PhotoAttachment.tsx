"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { storyPhoto } from '@/lib/game/story-media';

export function PhotoAttachment({body, source}: {body:string; source?:string}) {
  const src = storyPhoto(body, source);
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
  if (!src || failed) return <div className="photo-description"><span>Фотография</span><p>{body}</p></div>;
  return <figure className="story-photo">
    <button type="button" ref={trigger} onClick={()=>setOpen(true)} aria-label="Открыть фотографию"><Image unoptimized width={600} height={800} src={src} alt={body || 'Фотография из переписки'} loading="lazy" onError={()=>setFailed(true)}/><span>Открыть фото ↗</span></button>
    {body && <figcaption>{body}</figcaption>}
    {open && createPortal(<dialog ref={dialog} className="photo-viewer" aria-label="Фотография из переписки" onCancel={()=>setOpen(false)} onClick={e=>{if(e.target === e.currentTarget)setOpen(false)}}>
      <button type="button" className="photo-close" autoFocus onClick={()=>setOpen(false)} aria-label="Закрыть фотографию">✕</button>
      <Image unoptimized width={600} height={800} src={src} alt={body || 'Фотография из переписки'}/><p>{body}</p>
    </dialog>,document.body)}
  </figure>;
}

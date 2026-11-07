"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native modal: focus containment, Escape, backdrop dismissal, focus restore. */
export function Sheet({label, onClose, children}: {label:string; onClose:()=>void; children:ReactNode}) {
  const [mounted,setMounted] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(()=>setMounted(true),[]);
  useEffect(()=>{
    if (!mounted) return;
    const focus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow='hidden';
    ref.current?.showModal();
    return ()=>{ document.body.style.overflow=previous; focus?.focus(); };
  },[mounted]);
  if (!mounted) return null;
  return createPortal(<dialog ref={ref} tabIndex={-1} autoFocus className="game-sheet" aria-label={label} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>{children}</dialog>,document.body);
}

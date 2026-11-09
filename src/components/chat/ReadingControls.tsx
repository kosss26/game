"use client";
import { useApp } from '@/lib/telegram/TelegramProvider';

export function ReadingControls() {
  const {textSize, setTextSize, reducedMotion, setReducedMotion} = useApp();
  return <section className="reading-controls" aria-label="Комфорт чтения">
    <h3>Размер текста</h3>
    <div role="group" aria-label="Размер текста" className="reading-size-options">
      {([['normal','Обычный'],['large','Крупный'],['larger','Ещё крупнее']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={textSize === value} onClick={()=>setTextSize(value)}>{label}</button>)}
    </div>
    <p className="reading-sample" aria-label="Пример сообщения"><small>Пример</small><span>Кто-то уже набирает сообщение…</span></p>
    <label className="reading-motion"><span>Меньше анимаций<small>Без движения сообщений и появления панелей</small></span><input type="checkbox" role="switch" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/></label>
  </section>;
}

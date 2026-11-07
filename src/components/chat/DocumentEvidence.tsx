import { evidenceText, type StoryVisual } from '@/lib/game/visual-catalog';

const pieces: Record<string,string> = {g1:'♔',d4:'♕',a1:'♖',h1:'♖',g2:'♙',h2:'♙',f2:'♙',a2:'♙',b2:'♙',e8:'♚',g7:'♝',a8:'♜',h8:'♜',g6:'♟',h7:'♟',a7:'♟',b7:'♟'};
export function DocumentEvidence({visual,body}: {visual: Exclude<StoryVisual,{kind:'photo'}>; body:string}) {
  if(visual.kind==='chess') return <div className="chess-evidence" role="img" aria-label={body}>
    <div className="evidence-chess-board" aria-hidden="true">{Array.from({length:64},(_,i)=>{const file='abcdefgh'[i%8];const rank=8-Math.floor(i/8);return <span key={i} className={(i+Math.floor(i/8))%2?'dark-square':''}>{pieces[file+rank] ? pieces[file+rank]+'\uFE0E' : ''}</span>})}</div>
    <svg className="chess-glasses" viewBox="0 0 150 45" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="3"><ellipse cx="36" cy="23" rx="27" ry="18"/><ellipse cx="113" cy="23" rx="27" ry="18"/><path d="M63 21Q75 10 86 21M9 20L2 5M140 20L148 5"/></g></svg>
    <span>Ход белых</span>
  </div>;
  const text=evidenceText(visual.theme,body);
  return <div className={`evidence-document evidence-${visual.theme}`}>
    <span className="evidence-document-title">{visual.title}</span>
    <p>{text}</p>
    <span className="evidence-document-footer">{visual.theme==='phone'?'Сообщение сохранено': 'Материал из переписки'}</span>
  </div>;
}

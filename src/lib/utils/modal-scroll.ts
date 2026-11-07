let locks=0;let previous='';
export function lockPageScroll():()=>void {
  if(locks===0)previous=document.body.style.overflow;
  locks++;document.body.style.overflow='hidden';let released=false;
  return ()=>{if(released)return;released=true;locks=Math.max(0,locks-1);if(locks===0)document.body.style.overflow=previous;};
}
export function dismissPhoto():boolean {
  const photo=document.querySelector<HTMLDialogElement>('.photo-viewer[open]');
  if(!photo)return false;photo.dispatchEvent(new Event('cancel',{cancelable:true}));return true;
}

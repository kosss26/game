"use server";
import { db } from '@/lib/supabase/server';
import { resolveUser } from '@/lib/auth/session';
import { isUuid } from '@/lib/game/purchases';
import { buildJournal, visibleMemory, type JournalView } from '@/lib/game/journal';
import type { Flags, HistoryEntry, StoryMeta, SnapshotData } from '@/lib/types/database';

export async function getStoryJournal(token:string|null,storyId:string,throughDay?:number):Promise<JournalView> {
  if(!isUuid(storyId)||(throughDay!==undefined&&(!Number.isInteger(throughDay)||throughDay<1)))throw new Error('Invalid story');
  const user=await resolveUser(token);if(!user)throw new Error('Sign in required');
  const client=await db();
  const [storyResult,dayResult,progressResult]=await Promise.all([
    client.from('stories').select('title, meta, status').eq('id',storyId).maybeSingle(),
    client.from('days').select('id, day_number, title').eq('story_id',storyId),
    client.from('progresses').select('id, day_id, history, flags, updated_at, snapshot_version').eq('user_id',user.id).eq('story_id',storyId),
  ]);
  if(storyResult.error||dayResult.error||progressResult.error||!storyResult.data)throw new Error('Journal unavailable');
  if(storyResult.data.status!=="published"&&!progressResult.data?.length)throw new Error("Journal unavailable");
  const days=new Map((dayResult.data as Array<{id:string;day_number:number;title:string}>||[]).filter(d=>throughDay===undefined||d.day_number<=throughDay).map(d=>[d.id,d]));
  const sources=(progressResult.data as Array<{id:string;day_id:string;history:HistoryEntry[];flags:Flags;updated_at:string;snapshot_version?:number}>||[]).flatMap(p=>{
    const day=days.get(p.day_id);return day?[{dayId:day.id,progressId:p.id,number:day.day_number,title:day.title,history:p.history||[],flags:p.flags||{},updatedAt:p.updated_at}]:[];
  });
  const meta=(storyResult.data.meta||{}) as StoryMeta;
  const characters={...(meta.characters||{})};
  for(const p of (progressResult.data||[]) as Array<{day_id:string;snapshot_version?:number;history?:HistoryEntry[]}>) {
    if(!days.has(p.day_id)||!p.snapshot_version||!(p.history||[]).some(h=>visibleMemory(h)&&h.character&&!characters[h.character]))continue;
    const {data:snap}=await client.from('snapshots').select('snapshot_json').eq('day_id',p.day_id).eq('version',p.snapshot_version).maybeSingle();
    const defined=(snap?.snapshot_json as SnapshotData|undefined)?.day?.meta?.characters||{};
    for(const h of p.history||[])if(visibleMemory(h)&&h.character&&Object.prototype.hasOwnProperty.call(defined,h.character))characters[h.character]=defined[h.character];
  }
  return buildJournal(storyResult.data.title,sources,characters,meta);
}

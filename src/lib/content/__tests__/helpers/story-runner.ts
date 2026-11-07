import { loadContent } from '../../loader';
import { parseDayScript } from '../../importer';
import { convertToDbFormat } from '@/lib/parser/dsl-parser';
import { buildRuntime, resolve, applyChoice, applyInput, nextAfter, type Runtime, type Step } from '@/lib/engine/runtime';
import type { Flags, SnapshotData } from '@/lib/types/database';

const stories=loadContent();
const cache=new Map<string,Runtime>();
export function storyRuntime(slug:string,day:number):Runtime {
  const key=`${slug}:${day}`;const cached=cache.get(key);if(cached)return cached;
  const story=stories.find(s=>s.slug===slug);if(!story)throw new Error(`Missing story ${slug}`);
  const script=story.days.find(d=>d.number===day)?.script;if(!script)throw new Error(`Missing day ${key}`);
  const parsed=parseDayScript(script,story.meta.characters,story.meta.chats);
  if(parsed.errors.length)throw new Error(`${key}: ${JSON.stringify(parsed.errors)}`);
  const db=convertToDbFormat(parsed);
  const rt=buildRuntime({
    day:{story_id:slug,day_number:day,title:'',unlock_at:null,estimated_minutes:null,status:'published',meta:null},
    scenes:db.scenes.map((s,i)=>({...s,id:`s${i}`,sort_index:i,speaker:s.speaker??null,text:s.text??null,meta:s.meta??null,next_scene_id:null,tag:s.tag??null})),
    choices:db.choices.map((c,i)=>({...c,id:`c${i}`,scene_id:`s${c.scene_index}`,goto_scene_id:null,set_flags:c.set_flags??null,condition:c.condition??null})),
  } as SnapshotData);
  cache.set(key,rt);return rt;
}
type ChoiceStep=Extract<Step,{kind:'choice'}>;
export const chooseTags=(...tags:string[])=>(step:ChoiceStep)=>tags.find(tag=>step.options.some(o=>o.goto_tag===tag||o.id===tag));
export function runStoryDay(slug:string,day:number,options:{flags?:Flags;tag?:string;choose?:(step:ChoiceStep)=>string|undefined;inspect?:(text:string,flags:Flags,step:Step)=>void}={}) {
  const rt=storyRuntime(slug,day);let flags={...options.flags};
  if(options.tag&&!rt.indexByTag.has(options.tag))throw new Error(`Missing tag ${options.tag}`);
  let pointer=options.tag?rt.scenes[rt.indexByTag.get(options.tag)!].id:rt.firstSceneId;
  const messages:string[]=[];const choices:string[]=[];const offered:string[][]=[];
  for(let guard=0;guard<5000;guard++) {
    const result=resolve(rt,pointer,flags);flags=result.flags;const step=result.step;
    if(step.kind==='end')return {flags,messages,choices,offered,ending:step.ending};
    if(step.kind==='choice') {
      offered.push(step.options.map(o=>o.goto_tag||o.text));
      const target=options.choose?.(step);
      const option=target?step.options.find(o=>o.id===target||o.goto_tag===target):step.options[0];
      if(!option)throw new Error(`Missing option ${target}`);
      choices.push(option.goto_tag||option.text);({pointer,flags}=applyChoice(rt,step.scene.id,option,flags));
    } else if(step.kind==='input')({pointer,flags}=applyInput(rt,step.scene.id,step.key,'Женя',flags));
    else {if(step.kind==='message'){messages.push(step.text);options.inspect?.(step.text,flags,step);}pointer=nextAfter(rt,step.scene.id);}
  }
  throw new Error(`${slug}/${day} did not terminate`);
}

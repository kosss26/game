import {getStoryJournal} from '../journal';
import {resolveUser} from '@/lib/auth/session';
import {db} from '@/lib/supabase/server';
jest.mock('@/lib/auth/session',()=>({resolveUser:jest.fn()}));
jest.mock('@/lib/supabase/server',()=>({db:jest.fn()}));
const storyId='12345678-1234-4234-8234-123456789012';
const authorize=jest.mocked(resolveUser);const database=jest.mocked(db);
beforeEach(()=>jest.clearAllMocks());
test('requires authentication before reading journal data',async()=>{
 authorize.mockResolvedValue(null);await expect(getStoryJournal(null,storyId)).rejects.toThrow('Sign in');expect(database).not.toHaveBeenCalled();
});
test('scopes histories to the signed-in user and requested chapter boundary',async()=>{
 authorize.mockResolvedValue({id:'owner'} as NonNullable<Awaited<ReturnType<typeof resolveUser>>>);
 const tables:Record<string,Array<Record<string,unknown>>>={stories:[{id:storyId,title:'Story',status:'published',meta:{characters:{a:{name:'Ася'},future:{name:'FUTURE PERSON'}}}}],days:[{id:'d1',story_id:storyId,day_number:1,title:'One'},{id:'d2',story_id:storyId,day_number:2,title:'Two'}],progresses:[
  {id:'p1',user_id:'owner',story_id:storyId,day_id:'d1',history:[{id:'e1',text:'Seen',kind:'message',speaker:'npc',character:'a',at:1}],flags:{}},
  {id:'p2',user_id:'owner',story_id:storyId,day_id:'d2',history:[{id:'e2',text:'FUTURE CHAPTER',kind:'message',speaker:'npc',character:'future',at:2}],flags:{}},
  {id:'p3',user_id:'other',story_id:storyId,day_id:'d1',history:[{id:'e3',text:'OTHER USER SECRET',kind:'system',speaker:'system',at:3}],flags:{}},
 ]};
 database.mockResolvedValue({from:(table:string)=>{let rows=tables[table];const q={select:()=>q,eq:(key:string,value:unknown)=>{rows=rows.filter(r=>r[key]===value);return q},maybeSingle:()=>Promise.resolve({data:rows[0],error:null}),then:(done:(v:unknown)=>unknown)=>Promise.resolve({data:rows,error:null}).then(done)};return q}} as unknown as Awaited<ReturnType<typeof db>>);
 const result=await getStoryJournal('signed',storyId,1);expect(result.chapters).toHaveLength(1);expect(result.chapters[0].recent[0].text).toBe('Seen');expect(JSON.stringify(result)).not.toMatch(/FUTURE|OTHER USER/);
});

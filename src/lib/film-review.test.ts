import {describe,it,expect} from 'vitest';
import {selectedShotVersion} from './film-review';
const version=(id:string)=>({id,scene_id:'shot',scene_revision:1,operation:'animate',status:'completed',result_url:`saved/${id}.mp4`});
describe('film review version selection',()=>{
 it('uses an earlier paid version rather than the newest on reassembly',()=>{expect(selectedShotVersion({id:'shot',revision:1,selected_attempt_id:'old'},[version('new'),version('old')])?.result_url).toBe('saved/old.mp4');});
 it('never uses another shot or failed output',()=>{expect(selectedShotVersion({id:'shot',revision:1,selected_attempt_id:'wrong'},[{...version('wrong'),scene_id:'other'},{...version('failed'),status:'failed'},version('valid')])?.id).toBe('valid');});
 it('keeps revision-bound approval intact',()=>{expect(selectedShotVersion({id:'shot',revision:2,selected_attempt_id:'old'},[version('old')])).toBeUndefined();});
});
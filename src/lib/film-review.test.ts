import {describe,it,expect} from 'vitest';
import {selectedShotVersion,changesShotAppearance,shotReviewInstruction,CHARACTER_CONTINUITY} from './film-review';
const version=(id:string)=>({id,scene_id:'shot',scene_revision:1,operation:'animate',status:'completed',result_url:`saved/${id}.mp4`});
describe('film review version selection',()=>{
 it('uses an earlier paid version rather than the newest on reassembly',()=>{expect(selectedShotVersion({id:'shot',revision:1,selected_attempt_id:'old'},[version('new'),version('old')])?.result_url).toBe('saved/old.mp4');});
 it('never uses another shot or failed output',()=>{expect(selectedShotVersion({id:'shot',revision:1,selected_attempt_id:'wrong'},[{...version('wrong'),scene_id:'other'},{...version('failed'),status:'failed'},version('valid')])?.id).toBe('valid');});
 it('keeps revision-bound approval intact',()=>{expect(selectedShotVersion({id:'shot',revision:2,selected_attempt_id:'old'},[version('old')])).toBeUndefined();});
});
describe('shot appearance continuity',()=>{
 it('routes vitiligo edits through still review',()=>{expect(changesShotAppearance('Give her vitiligo')).toBe(true);});
 it('routes hair and outfit edits through still review',()=>{expect(changesShotAppearance('Red bikini and blond dreadlocks')).toBe(true);});
 it('keeps motion-only edits on the animation path',()=>{expect(changesShotAppearance('Slow the camera push')).toBe(false);});
 it('uses the current saved appearance instruction',()=>{expect(shotReviewInstruction({revision:3,review_history:[{revision:2,instruction:'old'},{revision:3,instruction:'Add vitiligo'}]})).toBe('Add vitiligo');});
 it('does not reuse a previous revision instruction',()=>{expect(shotReviewInstruction({revision:4,review_history:[{revision:3,instruction:'old'}]})).toBe('');});
 it('defines pigmentation as constant from the opening frame',()=>{expect(CHARACTER_CONTINUITY).toContain('Pigmentation is present from frame one');});
});
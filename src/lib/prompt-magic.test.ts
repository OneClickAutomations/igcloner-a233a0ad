import { describe,it,expect } from 'vitest';
import { formatMagicPrompt, requestedPromptChanges, PROMPT_MAGIC_COST } from './prompt-magic';
import { changesShotAppearance } from './film-review';
const prompt={requested_changes:'Make the lift smoother',subject_continuity:'Keep skin, hair and outfit stable',texture_and_lighting:'Natural pores',action_timeline:'Continuous lift',camera:'Static',physics:'Rigid barbell',avoid:'Morphing'};
describe('Studio prompt enhancement',()=>{
  it('shows one plan credit per enhancement',()=>expect(PROMPT_MAGIC_COST).toBe(1));
  for(const format of ['regular','json'] as const){
    it(`${format} guidance does not falsely flag appearance changes`,()=>{
      const text=formatMagicPrompt(prompt,format);
      expect(requestedPromptChanges(text)).toBe('Make the lift smoother');
      expect(changesShotAppearance(text)).toBe(false);
    });
    it(`${format} retains actual appearance edits for the new-still path`,()=>{
      expect(changesShotAppearance(formatMagicPrompt({...prompt,requested_changes:'Add light pigmentation patches'},format))).toBe(true);
    });
  }
});
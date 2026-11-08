export const PROOF_NARRATION = 'Some days, I just need to get outside. A quiet morning, a packed bag, a pause by the water, and a view worth stopping for. This is Summit Bottle, coming along for the little moments that make the day feel bigger.';
export const PROOF_VOICE = { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris' };
export function alignmentCaptions(alignment: {characters:string[];character_start_times_seconds:number[];character_end_times_seconds:number[]}, duration:number) {
  const captions:{start:number;end:number;text:string}[]=[];let text='',start=0,end=0;
  alignment.characters.forEach((char,i)=>{if(!text)start=alignment.character_start_times_seconds[i];text+=char;end=alignment.character_end_times_seconds[i];if((/[.!?,]/.test(char)||text.trim().split(/\s+/).length>=6&&char===' ')&&text.trim()){captions.push({start,end,text:text.trim()});text='';}});
  if(text.trim())captions.push({start,end,text:text.trim()});
  if(!captions.length||captions.some(c=>!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.end>duration||c.end<=c.start))throw new Error('Narration timing does not fit the film.');
  return captions;
}
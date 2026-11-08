export const PROOF_NARRATION = 'Some days, I just need to get outside. A quiet morning, a packed bag, a pause by the water, and a view worth stopping for. This is Summit Bottle, coming along for the little moments that make the day feel bigger.';
export const PROOF_VOICE = { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris' };
export const NARRATION_TIMING_VERSION = 2;
export const countSpokenWords = (text:string) => text.trim().split(/\s+/).filter(Boolean).length;
export function measuredSpeakingRate(script:string, seconds:number) {
  if(!Number.isFinite(seconds)||seconds<=0)throw new Error('Measured narration duration must be positive.');
  return countSpokenWords(script)/seconds;
}
export function narrationWordTarget(filmSeconds:number, wordsPerSecond:number) {
  if(!Number.isFinite(filmSeconds)||filmSeconds<=0||!Number.isFinite(wordsPerSecond)||wordsPerSecond<=0)throw new Error('Film duration and measured speaking rate must be positive.');
  return Math.round(filmSeconds*wordsPerSecond*0.95);
}
export function narrationFits(audioSeconds:number,filmSeconds:number) {
  return Number.isFinite(audioSeconds)&&audioSeconds>=filmSeconds*0.9&&audioSeconds<=filmSeconds;
}
/** Read real MP3 frame durations, not the final character timestamp (which excludes trailing audio). */
export function mp3Duration(bytes:Uint8Array) {
  let i=0,total=0,frames=0;
  if(String.fromCharCode(...bytes.slice(0,3))==='ID3')i=10+((bytes[6]&127)*2097152+(bytes[7]&127)*16384+(bytes[8]&127)*128+(bytes[9]&127));
  while(i+4<=bytes.length){
    if(bytes[i]!==255||(bytes[i+1]&224)!==224){i++;continue;}
    const version=(bytes[i+1]>>3)&3,layer=(bytes[i+1]>>1)&3,bitrateIndex=bytes[i+2]>>4,sampleIndex=(bytes[i+2]>>2)&3;
    if(version===1||layer!==1||bitrateIndex===0||bitrateIndex===15||sampleIndex===3){i++;continue;}
    const rate=[44100,48000,32000][sampleIndex]/(version===3?1:version===2?2:4);
    const kbps=(version===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bitrateIndex];
    const size=Math.floor((version===3?144:72)*kbps*1000/rate)+((bytes[i+2]>>1)&1);
    if(i+size>bytes.length)break;
    total+=(version===3?1152:576)/rate;frames++;i+=size;
  }
  if(!frames)throw new Error('Narration MP3 duration could not be verified.');
  return total;
}
export function alignmentCaptions(alignment: {characters:string[];character_start_times_seconds:number[];character_end_times_seconds:number[]}, duration:number) {
  const captions:{start:number;end:number;text:string}[]=[];let text='',start=0,end=0;
  alignment.characters.forEach((char,i)=>{if(!text)start=alignment.character_start_times_seconds[i];text+=char;end=alignment.character_end_times_seconds[i];if((/[.!?,]/.test(char)||text.trim().split(/\s+/).length>=6&&char===' ')&&text.trim()){captions.push({start,end,text:text.trim()});text='';}});
  if(text.trim())captions.push({start,end,text:text.trim()});
  // Never refuse: speech running past the film is clipped to the film; captions follow it.
  return captions.filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start<duration)
    .map(c=>({...c,end:Math.min(c.end,duration)})).filter(c=>c.end>c.start);
}
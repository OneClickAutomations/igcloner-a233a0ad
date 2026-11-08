import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {PROOF_NARRATION,PROOF_VOICE,alignmentCaptions,measuredSpeakingRate,narrationWordTarget,narrationFits,mp3Duration,countSpokenWords,NARRATION_TIMING_VERSION} from './film-narration';
export const generateProofNarration=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({projectId:z.string().uuid(),requestKey:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
  const {data:p}=await context.supabase.from('video_inspiration_projects').select('id,observation_notes').eq('id',data.projectId).eq('user_id',context.userId).single();
  if(!p)throw new Error('Film not found.');
  const isProof=(p.observation_notes as string[]).includes('owner-authorized-phase1-proof-16s');
  const {STUDIO_PRICING}=await import('./studio-pricing');
  const billed=isProof?0:STUDIO_PRICING.video.narrationCredits;
  const key=process.env['ELEVENLABS_API_KEY'];if(!key)throw new Error('ElevenLabs is not configured.');
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const {data:existing}=await context.supabase.from('film_narration_attempts').select('*').eq('project_id',p.id).eq('status','completed').order('created_at',{ascending:false}).limit(1);
  const {data:scenes,error:sceneError}=await context.supabase.from('storyboard_scenes').select('duration,scene_input,scene_order').eq('project_id',p.id).order('scene_order');
  if(sceneError||!scenes?.length)throw new Error('Film scenes could not be read.');
  const filmSeconds=scenes.reduce((sum,s)=>sum+Number(s.duration),0);
  const previous=existing?.[0];
  const previousUsage=previous?.usage&&typeof previous.usage==='object'&&!Array.isArray(previous.usage)?previous.usage:{};
  if(previous)return previous;
  const {data:claim,error}=await db.rpc('claim_film_narration',{p_user:context.userId,p_project:p.id,p_request:data.requestKey,p_script:PROOF_NARRATION,p_voice:PROOF_VOICE.id,p_billed:billed,p_usd:billed*STUDIO_PRICING.video.unitCostUsd});if(error)throw new Error(/Insufficient video credits/.test(error.message)?'You need video credits to generate narration. Nothing was charged.':error.message);const c=claim as any;if(c.existing)throw new Error('Narration already started. Do not duplicate the provider call.');
  const subscription=async()=>{const r=await fetch('https://api.elevenlabs.io/v1/user/subscription',{headers:{'xi-api-key':key}});return r.ok?await r.json() as any:null;};
  const before=await subscription();const started=Date.now();
  try{
    const {writeFilmNarration}=await import('./film-narration.server');
    // The saved Chris sample ran at speed 1.1. Calibrate to ~2.7 words/s, not its rushed 3.77 words/s.
    const measuredRate=measuredSpeakingRate(PROOF_NARRATION,10.867);
    const previousSpeed=Number(previousUsage.speed??1.1);
    const speed=Math.max(0.7,Math.min(1.2,previousSpeed*2.7/measuredRate));
    let targetWords=narrationWordTarget(filmSeconds,measuredRate*speed/previousSpeed);
    const rounds:any[]=[];let feedback='';
    for(let round=0;round<2;round++){
      const draft=await writeFilmNarration(targetWords,scenes.map(s=>s.scene_input),feedback);
      const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${PROOF_VOICE.id}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:draft.script,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.5,similarity_boost:0.75,style:0.2,use_speaker_boost:true,speed}})});
      if(!r.ok)throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0,700)}`);
      const audio=await r.json() as any,alignment=audio.normalized_alignment??audio.alignment;
      const bytes=Uint8Array.from(atob(audio.audio_base64),v=>v.charCodeAt(0)),duration=mp3Duration(bytes);
      const speechEnd=Number(alignment.character_end_times_seconds.at(-1));
      rounds.push({script:draft.script,words:countSpokenWords(draft.script),targetWords,duration,speechEnd,writingUsage:draft.usage,providerCharacterCost:r.headers.get('character-cost')});
      if(round===1||duration<=filmSeconds||(narrationFits(duration,filmSeconds)&&narrationFits(speechEnd,filmSeconds))){
        const captions=alignmentCaptions(alignment,filmSeconds),path=`${context.userId}/${p.id}/assembly-input/${c.attempt.id}.mp3`;
        const {error:up}=await db.storage.from('video-inspiration').upload(path,bytes,{contentType:'audio/mpeg'});if(up)throw new Error(up.message);
        const after=await subscription();const usage={timingVersion:NARRATION_TIMING_VERSION,filmSeconds,measuredRate,previousSpeed,speed,rounds,voice:PROOF_VOICE.name,method:'ElevenLabs synthesis character alignment; MP3 frame duration verification',alignment,elapsedMs:Date.now()-started,before:before?.character_count,after:after?.character_count,characterMovement:before&&after?after.character_count-before.character_count:null,monthlyUsd:before?.next_invoice?.amount_due_cents/100,characterAllowance:before?.character_limit,billedVideoCredits:billed};
        const {data:row,error:saved}=await db.from('film_narration_attempts').update({script:draft.script,status:'completed',result_path:path,captions,duration_seconds:duration,usage,updated_at:new Date().toISOString()}).eq('id',c.attempt.id).eq('status','claimed').select('*').single();if(saved)throw new Error(saved.message);return row;
      }
      targetWords=narrationWordTarget(filmSeconds,measuredSpeakingRate(draft.script,duration));
      feedback=`Previous delivery was ${duration.toFixed(2)} seconds (${speechEnd.toFixed(2)} seconds speech); film is ${filmSeconds} seconds. Adjust wording to fill 95% at the same voice speed.`;
    }
    await db.from('film_narration_attempts').update({usage:{timingVersion:NARRATION_TIMING_VERSION,filmSeconds,measuredRate,speed,rounds}}).eq('id',c.attempt.id);
    throw new Error('Narration did not fill 90–100% of the film after one regeneration. No assembly input saved.');
  }catch(e){await db.rpc('fail_film_narration',{p_attempt:c.attempt.id,p_reason:(e as Error).message});throw e;}
});
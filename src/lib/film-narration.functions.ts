import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {PROOF_NARRATION,PROOF_VOICE,alignmentCaptions} from './film-narration';
export const generateProofNarration=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({projectId:z.string().uuid(),requestKey:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
  const {data:p}=await context.supabase.from('video_inspiration_projects').select('id,observation_notes').eq('id',data.projectId).eq('user_id',context.userId).single();
  if(!p||!(p.observation_notes as string[]).includes('owner-authorized-phase1-proof-16s'))throw new Error('Narration proof is restricted to the owner-authorized imported film.');
  const key=process.env['ELEVENLABS_API_KEY'];if(!key)throw new Error('ElevenLabs is not configured.');
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const {data:existing}=await context.supabase.from('film_narration_attempts').select('*').eq('project_id',p.id).eq('status','completed').order('created_at',{ascending:false}).limit(1);
  if(existing?.[0])return existing[0];
  const {data:claim,error}=await db.rpc('claim_film_narration',{p_user:context.userId,p_project:p.id,p_request:data.requestKey,p_script:PROOF_NARRATION,p_voice:PROOF_VOICE.id,p_billed:0,p_usd:0});if(error)throw new Error(error.message);const c=claim as any;if(c.existing)throw new Error('Narration already started. Do not duplicate the provider call.');
  const subscription=async()=>{const r=await fetch('https://api.elevenlabs.io/v1/user/subscription',{headers:{'xi-api-key':key}});return r.ok?await r.json() as any:null;};
  const before=await subscription();const started=Date.now();
  try{
    const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${PROOF_VOICE.id}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:PROOF_NARRATION,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.5,similarity_boost:0.75,style:0.2,use_speaker_boost:true,speed:1.1}})});
    if(!r.ok)throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0,700)}`);const audio=await r.json() as any;const alignment=audio.normalized_alignment??audio.alignment;
    const captions=alignmentCaptions(alignment,16);const duration=alignment.character_end_times_seconds.at(-1);const path=`${context.userId}/${p.id}/assembly-input/${c.attempt.id}.mp3`;
    const {error:up}=await db.storage.from('video-inspiration').upload(path,Uint8Array.from(atob(audio.audio_base64),v=>v.charCodeAt(0)),{contentType:'audio/mpeg'});if(up)throw new Error(up.message);
    const after=await subscription();const usage={voice:PROOF_VOICE.name,method:'ElevenLabs synthesis character alignment',alignment,elapsedMs:Date.now()-started,before:before?.character_count,after:after?.character_count,characterMovement:before&&after?after.character_count-before.character_count:null,monthlyUsd:before?.next_invoice?.amount_due_cents/100,characterAllowance:before?.character_limit,proofWaiver:'Owner-only proof: 0 video credits; normal narration remains unpriced and blocked.'};
    const {data:row,error:saved}=await db.from('film_narration_attempts').update({status:'completed',result_path:path,captions,duration_seconds:duration,usage,updated_at:new Date().toISOString()}).eq('id',c.attempt.id).select('*').single();if(saved)throw new Error(saved.message);return row;
  }catch(e){await db.rpc('fail_film_narration',{p_attempt:c.attempt.id,p_reason:(e as Error).message});throw e;}
});
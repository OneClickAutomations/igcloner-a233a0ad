import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { VOICE_CATALOG } from './voice-catalog';
import { ACTION_COSTS } from './credits';

export const saveFilmShotReview = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({sceneId:z.string().uuid(),instruction:z.string().max(1500).default(''),attemptId:z.string().uuid().optional()}).parse(d))
  .handler(async({data,context})=>{
    const {data:s}=await context.supabase.from('storyboard_scenes').select('id').eq('id',data.sceneId).eq('user_id',context.userId).single();
    if(!s)throw new Error('Shot not found.');
    const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
    const {error}=await db.rpc('save_film_shot_review',{p_user:context.userId,p_scene:s.id,p_instruction:data.instruction,p_attempt:data.attemptId});
    if(error)throw new Error(error.message);
    return {saved:true};
  });

export const saveFilmReviewSettings = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({projectId:z.string().uuid(),settings:z.record(z.unknown())}).parse(d))
  .handler(async({data,context})=>{
    if(JSON.stringify(data.settings).length>60000)throw new Error('Review notes are too long.');
    const {data:p}=await context.supabase.from('video_inspiration_projects').select('id').eq('id',data.projectId).eq('user_id',context.userId).single();
    if(!p)throw new Error('Film not found.');
    const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
    const {error}=await db.from('video_inspiration_projects').update({review_settings:data.settings as any}).eq('id',p.id).eq('user_id',context.userId);
    if(error)throw new Error(error.message);
    return {saved:true};
  });

export const writeReviewNarration = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({projectId:z.string().uuid(),instructions:z.string().max(1500).default(''),direction:z.unknown().optional(),requestId:z.string().uuid()}).parse(d))
  .handler(async({data,context})=>{
    const {data:p}=await context.supabase.from('video_inspiration_projects').select('*').eq('id',data.projectId).eq('user_id',context.userId).single();
    if(!p)throw new Error('Film not found.');
    const {data:scenes}=await context.supabase.from('storyboard_scenes').select('duration,scene_input').eq('project_id',p.id).order('scene_order');
    const {data:source}=p.analysis_id?await context.supabase.from('analyses').select('evidence,dna_analysis').eq('id',p.analysis_id).eq('user_id',context.userId).maybeSingle():{data:null};
    const {meteredCopy}=await import('./copy-meter.server');
    const {writeFilmNarration}=await import('./film-narration.server');
    return meteredCopy({userId:context.userId,projectId:p.id,action:'caption_pack',key:{reviewNarration:1,request:data.requestId},cost:ACTION_COSTS.captionPack,reason:'caption_pack',requestId:data.requestId},async()=>
      writeFilmNarration(Math.round((scenes??[]).reduce((n,s)=>n+s.duration,0)*2.7),{scenes,verifiedAnalysis:source,direction:data.direction},data.instructions));
  });

export const getFilmVoicePreview = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({voiceId:z.string().refine(id=>VOICE_CATALOG.some(v=>v.id===id))}).parse(d))
  .handler(async({data})=>{
    const key=process.env['ELEVENLABS_API_KEY'];
    if(!key)throw new Error('ElevenLabs is not configured. You can skip voiceover.');
    const response=await fetch(`https://api.elevenlabs.io/v1/voices/${data.voiceId}`,{headers:{'xi-api-key':key}});
    if(!response.ok)throw new Error(`ElevenLabs preview unavailable (${response.status}). You can still choose a voice.`);
    const voice=await response.json() as {preview_url?:string};
    return {url:voice.preview_url??null};
  });
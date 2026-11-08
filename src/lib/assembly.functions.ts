import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { AssemblyOptions, renderQuote, validateCaptions, type AssemblyClip } from './assembly';
import { STUDIO_PRICING,videoBalanceQuote } from './studio-pricing';
const Input=z.object({projectId:z.string().uuid(),options:AssemblyOptions});
async function ownedClips(context:any,projectId:string):Promise<AssemblyClip[]> {
  const {data:p}=await context.supabase.from('video_inspiration_projects').select('id').eq('id',projectId).eq('user_id',context.userId).single();if(!p)throw new Error('Project not found.');
  const {data:scenes,error}=await context.supabase.from('storyboard_scenes').select('*').eq('project_id',projectId).order('scene_order');if(error)throw new Error(error.message);
  const {data:attempts}=await context.supabase.from('scene_attempts').select('*').eq('project_id',projectId).eq('operation','animate').eq('status','completed').order('created_at',{ascending:false});
  return (scenes??[]).map((s:any)=>{const a=attempts?.find((a:any)=>a.scene_id===s.id&&a.scene_revision===s.revision&&a.result_url);if(!a||!s.approved_at||s.approved_revision!==s.revision)throw new Error('Every scene needs an approved, completed clip.');return {sceneId:s.id,attemptId:a.id,path:a.result_url,duration:s.duration,revision:s.revision};});
}
export const quoteAssembly=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>Input.parse(d)).handler(async({data,context})=>{
  const {rendererConfig}=await import('./assembly.server');const config=rendererConfig();
  if(!config)return {configured:false,reason:'Assembly not configured yet. Download all clips instead.',quote:null,clips:[] as AssemblyClip[]};
  const clips=await ownedClips(context,data.projectId);const duration=clips.reduce((n,c)=>n+c.duration,0);validateCaptions(data.options.captions,duration);
  const q=renderQuote(duration,config.environment);const {data:balance,error}=await context.supabase.rpc('video_credit_balance',{p_user:context.userId});if(error)throw new Error('Video balance could not be loaded.');
  return {configured:true,reason:null,quote:q,clips,video:videoBalanceQuote(q.customerCredits,balance??0,duration)};
});
export const startAssembly=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>Input.extend({requestKey:z.string().uuid(),confirmedCredits:z.number().int().nonnegative(),clips:z.array(z.object({sceneId:z.string().uuid(),attemptId:z.string().uuid(),path:z.string(),duration:z.number(),revision:z.number()})).min(1).max(30)}).parse(d)).handler(async({data,context})=>{
  const {rendererConfig,submitAssembly}=await import('./assembly.server');const config=rendererConfig();if(!config)throw new Error('Assembly not configured yet. No credits charged.');
  const clips=await ownedClips(context,data.projectId);if(JSON.stringify(clips)!==JSON.stringify(data.clips))throw new Error('Clips changed. Review a new quote.');
  const duration=clips.reduce((n,c)=>n+c.duration,0);validateCaptions(data.options.captions,duration);const quote=renderQuote(duration,config.environment);if(quote.customerCredits!==data.confirmedCredits)throw new Error('Price changed. Review a new quote.');
  for(const path of [data.options.voiceoverPath,data.options.musicPath,data.options.logoPath].filter(Boolean)){if(!path?.startsWith(`${context.userId}/${data.projectId}/assembly-input/`) && !path?.startsWith(`${context.userId}/references/`))throw new Error('Assembly media must be privately uploaded by this account.');}
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const {data:claim,error}=await db.rpc('claim_assembly_job',{p_user:context.userId,p_project:data.projectId,p_request:data.requestKey,p_input:data.options,p_snapshot:clips,p_billed:quote.customerCredits,p_usd:quote.renderUsd,p_environment:config.environment});if(error)throw new Error(error.message);const c=claim as any;
  if(c.existing)return {jobId:c.job.id};
  try{await submitAssembly(c.job,config);}catch(e){const {error}=await db.rpc('fail_claimed_assembly_job',{p_job:c.job.id,p_reason:(e as Error).message});if(error)throw new Error('Assembly stopped; refund requires recovery.');throw e;}
  return {jobId:c.job.id};
});
export const recoverAssembly=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({projectId:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
  const {data:jobs}=await context.supabase.from('assembly_jobs').select('*').eq('user_id',context.userId).eq('project_id',data.projectId).in('status',['queued','fetching','rendering','saving','claimed','submitting','submission_unknown']).order('created_at',{ascending:false}).limit(2);
  const {collectAssembly}=await import('./assembly.server');const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  for(const job of jobs??[]){if(job.provider_job_id)await collectAssembly(job);else if(Date.now()-Date.parse(job.updated_at)>300000){if(job.status==='claimed'){const {error}=await db.rpc('fail_claimed_assembly_job',{p_job:job.id,p_reason:'Interrupted before submission. Assembly credits refunded.'});if(error)throw new Error('Interrupted assembly refund needs recovery.');}else if(job.status==='submitting')await db.from('assembly_jobs').update({status:'submission_unknown',lease_until:null,failure_reason:'Submission interrupted. Check Shotstack history; no automatic paid retry.'}).eq('id',job.id).eq('status','submitting');}}
  return {ok:true};
});
export const uploadAssemblyMedia=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({projectId:z.string().uuid(),kind:z.enum(['voiceover','music','logo']),mime:z.enum(['audio/mpeg','audio/wav','audio/mp4','image/png','image/jpeg','image/webp']),base64:z.string().max(14000000)}).parse(d)).handler(async({data,context})=>{
  const {data:p}=await context.supabase.from('video_inspiration_projects').select('id').eq('id',data.projectId).eq('user_id',context.userId).single();if(!p)throw new Error('Project not found.');
  if((data.kind==='logo')!==data.mime.startsWith('image/'))throw new Error('Wrong file type.');const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));if(!bytes.length||bytes.length>10*1024*1024)throw new Error('Media must be under 10MB.');
  const ext={'audio/mpeg':'mp3','audio/wav':'wav','audio/mp4':'m4a','image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[data.mime];const path=`${context.userId}/${data.projectId}/assembly-input/${crypto.randomUUID()}.${ext}`;
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const {error}=await db.storage.from('video-inspiration').upload(path,bytes,{contentType:data.mime});if(error)throw new Error('Assembly media upload failed.');return {path};
});
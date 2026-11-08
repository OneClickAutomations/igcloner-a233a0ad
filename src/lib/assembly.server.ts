import { AssemblyOptions, buildAssemblyTimeline, captionsToSrt, type AssemblyClip } from './assembly';
export function rendererConfig() {
  const sandbox=process.env['SHOTSTACK_SANDBOX_API_KEY'];
  const production=process.env['SHOTSTACK_API_KEY'];
  return sandbox ? {key:sandbox,environment:'stage' as const} : production ? {key:production,environment:'v1' as const} : null;
}
export async function hashCallback(token:string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join(''); }
export class RenderHttpError extends Error { constructor(public status:number) { super(`Shotstack request failed (${status}). Check your account and key before retrying.`); } }
export async function shotstack(path:string,config:{key:string;environment:'v1'|'stage'},body?:unknown) {
  const res=await fetch(`https://api.shotstack.io/edit/${config.environment}/${path}`,{method:body?'POST':'GET',headers:{'x-api-key':config.key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  if(!res.ok) throw new RenderHttpError(res.status);
  const result=await res.json() as any;
  if(result.success===false) throw new Error('Shotstack rejected the render. Review your media and settings.');
  return result.response;
}
export async function submitAssembly(job:any,config:{key:string;environment:'v1'|'stage'}) {
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const sign=async(path:string) => {
    if(!path.startsWith(`${job.user_id}/`)) throw new Error('Media is not owned by this account.');
    const {data,error}=await db.storage.from('video-inspiration').createSignedUrl(path,86400);
    if(error||!data) throw new Error('Assembly media could not be loaded.'); return data.signedUrl;
  };
  const settings=AssemblyOptions.parse(job.input);
  const clips=await Promise.all((job.clip_snapshot as AssemblyClip[]).map(async c=>({...c,url:await sign(c.path)})));
  const media:{voiceover?:string;music?:string;logo?:string;captions?:string}={};
  if(settings.voiceoverPath) media.voiceover=await sign(settings.voiceoverPath);
  if(settings.musicPath) media.music=await sign(settings.musicPath);
  if(settings.logoPath) media.logo=await sign(settings.logoPath);
  if(settings.captions.length) {
    const path=`${job.user_id}/${job.project_id}/assembly/${job.id}.srt`;
    const {error}=await db.storage.from('video-inspiration').upload(path,new TextEncoder().encode(captionsToSrt(settings.captions,job.duration_seconds)),{contentType:'text/plain',upsert:true});
    if(error) throw new Error('Caption file could not be saved.'); media.captions=await sign(path);
  }
  const token=crypto.randomUUID()+crypto.randomUUID();
  const {data:won,error:lockError}=await db.from('assembly_jobs').update({status:'submitting',callback_token_hash:await hashCallback(token),updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','claimed').select('id').maybeSingle();
  if(lockError) throw new Error('Assembly claim could not be saved.'); if(!won)return;
  const timeline=buildAssemblyTimeline(clips,settings,media);
  let response:any;
  try { response=await shotstack('render',config,{...timeline,callback:`https://igcloner.lovable.app/api/public/assembly-callback?job=${job.id}&token=${encodeURIComponent(token)}`}); }
  catch(e) {
    if(e instanceof RenderHttpError || (e as Error).message.startsWith('Shotstack rejected')) { await db.rpc('fail_assembly_job',{p_job:job.id,p_reason:(e as Error).message}); }
    else await db.from('assembly_jobs').update({status:'submission_unknown',lease_until:null,failure_reason:'Submission response was lost. Do not submit again; check Shotstack render history.'}).eq('id',job.id);
    throw e;
  }
  if(!response?.id) { await db.from('assembly_jobs').update({status:'submission_unknown',lease_until:null,failure_reason:'Provider did not return a render ID. Reconciliation required; no automatic retry.'}).eq('id',job.id); throw new Error('Render submission needs reconciliation.'); }
  const {error}=await db.from('assembly_jobs').update({provider_job_id:response.id,status:'queued',lease_until:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','submitting');
  if(error) throw new Error('Render submitted but saving its ID needs recovery; do not resubmit.');
}
async function boundedMp4(url:string) {
  const parsed=new URL(url);
  // Provider URLs only. Never follow arbitrary URLs or private network redirects.
  if(parsed.protocol!=='https:' || !(/(^|\.)shotstack\.io$/.test(parsed.hostname)||/\.s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname)||/\.s3\.amazonaws\.com$/.test(parsed.hostname))) throw new Error('Unexpected Shotstack output host.');
  const res=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!res.ok||!res.body) throw new Error('Finished video download unavailable.');
  const limit=50*1024*1024; if(Number(res.headers.get('content-length'))>limit) throw new Error('Finished video exceeds 50MB.');
  const reader=res.body.getReader(); const chunks:Uint8Array[]=[]; let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new Error('Finished video exceeds 50MB.');}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  if(total<12 || String.fromCharCode(...bytes.slice(4,8))!=='ftyp') throw new Error('Output is not a valid MP4 container.');
  return bytes;
}
export async function collectAssembly(job:any) {
  if(!job.provider_job_id || ['completed','failed'].includes(job.status))return;
  const key=job.environment==='stage'?process.env['SHOTSTACK_SANDBOX_API_KEY']:process.env['SHOTSTACK_API_KEY']; if(!key)return;
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const now=new Date();
  const {data:won}=await db.from('assembly_jobs').update({lease_until:new Date(now.getTime()+90000).toISOString()}).eq('id',job.id).in('status',['queued','fetching','rendering','saving','submission_unknown','submitting']).or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`).select('id').maybeSingle();if(!won)return;
  try {
    const state=await shotstack(`render/${encodeURIComponent(job.provider_job_id)}`,{key,environment:job.environment});
    if(state.status==='failed'){await db.rpc('fail_assembly_job',{p_job:job.id,p_reason:'Shotstack render failed. Assembly credits refunded; scene clips are unchanged.'});return;}
    if(state.status!=='done'){await db.from('assembly_jobs').update({status:['queued','fetching','rendering'].includes(state.status)?state.status:'rendering',lease_until:null,updated_at:new Date().toISOString()}).eq('id',job.id);return;}
    if(!state.url)throw new Error('Finished render has no output URL.');
    if(state.output?.size && state.output.size.width>=state.output.size.height)throw new Error('Provider output is not portrait.');
    await db.from('assembly_jobs').update({status:'saving'}).eq('id',job.id);
    const bytes=await boundedMp4(state.url);const path=`${job.user_id}/${job.project_id}/assembly/${job.id}.mp4`;
    const {error}=await db.storage.from('video-inspiration').upload(path,bytes,{contentType:'video/mp4',upsert:true});if(error)throw new Error('Rendered video could not be saved privately.');
    const {error:saved}=await db.from('assembly_jobs').update({status:'completed',result_path:path,lease_until:null,failure_reason:null,updated_at:new Date().toISOString()}).eq('id',job.id).neq('status','failed');if(saved)throw new Error('Finished video record could not be saved.');
  }catch(e){await db.from('assembly_jobs').update({lease_until:null,failure_reason:(e as Error).message}).eq('id',job.id).neq('status','failed');throw e;}
}
import { createFileRoute } from '@tanstack/react-router';
export const Route=createFileRoute('/api/public/assembly-callback')({server:{handlers:{POST:async({request})=>{
  const url=new URL(request.url),id=url.searchParams.get('job'),token=url.searchParams.get('token');
  if(!id||!token||token.length!==72)return Response.json({ok:false},{status:401});
  const {hashCallback,collectAssembly}=await import('@/lib/assembly.server');const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const {data:job}=await db.from('assembly_jobs').select('*').eq('id',id).eq('callback_token_hash',await hashCallback(token)).single();if(!job)return Response.json({ok:false},{status:403});
  // Never trust callback result URL/status. Fetch the durable job from Shotstack again.
  if(!job.provider_job_id){const body=await request.json().catch(()=>null) as any;if(typeof body?.id!=='string'||!/^[-\w]{1,100}$/.test(body.id))return Response.json({ok:false},{status:400});const {error}=await db.from('assembly_jobs').update({provider_job_id:body.id,status:'queued',lease_until:null}).eq('id',job.id).is('provider_job_id',null);if(error)return Response.json({ok:false},{status:503});job.provider_job_id=body.id;job.status='queued';job.lease_until=null;}
  try{await collectAssembly(job);return Response.json({ok:true});}catch{return Response.json({ok:false},{status:503});}
}}}});
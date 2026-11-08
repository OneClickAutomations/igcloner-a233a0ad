import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { ensureTrialGrant, validateAdminGrant } from './video-grants';

async function grantTrial(supabase: any, userId: string) {
  const { data: p } = await supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle();
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  await ensureTrialGrant(userId, p?.created_at, async (u, amount, reason, key) => {
    const { data, error } = await supabaseAdmin.rpc('grant_video_credits_keyed', { p_user: u, p_amount: amount, p_reason: reason, p_key: key });
    if (error) throw new Error('Trial grant failed.');
    return Boolean(data);
  });
}

export const getVideoCreditBalance = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  await grantTrial(context.supabase, context.userId).catch(() => {});
  const {data,error}=await context.supabase.rpc('video_credit_balance',{p_user:context.userId});
  if(error)throw new Error('Video balance could not be loaded.');
  return {balance:data??0};
});

export const getIsAdmin = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  return {isAdmin:Boolean(data)};
});

export const adminGrantVideoCredits = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({email:z.string().trim().email().max(255),amount:z.number().int(),note:z.string().trim().max(120).optional()}).parse(d))
  .handler(async({data,context})=>{
    const {data:isAdmin}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
    const amount=validateAdminGrant(Boolean(isAdmin),data.amount);
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    let target:string|undefined;
    for(let page=1;page<=20&&!target;page++){
      const {data:list,error}=await supabaseAdmin.auth.admin.listUsers({page,perPage:200});
      if(error)throw new Error('Accounts could not be searched.');
      target=list.users.find(u=>u.email?.toLowerCase()===data.email.toLowerCase())?.id;
      if(list.users.length<200)break;
    }
    if(!target)throw new Error('No account with that email.');
    const {error}=await supabaseAdmin.rpc('grant_video_credits_keyed',{p_user:target,p_amount:amount,p_reason:'admin_grant',p_key:`admin:${context.userId}:${crypto.randomUUID()}`});
    if(error)throw new Error(error.message);
    const {data:balance}=await supabaseAdmin.rpc('video_credit_balance',{p_user:target});
    return {balance:balance??0};
  });

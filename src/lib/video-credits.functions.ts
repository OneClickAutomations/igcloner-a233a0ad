import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const getVideoCreditBalance = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data,error}=await context.supabase.rpc('video_credit_balance',{p_user:context.userId});
  if(error)throw new Error('Video balance could not be loaded.');
  return {balance:data??0};
});
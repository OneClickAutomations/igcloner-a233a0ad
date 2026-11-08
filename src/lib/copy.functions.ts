import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACTION_COSTS } from "./credits";
import { PUBLISHING_PLATFORMS } from "./upload-post/shared";

export const runHookLab=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({analysisId:z.string().uuid(),preferences:z.record(z.unknown()).optional(),regenerate:z.number().int().optional(),requestId:z.string().uuid().optional()}).parse(d)).handler(async({data,context})=>{
  const {buildCopyContext,hookLab}=await import("./copy-engine.server");
  const {meteredCopy}=await import("./copy-meter.server");
  const ctx=await buildCopyContext(data.analysisId,context.userId,undefined,data.preferences);
  return meteredCopy({userId:context.userId,analysisId:data.analysisId,action:"hooks",key:{analysisId:data.analysisId,context:ctx,regenerate:data.regenerate},cost:ACTION_COSTS.hookLab,reason:"debit_hooks",requestId:data.requestId},progress=>hookLab(ctx,progress));
});
export const generateCaptionPack=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({projectId:z.string().uuid(),platforms:z.array(z.enum(PUBLISHING_PLATFORMS)).min(1),instruction:z.string().max(2000).optional(),regenerate:z.number().int().optional(),requestId:z.string().uuid().optional()}).parse(d)).handler(async({data,context})=>{
  const {data:p,error}=await context.supabase.from("projects").select("*").eq("id",data.projectId).eq("user_id",context.userId).maybeSingle();
  if(error || !p) throw new Error("Project not found");
  const {buildCopyContext,nativeCaptionPack}=await import("./copy-engine.server");
  const {meteredCopy}=await import("./copy-meter.server");
  const ctx=p.analysis_id ? await buildCopyContext(p.analysis_id,context.userId,undefined,p.user_preferences) : {source:{captionDNA:{},exactHook:"",caption:"",blueprint:null},voice:p.user_preferences,research:null};
  const platforms=[...new Set(data.platforms)].sort();
  const result=await meteredCopy({userId:context.userId,analysisId:p.analysis_id??undefined,projectId:p.id,action:"caption",key:{projectId:p.id,context:ctx,platforms,instruction:data.instruction,regenerate:data.regenerate},cost:ACTION_COSTS.captionPack,reason:"debit_caption",requestId:data.requestId},progress=>nativeCaptionPack(ctx,platforms,data.instruction,progress));
  const pd=(p.project_data ?? {}) as any;
  const {error:saveErr}=await context.supabase.from("projects").update({project_data:{...pd,captionPack:result.platforms,captionQuality:(result as any).qualityReport??null} as any}).eq("id",p.id).eq("user_id",context.userId);
  if(saveErr) throw new Error(saveErr.message);
  return result;
});
export const listCopyHistory=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({analysisId:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
  const {data:rows,error}=await context.supabase.from("copy_runs").select("id,action,status,output,error_message,created_at,project_id").eq("user_id",context.userId).eq("analysis_id",data.analysisId).order("created_at",{ascending:false}).limit(30);
  if(error) throw new Error(error.message);return {runs:rows??[]};
});
export const useProjectHook=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({projectId:z.string().uuid(),hook:z.string().min(1).max(500)}).parse(d)).handler(async({data,context})=>{
  const {data:p}=await context.supabase.from("projects").select("project_data,user_preferences").eq("id",data.projectId).eq("user_id",context.userId).maybeSingle();
  if(!p) throw new Error("Project not found");
  const pd=(p.project_data??{}) as any; const oldHook=pd.hook;
  const next={...pd,hook:typeof oldHook==="object"?{...oldHook,text:data.hook,onScreenText:data.hook}:data.hook};
  if(Array.isArray(next.slides)&&next.slides[0]) next.slides=next.slides.map((s:any,i:number)=>i===0?{...s,headline:data.hook,imageUrl:undefined}:s);
  const {error}=await context.supabase.from("projects").update({project_data:next,user_preferences:{...(p.user_preferences as any??{}),angleHook:data.hook}}).eq("id",data.projectId).eq("user_id",context.userId);
  if(error) throw new Error(error.message);return {ok:true};
});

export const copyRequestProgress=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((d:unknown)=>z.object({requestId:z.string().uuid(),expire:z.boolean().optional()}).parse(d)).handler(async({data,context})=>{
    const {data:row,error}=await context.supabase.from("copy_runs").select("id,attempt_id,action,status,output,created_at,error_message").eq("user_id",context.userId).contains("output",{requestId:data.requestId}).maybeSingle();
    if(error)throw new Error(error.message);
    if(!row)return {stage:"Preparing your saved post…",status:"pending",refunded:false};
    if(data.expire && row.status==="processing" && Date.now()-Date.parse(row.created_at)>=15*60*1000){
      const {supabaseAdmin:sb}=await import("@/integrations/supabase/client.server");
      const {data:expired,error:expireError}=await sb.from("copy_runs").update({status:"failed",error_message:"Writing took too long. Your attempt was refunded. Try again.",updated_at:new Date().toISOString()}).eq("id",row.id).eq("user_id",context.userId).eq("attempt_id",row.attempt_id).eq("status","processing").select("id").maybeSingle();
      if(expireError)throw new Error(expireError.message);
      if(expired){const {refundCredits}=await import("./credits.server");await refundCredits(context.userId,row.action==="hooks"?ACTION_COSTS.hookLab:ACTION_COSTS.captionPack,"copy_run",row.id,row.attempt_id);return {stage:"Writing took too long. Your attempt was refunded. Try again.",status:"failed",refunded:true};}
    }
    return {stage:(row.output as any)?.stage??"Finishing…",status:row.status,refunded:false};
  });
import { debitCredits, refundCredits } from "./credits.server";
import type { LedgerReason } from "./credits";

/** Claim before billing; concurrent identical runs never charge twice. Ready output is free. */
export async function meteredCopy<T>(input:{userId:string;analysisId?:string;projectId?:string;action:string;key:unknown;cost:number;reason:LedgerReason;requestId?:string},work:(progress:(stage:string)=>Promise<void>)=>Promise<T>) {
  const {supabaseAdmin:sb}=await import("@/integrations/supabase/client.server");
  await sb.rpc("sweep_stale_copy_runs");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify({version:3,...input.key as object,action:input.action})));
  const key=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
  const {data,error}=await sb.rpc("claim_copy_run",{p_user_id:input.userId,p_cache_key:key,p_action:input.action,p_analysis_id:input.analysisId,p_project_id:input.projectId});
  if(error) throw new Error(error.message);
  const claim=data as any,row=claim.row;
  if(claim.cached) return {...row.output,charged:0,cached:true,runId:row.id} as T & {charged:number;cached:boolean;runId:string};
  if(claim.busy) throw new Error("This writing request is already running. Check history shortly.");
  let charged=false;
  try {
    await debitCredits(input.userId,input.cost,input.reason,"copy_run",row.id,row.attempt_id); charged=true;
    const progress=async(stage:string)=>{
      if(!input.requestId)return;
      const {data:active,error}=await sb.from("copy_runs").update({output:{requestId:input.requestId,stage} as any,updated_at:new Date().toISOString()}).eq("id",row.id).eq("attempt_id",row.attempt_id).eq("status","processing").select("id").maybeSingle();
      if(error || !active)throw new Error("This writing attempt has ended. Try again.");
    };
    await progress("Preparing your saved post…");
    const output=await work(progress);
    const {data:saved,error:saveErr}=await sb.from("copy_runs").update({status:"ready",output:output as any,usage:(output as any).usage ?? null,updated_at:new Date().toISOString()}).eq("id",row.id).eq("attempt_id",row.attempt_id).eq("status","processing").select("id").maybeSingle();
    if(saveErr || !saved) throw new Error("Writing finished after its attempt expired; not saved.");
    return {...output,charged:input.cost,cached:false,runId:row.id};
  } catch(e) {
    if(charged) await refundCredits(input.userId,input.cost,"copy_run",row.id,row.attempt_id);
    await sb.from("copy_runs").update({status:"failed",error_message:e instanceof Error?e.message:String(e),updated_at:new Date().toISOString()}).eq("id",row.id).eq("attempt_id",row.attempt_id).eq("status","processing");
    throw e;
  }
}
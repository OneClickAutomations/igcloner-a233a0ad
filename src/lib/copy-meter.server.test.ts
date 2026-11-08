import {describe,it,expect,vi,beforeEach} from "vitest";
const state=vi.hoisted(()=>({claim:{cached:false,busy:false,row:{id:"run",attempt_id:"attempt"}},save:true,debit:vi.fn(),refund:vi.fn()}));
vi.mock("./credits.server",()=>({debitCredits:state.debit,refundCredits:state.refund}));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{rpc:vi.fn(async(name:string)=>({data:name==="claim_copy_run"?state.claim:null,error:null})),from:()=>({update:()=>{const q:any={eq:()=>q,select:()=>q,maybeSingle:async()=>({data:state.save?{id:"run"}:null,error:null}),then:(resolve:any)=>resolve({error:null})};return q;}})}}));
import {meteredCopy} from "./copy-meter.server";
const input={userId:"owner",action:"hooks",key:{source:"source"},cost:2,reason:"debit_hooks" as const};
beforeEach(()=>{vi.clearAllMocks();state.claim={cached:false,busy:false,row:{id:"run",attempt_id:"attempt"}};state.save=true;state.debit.mockResolvedValue(undefined);});
describe("copy billing integration",()=>{
  it("charges Hook Lab exactly two once and persists",async()=>{const work=vi.fn(async()=>({hooks:["winner"]}));const out=await meteredCopy(input,work);expect(out.charged).toBe(2);expect(state.debit).toHaveBeenCalledWith("owner",2,"debit_hooks","copy_run","run","attempt");expect(state.refund).not.toHaveBeenCalled();});
  it("cached repeats do not generate or debit",async()=>{state.claim={...state.claim,cached:true,row:{...state.claim.row,output:{hooks:["saved"]}} as any};const work=vi.fn();expect((await meteredCopy(input,work)).charged).toBe(0);expect(work).not.toHaveBeenCalled();expect(state.debit).not.toHaveBeenCalled();});
  it("quality failure refunds precisely its attempt",async()=>{await expect(meteredCopy(input,async()=>{throw new Error("QUALITY_NOT_MET");})).rejects.toThrow("QUALITY_NOT_MET");expect(state.refund).toHaveBeenCalledExactlyOnceWith("owner",2,"copy_run","run","attempt");});
  it("insufficient balance never refunds an undebited attempt",async()=>{state.debit.mockRejectedValue(new Error("INSUFFICIENT_CREDITS"));await expect(meteredCopy(input,vi.fn())).rejects.toThrow("INSUFFICIENT_CREDITS");expect(state.refund).not.toHaveBeenCalled();});
  it("late save is withheld and refunded",async()=>{state.save=false;await expect(meteredCopy(input,async()=>({hooks:[]}))).rejects.toThrow("expired");expect(state.refund).toHaveBeenCalledTimes(1);});
  it("an expired progress attempt refunds its two-credit debit",async()=>{state.save=false;const work=vi.fn();await expect(meteredCopy({...input,requestId:"request"},work)).rejects.toThrow("attempt has ended");expect(work).not.toHaveBeenCalled();expect(state.refund).toHaveBeenCalledExactlyOnceWith("owner",2,"copy_run","run","attempt");});
});
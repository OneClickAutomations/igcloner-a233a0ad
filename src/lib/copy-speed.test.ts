import { describe, it, expect, vi } from "vitest";
const calls=vi.hoisted(()=>({count:0}));
vi.mock("@ai-sdk/anthropic",()=>({createAnthropic:()=>()=>({})}));
vi.mock("./copy-run-id.server",()=>({createLovableAiGatewayRunIdFetch:()=>({fetch:vi.fn()})}));
vi.mock("ai",()=>({streamText:()=>{
  calls.count++;
  const scores={specificity:7,hookStrength:7,voiceFit:7,sourceGrounding:7,originality:7,platformFit:7,postReady:7};
  const hooks=Array.from({length:12},(_,id)=>({id,mechanism:`mechanism${id}`,sourceForm:"caption",onScreen:`object${id} matters`,spoken:`action${id} now.`,caption:`tension${id}`,carousel:`scene${id}`,bestUse:"reel",researchPattern:"No matching research"}));
  const round=calls.count%3;
  const value=round===1?{hooks}:round===2?{ranks:hooks.map(h=>({id:h.id,scores:{specificity:7,tension:7,firstThreeWords:7,voiceFit:7,novelty:7,platformFit:7},reason:"usable"}))}:{items:hooks.slice(0,10).map((_,index)=>({index,scores,fix:"more tension"}))};
  return {text:Promise.resolve(JSON.stringify(value)),finishReason:Promise.resolve("stop"),usage:Promise.resolve({inputTokens:1,outputTokens:1})};
}}));
import {hookLab} from "./copy-engine.server";
describe("bounded Hook Lab",()=>{
  it("writes twelve candidates, keeps ten, and returns low-scored hooks after one writing round without quality regeneration",async()=>{
    vi.stubEnv("LOVABLE_API_KEY","test-key");calls.count=0;const progress=vi.fn(async()=>{});
    const result=await hookLab({source:{hookLocation:"caption",exactHook:"",blueprint:null},voice:{},research:null},progress);
    expect(result.candidatesGenerated).toBe(12);expect(result.hooks).toHaveLength(10);expect(result.quality).toHaveLength(1);expect(calls.count).toBe(3);
    expect(progress).toHaveBeenCalledWith("Ranking them…");vi.unstubAllEnvs();
  });
});
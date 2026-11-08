import { QualityNote } from './QualityNote';
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./ui/select";
import { runHookLab, generateCaptionPack, listCopyHistory, useProjectHook } from "@/lib/copy.functions";
import { CREDIT_BALANCE_KEY, parseInsufficientCredits } from "@/lib/credits";

export function CopyWorkbench({analysisId,projects,initialNiche=''}:{analysisId:string;projects:any[];initialNiche?:string}) {
  const hooksFn=useServerFn(runHookLab),packFn=useServerFn(generateCaptionPack),historyFn=useServerFn(listCopyHistory),useFn=useServerFn(useProjectHook);
  const qc=useQueryClient();
  const [busy,setBusy]=useState(""),[hooks,setHooks]=useState<any[]>([]),[pack,setPack]=useState<any[]>([]),[history,setHistory]=useState<any[]>([]),[hookQ,setHookQ]=useState<any>(null),[packQ,setPackQ]=useState<any>(null);
  const [projectId,setProjectId]=useState(""),[niche,setNiche]=useState(initialNiche),[platforms,setPlatforms]=useState(["instagram","tiktok","x","linkedin"]);
  const [used,setUsed]=useState<number|null>(null);
  useEffect(()=>setNiche(initialNiche),[initialNiche]);
  const reload=async()=>{const r=await historyFn({data:{analysisId}});setHistory(r.runs);};
  useEffect(()=>{setHooks([]);setPack([]);reload().catch(()=>{});},[analysisId]);
  useEffect(()=>{if(!projectId&&projects[0])setProjectId(projects[0].id);},[projects,projectId]);
  const run=async(action:string,regenerate?:number)=>{
    setBusy(action);
    try {
      if(action==="hooks") {const r:any=await hooksFn({data:{analysisId,preferences:niche?{niche}:undefined,regenerate}});setHooks(r.hooks);setHookQ(r.qualityReport??null);toast.success(r.cached?"Saved hooks loaded — free":"10 ranked hooks ready");}
      else {if(!projectId)throw new Error("Choose a project first");const r:any=await packFn({data:{projectId,platforms,regenerate}});setPack(r.platforms);setPackQ(r.qualityReport??null);toast.success(r.cached?"Saved captions loaded — free":"Caption pack ready");}
      await reload();
    }catch(e){const info=parseInsufficientCredits(e);toast.error(info?`You need ${info.required} credits; ${info.available} available.`:e instanceof Error?e.message:"Writing failed");}
    finally{setBusy("");qc.invalidateQueries({queryKey:CREDIT_BALANCE_KEY});}
  };
  return <section className="space-y-4 border-t border-border py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Optional hooks and captions</h3></div>
    <div className="flex flex-wrap items-center gap-3">
      {projects.length>1&&<Select value={projectId} onValueChange={setProjectId}><SelectTrigger className="w-64" aria-label="Active writing project"><SelectValue placeholder="Choose a project"/></SelectTrigger><SelectContent>{projects.map(p=><SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select>}
      <Button disabled={!!busy} onClick={()=>run("hooks")}><Sparkles className="mr-2 h-4 w-4"/>{busy==="hooks"?"Writing & ranking…":"Generate hooks (2 credits)"}</Button>
      <Button variant="outline" disabled={!!busy||!projectId||!platforms.length} onClick={()=>run("caption")}>{busy==="caption"?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Caption pack (1 credit)</Button>
    </div>
    <div className="flex flex-wrap gap-4">{["instagram","tiktok","x","linkedin"].map(p=><label key={p} className="flex items-center gap-2 text-sm capitalize"><Checkbox checked={platforms.includes(p)} onCheckedChange={v=>setPlatforms(old=>v?[...old,p]:old.filter(x=>x!==p))}/>{p}</label>)}</div>
    {hooks.length>0&&<QualityNote report={hookQ} busy={!!busy} regenerateLabel="Regenerate hooks (2 credits)" onRegenerate={()=>run("hooks",Date.now())}/>}
    {hooks.length>0&&<ol className="grid gap-3 md:grid-cols-2">{hooks.map((h,i)=><li key={h.id} className="rounded-lg border border-border p-3"><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>#{i+1} · {h.mechanism}</span><strong className="text-accent-primary">{Number(h.totalScore).toFixed(1)}/10</strong></div><p className="font-semibold">{h.text}</p><p className="mt-2 text-xs text-muted-foreground">{h.why}</p><p className="mt-1 text-xs text-muted-foreground">{h.bestUse} · {h.researchPattern}</p><details className="mt-2 text-xs"><summary>Alternate forms & scores</summary>{["onScreen","spoken","caption","carousel"].map(k=><p key={k} className="mt-1">{k}: {h[k]}</p>)}<p>{Object.entries(h.scores??{}).map(([k,v])=>`${k}: ${v}`).join(" · ")}</p></details><Button size="sm" variant="ghost" disabled={!projectId} onClick={async()=>{try{await useFn({data:{projectId,hook:h.text}});setUsed(h.id);qc.invalidateQueries({queryKey:["project",projectId]});toast.success("Hook saved to project");}catch(e){toast.error(String(e));}}}>{used===h.id?<Check className="mr-1 h-3 w-3"/>:null}Use this hook</Button></li>)}</ol>}
    {pack.length>0&&<QualityNote report={packQ} busy={!!busy} regenerateLabel="Regenerate captions (1 credit)" onRegenerate={()=>run("caption",Date.now())}/>}
    {pack.length>0&&<div className="grid gap-3 md:grid-cols-2">{pack.map(p=><article key={p.platform} className="rounded-lg border border-border p-3"><div className="flex justify-between"><h4 className="font-semibold capitalize">{p.platform}</h4><Button size="icon" variant="ghost" aria-label={`Copy ${p.platform} caption`} onClick={()=>navigator.clipboard.writeText(`${p.caption}\n\n${p.hashtags.map((h:string)=>`#${h}`).join(" ")}`)}><Copy className="h-4 w-4"/></Button></div><p className="mt-2 whitespace-pre-line text-sm">{p.caption}</p><p className="mt-2 text-xs text-muted-foreground">{p.hashtags.map((h:string)=>`#${h}`).join(" ")}</p>{p.altText&&<p className="mt-2 text-xs text-muted-foreground">Alt text: {p.altText}</p>}</article>)}</div>}
    {history.length>0&&<details><summary className="text-sm text-muted-foreground">Writing history ({history.length})</summary><div className="mt-2 flex flex-wrap gap-2">{history.map(r=><Button key={r.id} size="sm" variant="outline" disabled={r.status!=="ready"} onClick={()=>{const out=r.output as any;if(r.action==="hooks"){setHooks(out.hooks??[]);setHookQ(out.qualityReport??null);}if(r.action==="caption"){setPack(out.platforms??[]);setPackQ(out.qualityReport??null);}}}>{r.action} · {r.status} · {new Date(r.created_at).toLocaleDateString()}</Button>)}</div></details>}
  </section>;
}
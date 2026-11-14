import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { useGenJob } from './useGenJob';
import { enhanceStudioPrompt } from '@/lib/prompt-magic.functions';
import { PROMPT_MAGIC_COST } from '@/lib/prompt-magic';
import { CREDIT_BALANCE_KEY } from '@/lib/credits';

export function PromptMagic({projectId,sceneId,value,onChange,target,disabled=false}:{projectId:string;sceneId?:string;value:string;onChange:(value:string)=>void;target:'still'|'motion'|'revision';disabled?:boolean}) {
  const [format,setFormat]=useState<'regular'|'json'>('regular');
  const enhance=useServerFn(enhanceStudioPrompt), qc=useQueryClient(), gen=useGenJob();
  const execute=async()=>{
    try {
      await gen.run({slot:'prompt-magic',title:'Your enhanced prompt',stage:'Refining your prompt…',expectedSeconds:25,doneLabel:'Your enhanced prompt is ready',paid:true},async()=>{
        const r=await enhance({data:{projectId,sceneId,text:value,format,target,requestId:crypto.randomUUID()}});
        onChange(r.text);
      });
    }catch(e){toast.error(e instanceof Error?e.message:'Prompt enhancement failed.');}
    finally{await qc.invalidateQueries({queryKey:CREDIT_BALANCE_KEY});}
  };
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Enhanced prompt format" className="flex gap-1">
        {(['regular','json'] as const).map(f=><Button key={f} type="button" size="sm" variant={format===f?'secondary':'outline'} aria-pressed={format===f} disabled={gen.isRunning()} onClick={()=>setFormat(f)}>{f==='json'?'JSON':'Regular'}</Button>)}
      </div>
      <Button type="button" size="sm" variant="outline" title="Enhance your keywords while preserving the scene and character" aria-label={`AI Magic · ${PROMPT_MAGIC_COST} plan credit`} disabled={disabled||!value.trim()||gen.isRunning()} onClick={execute}><Sparkles className="size-4"/>AI Magic · {PROMPT_MAGIC_COST} plan credit</Button>
    </div>
    {gen.ring('prompt-magic')}
  </div>;
}
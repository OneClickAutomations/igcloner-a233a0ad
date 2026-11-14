import { PromptMagic } from './PromptMagic';
import { useGenJob } from './useGenJob';
import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {Film,RefreshCw,Save} from 'lucide-react';
import {Button} from './ui/button';
import {Textarea} from './ui/textarea';
import {Select,SelectTrigger,SelectContent,SelectItem,SelectValue} from './ui/select';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from './ui/dialog';
import {changesShotAppearance} from '@/lib/film-review';
import {saveFilmShotReview} from '@/lib/film-review.functions';
import {animateInspirationScene,inspirationQuote,recoverInspirationClips,getInspirationStudio} from '@/lib/inspiration.functions';
import {STUDIO_PRICING,videoCreditsForWorkspace} from '@/lib/studio-pricing';
type Data=Awaited<ReturnType<typeof getInspirationStudio>>;
export function FilmShotReview({data,busy,run,refresh,value,onChange,onAssemble,onEditStills}:{data:Data;busy:boolean;run:(f:()=>Promise<unknown>)=>Promise<void>;refresh:()=>Promise<void>;value:Record<string,unknown>;onChange:(v:Record<string,unknown>)=>void;onAssemble:()=>void;onEditStills:()=>void}){
  const save=useServerFn(saveFilmShotReview),quote=useServerFn(inspirationQuote),animate=useServerFn(animateInspirationScene),recover=useServerFn(recoverInspirationClips),load=useServerFn(getInspirationStudio);
  const gen=useGenJob();
  const [selected,setSelected]=useState(data.scenes[0]?.id??'');
  const [confirmation,setConfirmation]=useState<{items:{scene:Data['scenes'][number];q:Awaited<ReturnType<typeof inspirationQuote>>;instruction:string}[]}|null>(null);
  const [progress,setProgress]=useState('');
  const notes=(value.shotInstructions??{}) as Record<string,string>,whole=String(value.wholeInstruction??'');
  const scene=data.scenes.find(s=>s.id===selected)??data.scenes[0];
  const versions=data.attempts.filter(a=>a.scene_id===scene?.id&&a.operation==='animate'&&a.status==='completed'&&a.scene_revision===scene.revision&&a.preview);
  const current=versions.find(a=>a.id===scene?.selected_attempt_id)??versions[0];
  const model='google/veo-3.1-fast' as const;
  const cost=(seconds:number)=>videoCreditsForWorkspace(seconds*(STUDIO_PRICING.rates[model]??0));
  const prepare=async(all:boolean)=>{
    const items=[];
    for(const s of all?data.scenes:scene?[scene]:[]){
      const instruction=[whole,notes[s.id]].filter(Boolean).join('\n');
      await save({data:{sceneId:s.id,instruction}});
      items.push({scene:s,instruction,q:await quote({data:{sceneId:s.id,model,operation:'animate'}})});
    }
    await refresh();
    if(items.some(i=>changesShotAppearance(i.instruction))){setProgress('Appearance changes need a new still first. Your changes are saved. Regenerate and approve the still with the requested look, then animate it. No video credits were spent.');return;}
    setConfirmation({items});
  };
  const execute=async()=>{
    const batch=confirmation;if(!batch)return;setConfirmation(null);
    const items=batch.items.map(i=>({label:`Shot ${i.scene.scene_order+1}`,state:'waiting' as 'waiting'|'running'|'done'|'failed'}));setProgress('');
    try{
      await gen.run({slot:'shots',title:batch.items.length>1?'Your regenerated shots':'Your regenerated shot',stage:'Sending your shot to the animator…',expectedSeconds:120*batch.items.length,doneLabel:batch.items.length>1?'Your new shots are ready':'Your new shot is ready',paid:true,long:true,items,resultSelector:'[aria-label="Selected shot version"]',jobId:`shots-${batch.items[0]?.scene.project_id}`},async ctx=>{
      for(let i=0;i<batch.items.length;i++){
        const item=batch.items[i];items[i].state='running';ctx.setItems([...items]);ctx.setStage(`Animating shot ${item.scene.scene_order+1} · ${i+1} of ${batch.items.length}…`);
        const started=await animate({data:{sceneId:item.scene.id,model,requestKey:crypto.randomUUID(),revision:item.q.revision,confirmedCredits:item.q.customerCredits??0}});
        // One explicitly confirmed batch, sequential provider submissions; never retry a lost or failed job.
        const deadline=Date.now()+15*60*1000;
        while(true){
          await new Promise(resolve=>setTimeout(resolve,8000));await recover();
          const latest=await load({data:{projectId:item.scene.project_id}});
          const a=latest.attempts.find(a=>a.id===started.attemptId);await refresh();
          if(a?.status==='completed'){items[i].state='done';ctx.setItems([...items]);break;}
          if(a?.status==='failed'||a?.status==='submission_unknown'){items[i].state='failed';ctx.setItems([...items]);}
          if(a?.status==='failed'||a?.status==='submission_unknown')throw new Error(a.failure_reason??'Shot stopped. Your previous versions are safe.');
          if(Date.now()>deadline)throw new Error('Shot is still processing. Reopen this video to collect it; remaining shots were not charged.');
        }
      }
      });
      setProgress('New shots saved. Re-assemble to update your video.');
    }catch(e){setProgress('Stopped; previous versions are safe. Reopen this video to check the current shot.');throw e;}
  };
  const film=data.assemblies.find(j=>j.status==='completed'&&j.preview);
  return <section className="space-y-5 border-b border-border pb-6">
    <h2 className="text-2xl font-bold">Review your video</h2>
    {film?.preview?<video aria-label="Assembled film" controls playsInline src={film.preview} className="mx-auto aspect-[9/16] max-h-[640px] w-full bg-muted object-contain"/>:<p className="text-muted-foreground">Your assembled film will appear here. Your saved shots are below.</p>}
    <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Shot strip">{data.scenes.map(s=><Button key={s.id} variant="outline" aria-label={`Review shot ${s.scene_order+1}`} aria-pressed={s.id===selected} onClick={()=>setSelected(s.id)} className="h-auto w-24 shrink-0 flex-col gap-2 p-2">{s.preview?<img src={s.preview} alt={`Shot ${s.scene_order+1}`} className="aspect-[9/16] w-full object-cover"/>:<Film className="size-8"/>}<span>Shot {s.scene_order+1} · {s.duration}s</span></Button>)}</div>
    {scene&&<div className="space-y-4 border-t border-border pt-5">
      <h3 className="text-lg font-semibold">Shot {scene.scene_order+1}</h3>
      {current?.preview&&<video aria-label="Selected shot version" controls playsInline src={current.preview} className="aspect-[9/16] max-h-80 w-full bg-muted object-contain"/>}
      <label className="block text-sm font-medium">Saved versions · free to switch<Select value={current?.id??''} onValueChange={attemptId=>run(async()=>{await save({data:{sceneId:scene.id,attemptId}});await refresh();setProgress('Version selected. Re-assemble to update the film.');})}><SelectTrigger aria-label="Shot version" className="mt-2"><SelectValue placeholder="No completed versions yet"/></SelectTrigger><SelectContent>{versions.map((a,i)=><SelectItem value={a.id} key={a.id}>Version {versions.length-i} · {new Date(a.created_at).toLocaleDateString()}</SelectItem>)}</SelectContent></Select></label>
      <label className="block text-sm font-medium">Changes for this shot (optional)<Textarea aria-label="Shot regeneration instructions" className="mt-2" placeholder="Make the wave bigger, or slow the camera push" value={notes[scene.id]??''} onChange={e=>onChange({...value,shotInstructions:{...notes,[scene.id]:e.target.value}})}/></label>
      <PromptMagic projectId={scene.project_id} sceneId={scene.id} target="revision" value={notes[scene.id]??''} disabled={busy} onChange={text=>onChange({...value,shotInstructions:{...notes,[scene.id]:text}})}/><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={()=>run(async()=>{await save({data:{sceneId:scene.id,instruction:notes[scene.id]??''}});setProgress('Shot instructions saved to history.');await refresh();})}><Save className="size-4"/>Save shot instructions · free</Button><Button disabled={busy} onClick={()=>run(()=>prepare(false))}><RefreshCw className="size-4"/>Regenerate this shot · {cost(scene.duration)} video credits</Button></div>
      {!scene.approved_at&&<p className="text-sm text-status-warning">Review and approve this shot’s still in Make your content before animation. Your instructions stay saved.</p>}
      <details><summary className="cursor-pointer text-sm font-medium">Shot instruction history</summary>{(Array.isArray(scene.review_history)?scene.review_history:[]).map((h,i)=><p key={i} className="mt-2 text-sm text-muted-foreground">{String((h as {instruction?:string}).instruction??'')}</p>)}</details>
    </div>}
    <label className="block text-sm font-medium">Changes for the whole video (optional)<Textarea aria-label="Whole video regeneration instructions" className="mt-2" value={whole} onChange={e=>onChange({...value,wholeInstruction:e.target.value})}/></label>
    <PromptMagic projectId={data.selected?.id??''} target="revision" value={whole} disabled={busy||!data.selected} onChange={text=>onChange({...value,wholeInstruction:text})}/><div className="flex flex-wrap gap-3"><Button disabled={busy||!data.scenes.length} onClick={()=>run(()=>prepare(true))}><RefreshCw className="size-4"/>Regenerate whole video · {data.scenes.reduce((n,s)=>n+cost(s.duration),0)} video credits</Button><Button variant="outline" disabled={busy} onClick={onAssemble}><Film className="size-4"/>Re-assemble · view video-credit quote</Button></div>
    {progress.includes('Appearance changes')&&<Button variant="outline" onClick={onEditStills}>Update starting still · view plan-credit quote</Button>}{gen.ring('shots',false)}{progress&&<p role="status" className="text-sm text-muted-foreground">{progress}</p>}
    <Dialog open={!!confirmation} onOpenChange={open=>{if(!open)setConfirmation(null);}}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Confirm shot regeneration</DialogTitle></DialogHeader><p>{confirmation?.items.length} shot(s) · {confirmation?.items.reduce((n,i)=>n+(i.q.customerCredits??0),0)} video credits. Re-assembly is quoted separately. No plan credits.</p>{confirmation?.items.map(i=><div key={i.scene.id} className="space-y-2 border-t border-border pt-3"><p>Shot {i.scene.scene_order+1}: {i.q.customerCredits} video credits</p>{i.instruction&&<p className="whitespace-pre-wrap text-sm">{i.instruction}</p>}{i.q.reason&&<p className="text-sm text-status-warning">{i.q.reason}</p>}</div>)}{confirmation?.items.some(i=>!i.scene.approved_at)?<><p className="text-sm text-status-warning">Approve the saved stills before regenerating. Your instructions are already saved; no credits were charged.</p><Button onClick={()=>setConfirmation(null)}>Return to saved shots</Button></>:<Button disabled={busy||!!confirmation&&confirmation.items.reduce((n,i)=>n+(i.q.customerCredits??0),0)>data.videoBalance} onClick={()=>run(execute)}>Confirm regeneration</Button>}<p className="text-sm text-muted-foreground">Previously paid versions stay available. Failed attempts are refunded; unstarted shots are not charged.</p></DialogContent></Dialog>
  </section>;
}
import { GenerationProgress } from './GenerationProgress';
import { slideTo } from '@/lib/generation-jobs';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Film, ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ReviewCard } from './ReviewPostPrimitives';
import { InspirationStudio } from './InspirationStudio';
import { SourceKeyframes } from './SourceKeyframes';
import { getSourceKeyframes } from '@/lib/keyframes.functions';
import { getInspirationStudio, manageInspirationReference } from '@/lib/inspiration.functions';
import { generateRemixDirections, prefillRemixStoryboard } from '@/lib/video-remake.functions';
import { REMIX_IDEAS_COST, keepsLine, changesLine, pickActiveDirection, needsStoryboardReplace, startingDirections, withFaithfulFirst, sourceShots, prefillRemixScenes, type Direction } from '@/lib/remix-directions';
import { sourceAudioProposal } from '@/lib/video-remake';
import { CREDIT_BALANCE_KEY } from '@/lib/credits';

export function RemixDirectionsPanel({analysis,projectId,value={},onChange,onSpeech,mode}:{mode?:string;analysis:any;projectId:string;value?:Record<string,unknown>;onChange:(v:Record<string,unknown>)=>void;onSpeech:(v:'voiceover'|'silent')=>void}) {
  const qc=useQueryClient(), generate=useServerFn(generateRemixDirections), prepare=useServerFn(prefillRemixStoryboard), load=useServerFn(getInspirationStudio), manage=useServerFn(manageInspirationReference), loadKf=useServerFn(getSourceKeyframes);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[ideasAt,setIdeasAt]=useState<number|null>(null),[ideasErr,setIdeasErr]=useState('');
  const {data}=useQuery({queryKey:['remix-references',projectId],queryFn:()=>load({data:{projectId}})});
  const {data:kf}=useQuery({queryKey:['source-keyframes',analysis.analysisId??analysis.id],queryFn:()=>loadKf({data:{analysisId:analysis.analysisId??analysis.id}})});
  const patch=(p:Record<string,unknown>)=>onChange({...value,...p});
  const edits=(value.remakeEdits as Record<string,string>|undefined)??{};
  const directions=withFaithfulFirst(analysis,(value.remixDirections as Direction[]|undefined)??startingDirections(analysis)).map(d=>d.faithful?{...d,edits}:d);
  const active=pickActiveDirection(directions,value,mode);
  const instructions=String(value.remixInstructions??''), ideaNotes=String(value.remixIdeaNotes??'');
  const ids=(value.referenceIds as string[]|undefined)??[];
  const audio=sourceAudioProposal(analysis), speech=(value.speechMode as 'voiceover'|'silent'|undefined)??audio.speechMode;
  const shots=sourceShots(analysis), preview=active?prefillRemixScenes(analysis,active,instructions,ids,speech):[];
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setStatus('');try{await fn();}catch(e){setStatus((e as Error).message);toast.error((e as Error).message);}finally{setBusy(false);}};
  const upload=async(file:File,kind:'character_face'|'product'|'setting')=>{
    const base64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});
    await manage({data:{action:'upload',kind,filename:file.name,mime:file.type as 'image/png'|'image/jpeg'|'image/webp',base64}});
    const updated=await load({data:{projectId}}), old=new Set(data?.references.map(r=>r.id)??[]);
    patch({referenceIds:[...ids,...updated.references.filter(r=>!old.has(r.id)).map(r=>r.id)].slice(0,5)});
    await qc.invalidateQueries({queryKey:['remix-references',projectId]});
    setStatus('Reference uploaded and selected.');
  };
  return <div className="space-y-6">
    <ReviewCard title="Choose your remix direction" icon={Film}>
      <p className="mb-4 text-review-muted">{analysis.evidence?.videoVerification?'Based on your two-pass verified shot list.':'Starting directions use your saved breakdown; they have not had the new two-pass verification.'}</p>
      <div className="grid gap-4 sm:grid-cols-2">{directions.map(d=><Button key={d.id} variant="outline" aria-pressed={active?.id===d.id} className={`wizard-choice ${active?.id===d.id?'wizard-selected':''}`} onClick={()=>patch({remixDirectionId:d.id,remixDirection:d,remixDirectionPicked:true})}><span className="flex w-full min-w-0 items-start justify-between gap-3 text-lg font-semibold"><span className="min-w-0 whitespace-normal">{!d.faithful&&<span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-review-muted">Bigger change</span>}{d.title}{d.faithful&&<span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-review-accent">Recommended</span>}</span>{active?.id===d.id&&<Check className="size-5 shrink-0"/>}</span><span className="whitespace-normal text-left font-normal">{d.pitch}</span><span className="whitespace-normal text-left text-sm font-normal text-review-muted">Changes: {changesLine(d)}</span><span className="whitespace-normal text-left text-sm font-normal">{d.faithful?'Keeps: ':''}{keepsLine(d)}</span></Button>)}</div>
      {active?.faithful&&<div className="mt-5 rounded-lg border border-border bg-card p-4"><p className="font-semibold">What to change (optional)</p><p className="mb-3 text-sm text-review-muted">Leave anything blank and it stays the same as the source. To use your own person, upload a character image below.</p><SourceKeyframes analysisId={analysis.analysisId??analysis.id} onAppearance={a=>{const next={...edits,person:edits.person||a.person,outfit:edits.outfit||a.outfit};patch({remakeEdits:next,remixDirection:{...active,edits:next}});}}/><div className="mt-4 grid gap-3 sm:grid-cols-2">{([['person','Person','e.g. a new original woman, athletic build'],['outfit','Outfit','Blank = the source outfit style'],['setting','Background / setting tweak','e.g. add a plant by the door'],['words','What they say / on-screen text','Blank = no on-screen text']] as const).map(([k,label,ph])=><label key={k} className="block min-w-0 text-sm font-medium">{label}<Input aria-label={label} className="mt-1" placeholder={ph} value={edits[k]??''} onChange={e=>{const next={...edits,[k]:e.target.value};patch({remakeEdits:next,remixDirection:{...active,edits:next}});}}/></label>)}</div></div>}
      <label className="mt-5 block font-medium">Or describe your own direction<Textarea aria-label="Your remix instructions" className="mt-2 min-h-24 text-base" placeholder="Add a new subject, setting, angle or message—or leave this empty to use the selected card." value={instructions} onChange={e=>patch({remixInstructions:e.target.value})}/></label>
      <details className="mt-4"><summary className="cursor-pointer font-medium">Optional instructions for new ideas</summary><Textarea aria-label="Instructions for remix ideas" className="mt-3 text-base" value={ideaNotes} onChange={e=>patch({remixIdeaNotes:e.target.value})}/></details>
      <Button className="mt-4 h-auto min-h-11 whitespace-normal" disabled={busy} onClick={()=>run(async()=>{setIdeasAt(Date.now());setIdeasErr('');try{const result=await generate({data:{analysisId:analysis.analysisId??analysis.id,instructions:ideaNotes,requestId:crypto.randomUUID()}});patch({remixDirections:result.directions,remixUsage:result.usage});await qc.invalidateQueries({queryKey:CREDIT_BALANCE_KEY});setStatus('New remix ideas are ready.');toast.success('Your new ideas are ready');slideTo('.wizard-choice');}catch(e){setIdeasErr((e as Error).message);throw e;}finally{setIdeasAt(null);}})}>{busy?<Loader2 className="size-4 shrink-0 animate-spin"/>:<Film className="size-4 shrink-0"/>}{value.remixDirections?'Regenerate ideas':'Generate tailored ideas'} · {REMIX_IDEAS_COST} plan credit</Button>{ideasAt&&<div className="mt-4"><GenerationProgress compact stage="Thinking up new directions…" startedAt={ideasAt} expectedSeconds={25}/></div>}{ideasErr&&!ideasAt&&<div className="mt-4"><GenerationProgress compact status="error" stage="" startedAt={0} expectedSeconds={25} error={ideasErr} refunded/></div>}
    </ReviewCard>
    <ReviewCard title="Optional reference images" icon={ImagePlus}>
      <div className="grid gap-4 sm:grid-cols-3">{([{kind:'character_face',label:'Your character'},{kind:'product',label:'Your product'},{kind:'setting',label:'Your setting'}] as const).map(r=><label key={r.kind} className="min-w-0 font-medium">{r.label}<Input type="file" aria-label={`Upload ${r.label.toLowerCase()}`} accept="image/png,image/jpeg,image/webp" className="mt-2 max-w-full" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)run(()=>upload(f,r.kind));}}/></label>)}</div>
      <p className="mt-3 text-sm text-review-muted">Use your own references. Identity comes from these images, never the source person’s likeness.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{data?.references.filter(r=>['character_face','character_body','character_back','product','setting'].includes(r.kind)).map(r=><Button key={r.id} variant="outline" aria-pressed={ids.includes(r.id)} className={`wizard-choice min-w-0 ${ids.includes(r.id)?'wizard-selected':''}`} onClick={()=>patch({referenceIds:ids.includes(r.id)?ids.filter(id=>id!==r.id):[...ids,r.id].slice(0,5)})}><img src={r.preview??''} alt={r.filename} className="aspect-square w-full object-contain"/><span className="block w-full truncate">{r.filename}</span></Button>)}</div>
    </ReviewCard>
    <ReviewCard title="Your storyboard proposal" icon={Film}>
      <label className="block font-medium">Spoken words<select aria-label="Remix spoken words" className="mt-2 w-full rounded-md border border-input bg-background p-3" value={speech} onChange={e=>{const mode=e.target.value as 'voiceover'|'silent';patch({speechMode:mode});onSpeech(mode);}}><option value="voiceover">Original voiceover</option><option value="silent">No talking</option></select></label>
      <p className="mt-3 text-review-muted">{shots.length} saved shots → {preview.length} editable scenes. {audio.note}</p>
      <ol className="mt-4 divide-y divide-review-border">{preview.map((s,i)=><li key={i} className="py-4"><p className="font-semibold">Scene {i+1} · {s.duration}s</p><p className="mt-1 break-words">{s.action}</p><p className="mt-2 text-sm text-review-muted">{s.environment} · {s.camera}</p><p className="mt-1 text-sm text-review-muted">{s.sourceTimingNote}</p></li>)}</ol>
      <Button className="mt-4 h-auto min-h-11 whitespace-normal" disabled={busy} onClick={()=>run(async()=>{if(!active)return;const result=await prepare({data:{projectId,direction:active,instructions,referenceIds:ids,speechMode:speech,replace:needsStoryboardReplace(active,data?.scenes??[],!!analysis.evidence?.remakeRefs?.keyframes?.length||!!kf?.keyframes.length)}});patch({remixDirectionId:active.id,remixDirection:active,remixInstructions:instructions,remixShots:shots,prepared:true,speechMode:speech});onSpeech(speech);await qc.invalidateQueries({queryKey:['inspiration-studio']});await qc.invalidateQueries({queryKey:['remix-references',projectId]});setStatus(`${result.scenes} storyboard scenes saved. Open Advanced to edit any field, or press Next.`);})}><Check className="size-4 shrink-0"/>{data?.scenes.length&&!needsStoryboardReplace(active,data.scenes,!!kf?.keyframes.length)?'Keep saved storyboard':'Use this direction in my storyboard'} · 0 credits</Button>
      {!!data?.scenes.length&&<Button variant="outline" className="ml-0 mt-3 h-auto min-h-11 whitespace-normal sm:ml-3" disabled={busy} onClick={()=>run(async()=>{if(!active)return;const result=await prepare({data:{projectId,direction:active,instructions,referenceIds:ids,speechMode:speech,replace:true}});patch({remixDirectionId:active.id,remixDirection:active,remixInstructions:instructions,remixShots:shots,prepared:true,speechMode:speech});await qc.invalidateQueries({queryKey:['inspiration-studio']});await qc.invalidateQueries({queryKey:['remix-references',projectId]});setStatus(`Storyboard replaced with “${active.title}” (${result.scenes} scenes). Earlier stills stay in history.`);})}>Replace saved storyboard with this direction · 0 credits</Button>}
      <p className="mt-3 text-sm text-review-muted">Optional AI storyboard writing remains {data?.storyboardPlanCredits??2} plan credits in Advanced. Stills, animation and narration have separate quotes.</p>
    </ReviewCard>
    {status&&<p role="status" className="break-words text-base">{status}</p>}
    <details className="review-card"><summary className="cursor-pointer font-semibold">Advanced — edit storyboard scenes</summary><div className="mt-5"><InspirationStudio projectId={projectId} wizardStage="words" speechMode={speech} wizardBrief={`${active?.title??''}. ${instructions}`.slice(0,600)}/></div></details>
  </div>;
}
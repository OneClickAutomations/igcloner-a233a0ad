import { useGenJob } from "./useGenJob";
import { GenerationProgress } from './GenerationProgress';
import { startJob, finishJob } from '@/lib/generation-jobs';
import { useEffect,useState,useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Film,Download,Loader2,Mic,SlidersHorizontal } from 'lucide-react';
import { ReviewCard } from './ReviewPostPrimitives';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from './ui/dialog';
import { AssemblyOptions,parseSrt,captionsToSrt,type AssemblySettings } from '@/lib/assembly';
import { generateProofNarration } from '@/lib/film-narration.functions';
import { quoteAssembly,startAssembly,recoverAssembly,uploadAssemblyMedia } from '@/lib/assembly.functions';
import { VideoPackAvailability } from './VideoPackAvailability';
import { STUDIO_PRICING } from '@/lib/studio-pricing';
import type { getInspirationStudio } from '@/lib/inspiration.functions';
import { AdvancedVoiceSettings } from './AdvancedVoiceSettings';
import { VOICE_CATALOG } from '@/lib/voice-catalog';
import { Switch } from './ui/switch';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from './ui/select';
import { FilmShotReview } from './FilmShotReview';
import { saveFilmReviewSettings,writeReviewNarration,getFilmVoicePreview } from '@/lib/film-review.functions';
import { ACTION_COSTS } from '@/lib/credits';
function DeliveryCard({wizard,title,icon,trailing,children}:React.ComponentProps<typeof ReviewCard>&{wizard:boolean}) {return wizard?<ReviewCard title={title} icon={icon} trailing={trailing}>{children}</ReviewCard>:<section className="border-b border-border pb-6"><h2 className="text-xl font-semibold">{title}</h2>{children}</section>;}
type Data=Awaited<ReturnType<typeof getInspirationStudio>>;
export function AssemblyDelivery({data,busy,run,refresh,downloadClips,wizardDraft,onWizardDraft,speechMode='voiceover',wizard=false,direction}:{data:Data;busy:boolean;run:(fn:()=>Promise<unknown>)=>Promise<void>;refresh:()=>Promise<void>;downloadClips:()=>Promise<void>;wizardDraft?:Record<string,unknown>;onWizardDraft?:(draft:Record<string,unknown>)=>void;speechMode?:'voiceover'|'silent';wizard?:boolean;direction?:unknown}) {
  wizardDraft=wizardDraft??(data.selected?.review_settings as Record<string,unknown>|undefined);
  const quote=useServerFn(quoteAssembly),start=useServerFn(startAssembly),recover=useServerFn(recoverAssembly),upload=useServerFn(uploadAssemblyMedia),narrate=useServerFn(generateProofNarration);
  const gen=useGenJob();
  const saveReview=useServerFn(saveFilmReviewSettings),writeScript=useServerFn(writeReviewNarration),previewVoice=useServerFn(getFilmVoicePreview);
  const latestDraft=useRef<Record<string,unknown>>({});
  const [addVoice,setAddVoice]=useState(Boolean(wizardDraft?.addVoice??(speechMode==='voiceover'))),[addMusic,setAddMusic]=useState(Boolean(wizardDraft?.addMusic??false));
  const [script,setScript]=useState(String(wizardDraft?.script??data.narration?.script??data.scenes.map(s=>(s.scene_input as {voiceover?:string})?.voiceover??'').filter(Boolean).join(' ')));
  const [scriptNotes,setScriptNotes]=useState(String(wizardDraft?.scriptNotes??'')),[mood,setMood]=useState(String(wizardDraft?.mood??'Warm'));
  const [review,setReview]=useState<Record<string,unknown>>((wizardDraft?.review as Record<string,unknown>)??{});
  const previewAudio=useRef<HTMLAudioElement|null>(null);
  const initial=AssemblyOptions.safeParse(wizardDraft?.settings??{});
  const savedNarration=data.narration;
  const [voiceId,setVoiceId]=useState(String(wizardDraft?.voiceId??savedNarration?.voice_id??data.voiceRecommendation.voice.id));
  const voice=VOICE_CATALOG.find(v=>v.id===voiceId)??data.voiceRecommendation.voice;
  const [settings,setSettings]=useState<AssemblySettings>({...AssemblyOptions.parse(initial.success?initial.data:{}),...(speechMode==='voiceover'&&savedNarration?.result_path?{voiceoverPath:savedNarration.result_path,voiceoverDuration:Number(savedNarration.duration_seconds)}:{})}),[srt,setSrt]=useState(String(wizardDraft?.srt??(savedNarration?.captions?captionsToSrt(savedNarration.captions as {start:number;end:number;text:string}[],data.scenes.reduce((t,s)=>t+s.duration,0)):''))),[names,setNames]=useState<Record<string,string>>((wizardDraft?.names as Record<string,string>)??{});
  useEffect(()=>{const next={settings,srt,names,voiceId,addVoice,addMusic,script,scriptNotes,mood,review};latestDraft.current=next;if(onWizardDraft&&JSON.stringify(next)!==JSON.stringify(wizardDraft))onWizardDraft(next);},[settings,srt,names,voiceId,addVoice,addMusic,script,scriptNotes,mood,review]);
  useEffect(()=>{
    if(!data.selected)return;
    const projectId=data.selected.id;
    const save=()=>saveReview({data:{projectId,settings:latestDraft.current}});
    const timer=setTimeout(()=>save().catch(()=>{}),800);
    const listener=(event:Event)=>{const detail=(event as CustomEvent<{tasks:Promise<unknown>[]}>) .detail;detail?.tasks.push(save());};
    window.addEventListener('creation-save',listener);
    return()=>{clearTimeout(timer);window.removeEventListener('creation-save',listener);};
  },[data.selected?.id,settings,srt,names,voiceId,addVoice,addMusic,script,scriptNotes,mood,review]);
  useEffect(()=>()=>{previewAudio.current?.pause();},[]);
  const [confirmation,setConfirmation]=useState<{result:Awaited<ReturnType<typeof quoteAssembly>>;options:AssemblySettings;requestKey:string}|null>(null);
  const project=data.selected;const jobs=data.assemblies;const active=jobs.some(j=>['claimed','submitting','queued','fetching','rendering','saving'].includes(j.status));
  useEffect(()=>{if(!project)return;recover({data:{projectId:project.id}}).then(refresh).catch(()=>{});},[project?.id]);
  useEffect(()=>{if(!active||!project)return;const timer=setInterval(()=>recover({data:{projectId:project.id}}).then(refresh).catch(()=>{}),8000);return()=>clearInterval(timer);},[active,project?.id,recover]);
  useEffect(()=>{if(active)startJob({id:`assembly-${project?.id}`,kind:'assembly',title:'Your video',href:window.location.pathname+window.location.search,expectedSeconds:60,doneLabel:'Your video is ready',long:true});else{const done=jobs.find(j=>j.status==='completed');if(done)finishJob(`assembly-${project?.id}`,true,{resultSelector:`#assembly-${done.id}`});}},[active]);
  useEffect(()=>{if(jobs.some(j=>j.status==='completed'))window.dispatchEvent(new Event('content-generated'));},[jobs.filter(j=>j.status==='completed').map(j=>j.id).join(',')]);
  if(!project)return null;
  const uploadFile=async(file:File,kind:'voiceover'|'music'|'logo')=>{
    if(file.size>10*1024*1024)throw new Error('Maximum file size is 10MB.');
    let duration:number|undefined;
    if(kind!=='logo'){const url=URL.createObjectURL(file);try{duration=await new Promise<number>((resolve,reject)=>{const audio=new Audio();audio.preload='metadata';audio.onloadedmetadata=()=>Number.isFinite(audio.duration)?resolve(audio.duration):reject(new Error('Audio duration could not be read.'));audio.onerror=()=>reject(new Error('Audio could not be read.'));audio.src=url;});}finally{URL.revokeObjectURL(url);}}
    const base64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});
    const result=await upload({data:{projectId:project.id,kind,mime:file.type as 'audio/mpeg',base64}});
    setSettings(old=>({...old,[`${kind}Path`]:result.path,...(kind==='voiceover'?{voiceoverDuration:duration}:{})}));setNames(n=>({...n,[kind]:file.name}));
  };
  const completed=data.attempts.filter(a=>a.operation==='animate'&&a.status==='completed');
  const renderQuote=async()=>{
    const options=AssemblyOptions.parse({...settings,...(!addVoice?{voiceoverPath:undefined,voiceoverDuration:undefined}:{}),...(!addMusic?{musicPath:undefined}:{}),captions:srt.trim()?parseSrt(srt):[]});
    const result=await quote({data:{projectId:project.id,options}});setConfirmation({result,options,requestKey:crypto.randomUUID()});
  };

  return <>
    <FilmShotReview data={data} busy={busy} run={run} refresh={refresh} value={review} onChange={setReview} onAssemble={()=>run(renderQuote)}/>
    {jobs.some(j=>j.status==='completed')&&<p className="mb-5 text-base">Your finished video is saved to your content library. <Link to="/library" search={{projectId:project.id}} className="text-primary underline">Open video in library</Link></p>}
    <DeliveryCard wizard={wizard} title="Narration" icon={Mic} trailing={wizard?<span data-state={settings.voiceoverPath?'done':undefined} className="wizard-score">{busy?'In progress':settings.voiceoverPath?'Done':'Not started'}</span>:undefined}>
      <label className="mt-4 flex items-center gap-3 font-medium"><Switch aria-label="Add voiceover" checked={addVoice} onCheckedChange={setAddVoice}/>Add voiceover</label>
      {addVoice&&<>
      {!data.narrationConfigured&&<p role="status" className="mt-3 text-sm text-status-warning">ElevenLabs is not configured. Upload narration below, or turn off Add voiceover and render without it.</p>}
      <AdvancedVoiceSettings voiceId={voiceId} recommendation={data.voiceRecommendation} onChange={setVoiceId}/>
      <Button variant="outline" className="mt-3" disabled={busy||!data.narrationConfigured} onClick={()=>run(async()=>{const result=await previewVoice({data:{voiceId}});if(!result.url)throw new Error('No saved preview is available for this voice.');previewAudio.current?.pause();previewAudio.current=new Audio(result.url);await previewAudio.current.play();})}>Preview {voice.name} · free</Button>
      {savedNarration&&savedNarration.voice_id!==voiceId&&<p role="status" className="mt-3 text-sm text-status-warning">Generate narration to apply {voice.name}; your existing audio stays unchanged until then.</p>}
      <label className="mt-4 block text-sm font-medium">Spoken script<Textarea aria-label="Film voiceover script" className="mt-2 min-h-28" value={script} onChange={e=>setScript(e.target.value)}/></label>
      {!script&&<p className="mt-2 text-sm text-status-warning">No spoken lines were saved. Write a script below or skip voiceover.</p>}
      <label className="mt-3 block text-sm font-medium">Script changes (optional)<Textarea aria-label="Voiceover script instructions" className="mt-2" value={scriptNotes} onChange={e=>setScriptNotes(e.target.value)}/></label>
      <Button variant="outline" className="mt-3" disabled={busy} onClick={()=>run(async()=>{const result=await gen.run({slot:"script",title:"Your voiceover script",stage:"Writing your voiceover script…",expectedSeconds:25,doneLabel:"Your voiceover script is ready",paid:true,resultSelector:"[aria-label='Film voiceover script']"}, () => writeScript({data:{projectId:project.id,instructions:scriptNotes,direction,requestId:crypto.randomUUID()}}));setScript(result.script);})}>{script?'Regenerate':'Write'} script · {ACTION_COSTS.captionPack} plan credit</Button>{gen.ring('script')}
      {!data.assemblyConfigured&&<p className="mt-3 text-sm text-status-warning">Shotstack key missing. No rendering charges.</p>}
      <><Button className="mt-4" disabled={busy||active||!data.narrationConfigured||!script.trim()} onClick={()=>run(async()=>{const n=await gen.run({slot:"narration",title:"Your narration",stage:"Recording narration and timing captions…",expectedSeconds:45,doneLabel:"Your narration is ready",paid:true,long:true}, () => narrate({data:{projectId:project.id,requestKey:crypto.randomUUID(),regenerate:true,voiceId,script}}));setSettings(s=>({...s,voiceoverPath:n.result_path??undefined,voiceoverDuration:Number(n.duration_seconds)}));setSrt(captionsToSrt(n.captions as {start:number;end:number;text:string}[],data.scenes.reduce((t,s)=>t+s.duration,0)));setNames(s=>({...s,voiceover:`${voice.name} · ElevenLabs · speech-timed captions`}));await refresh();})}>{!script.trim()?'Write a script first':settings.voiceoverPath?'Regenerate narration':'Generate narration'} + captions · {STUDIO_PRICING.video.narrationCredits} video credit{STUDIO_PRICING.video.narrationCredits===1?'':'s'}</Button>{gen.ring('narration')}</>
      </>}
    </DeliveryCard>
    <DeliveryCard wizard={wizard} title="Music" icon={SlidersHorizontal}>
      <label className="mt-4 flex items-center gap-3 font-medium"><Switch aria-label="Add music" checked={addMusic} onCheckedChange={setAddMusic}/>Add music</label>
      {addMusic&&<div className="mt-4 space-y-4"><p className="text-sm text-status-warning">Music library unavailable. Upload music you have permission to use below; otherwise the video renders without music.</p><label className="block text-sm font-medium">Music mood<Select value={mood} onValueChange={setMood}><SelectTrigger aria-label="Music mood" className="mt-2"><SelectValue/></SelectTrigger><SelectContent>{['Warm','Energetic','Calm','Dramatic','Ambient'].map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></label><label className="block text-sm font-medium">Music volume · {Math.round(settings.musicVolume*100)}%<Input aria-label="Music volume" type="range" min="0" max="100" value={Math.round(settings.musicVolume*100)} onChange={e=>setSettings(s=>({...s,musicVolume:Number(e.target.value)/100}))}/></label><p className="text-sm text-muted-foreground">Music automatically lowers while narration plays. Mood is saved as your preference; it does not generate music.</p></div>}
    </DeliveryCard>
    <DeliveryCard wizard={wizard} title={data.assemblyConfigured?'Put your video together':'Assembly not configured yet'} icon={Film} trailing={wizard?<span data-state={jobs.some(j=>j.status==='completed')?'done':jobs.some(j=>j.failure_reason)?'warning':undefined} className="wizard-score">{active?'In progress':jobs.some(j=>j.status==='completed')?'Done':jobs.some(j=>j.failure_reason)?'Needs attention':'Not started'}</span>:undefined}>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">{(['voiceover','music','logo'] as const).map(kind=><label key={kind} className="text-sm capitalize">{kind==='voiceover'?'Voiceover audio':kind==='music'?'Licensed background music':'Logo'}<Input type="file" className="mt-2" aria-label={`Assembly ${kind}`} accept={kind==='logo'?'image/png,image/jpeg,image/webp':'audio/mpeg,audio/wav,audio/mp4'} disabled={busy||active} onChange={e=>{const file=e.target.files?.[0];if(file)run(()=>uploadFile(file,kind));}}/>{names[kind]&&<span className="mt-2 block break-words text-xs text-muted-foreground">{names[kind]}</span>}{settings[`${kind}Path`]&&<Button size="sm" variant="ghost" onClick={()=>{setSettings(old=>({...old,[`${kind}Path`]:undefined,...(kind==='voiceover'?{voiceoverDuration:undefined}:{})}));setNames(old=>({...old,[kind]:''}));}}>Remove</Button>}</label>)}</div>
      <label className="mt-5 block text-sm">Timed captions · SRT<Textarea aria-label="Assembly captions SRT" className="mt-2 min-h-28" value={srt} onChange={e=>setSrt(e.target.value)} disabled={busy||active}/></label>
      <div className="mt-4 flex flex-wrap items-end gap-4"><label className="text-sm">Transition<select aria-label="Assembly transition" className="ml-3 rounded-md border border-input bg-background p-2" value={settings.transition} onChange={e=>setSettings(s=>({...s,transition:e.target.value as 'none'|'fade'}))}><option value="none">Cut</option><option value="fade">Fade</option></select></label>{settings.logoPath&&<><label className="text-sm">Logo start (s)<Input aria-label="Logo start" type="number" min="0" value={settings.logoStart} onChange={e=>setSettings(s=>({...s,logoStart:Number(e.target.value)}))}/></label><label className="text-sm">Logo end (s)<Input aria-label="Logo end" type="number" min="0" value={settings.logoEnd??''} onChange={e=>setSettings(s=>({...s,logoEnd:e.target.value?Number(e.target.value):undefined}))}/></label></>}</div>
      {addVoice&&!settings.voiceoverPath&&<p className="mt-4 text-sm text-status-warning">No narration generated yet. Generate it above, or render now without narration. Rendering never generates paid audio automatically.</p>}
      <div className="mt-5 flex flex-wrap gap-3"><Button disabled={!data.assemblyConfigured||busy||active||!data.scenes.length} onClick={()=>run(renderQuote)}><Film className="size-4"/> Render video · view video-credit quote</Button><Button variant="outline" disabled={!completed.length||busy} onClick={()=>run(downloadClips)}><Download className="size-4"/> Download all clips ({completed.length})</Button></div>
    </DeliveryCard>
    {jobs.map(j=><section key={j.id} id={j.status==='completed'?`assembly-${j.id}`:undefined} className="border-b border-border py-6"><h3 className="font-semibold">{j.status==='completed'?'Finished video':j.status==='submission_unknown'?'Submission needs reconciliation':`Assembly · ${j.status}`}</h3>{['claimed','submitting','queued','fetching','rendering','saving'].includes(j.status)&&<div className="mt-3"><GenerationProgress stage={j.status==='saving'?'Saving your video…':j.status==='fetching'?'Gathering your clips…':j.status==='rendering'?'Joining your clips…':'Getting your video ready…'} percent={({claimed:5,submitting:10,queued:15,fetching:35,rendering:60,saving:90} as Record<string,number>)[j.status]} startedAt={new Date(j.created_at).getTime()} expectedSeconds={60} note="You can leave this page — we’ll tell you when it’s done"/></div>}{j.failure_reason&&(j.status==='failed'||j.status==='rejected'||j.refunded_at)?<div className="mt-3"><GenerationProgress status="error" stage="" startedAt={new Date(j.created_at).getTime()} expectedSeconds={60} error={j.failure_reason} refunded={Boolean(j.refunded_at)} onRetry={data.assemblyConfigured&&!active?()=>run(renderQuote):undefined}/></div>:j.failure_reason&&<p role="alert" className="mt-3 break-words text-sm text-status-warning">{j.failure_reason}</p>}{j.preview&&<><video controls playsInline src={j.preview} className="mt-4 aspect-[9/16] w-full max-w-80 bg-muted object-contain"/><Button variant="outline" className="mt-3" onClick={()=>run(async()=>{const res=await fetch(j.preview??'');if(!res.ok)throw new Error('Video download failed.');const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download='igcloner-video.mp4';a.click();URL.revokeObjectURL(url);})}><Download className="size-4"/> Download MP4</Button></>}<p className="mt-3 text-xs text-muted-foreground">{j.duration_seconds}s · {j.environment==='stage'?'Sandbox test':`Estimated render $${Number(j.render_quote_usd).toFixed(4)}`} · {j.billed} {j.billing_balance} credits{j.refunded_at?' · refunded':''}</p></section>)}
    <Dialog open={Boolean(confirmation)} onOpenChange={open=>{if(!open)setConfirmation(null);}}><DialogContent><DialogHeader><DialogTitle>Confirm assembly quote</DialogTitle></DialogHeader>{confirmation?.result.quote&&<><p>720 × 1280 · MP4 · {confirmation.result.quote.seconds} seconds</p><p>Rendering: ${confirmation.result.quote.renderUsd.toFixed(4)} estimated · {confirmation.result.quote.customerCredits} video credits · {confirmation.result.quote.proposed?'proposed':'approved'}</p><p className="text-sm text-muted-foreground">{confirmation.result.quote.environment==='stage'?'Shotstack sandbox key · free test, watermark may appear.':'Render-only price; successful scene clips are already paid. Existing narration/music uploads incur no new generation charge.'}</p>{'video' in confirmation.result&&confirmation.result.video&&<><p>{confirmation.result.video.equivalent}</p><p>{confirmation.result.video.afterwards}</p>{!confirmation.result.video.sufficient&&<VideoPackAvailability/>}</>}<p className="text-sm">Plan credits separately: stills already paid (new still price unset); manual storyboard 0; cached analysis import 0. No new plan charge. Uploaded voiceover: 0 new generation credits.</p><p className="text-sm">Music is lowered during the supplied voiceover interval.</p><Button disabled={busy||(confirmation.result.quote.environment!=='stage'&&confirmation.result.quote.proposed)||('video' in confirmation.result&&!confirmation.result.video?.sufficient)} onClick={()=>run(async()=>{const c=confirmation;if(!c?.result.quote)return;await start({data:{projectId:project.id,options:c.options,requestKey:c.requestKey,confirmedCredits:c.result.quote.customerCredits,clips:c.result.clips}});setConfirmation(null);})}><Film className="size-4"/> Confirm render</Button></>}{confirmation?.result.reason&&<p role="alert">{confirmation.result.reason}</p>}</DialogContent></Dialog>
  </>;
}
import { useGenJob } from "./useGenJob";
import { useEffect, useRef, useState } from 'react';
import './film-publish.css';
import { useServerFn } from '@tanstack/react-start';
import { useSearch } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, ChevronLeft, ChevronRight, Globe, Loader2, Pencil, Save, Send, Sparkles, X } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { getLibraryContent, saveLibraryContent } from '@/lib/content-library.functions';
import { generateCaptionPack, rewritePublishCard } from '@/lib/copy.functions';
import { generateConnectUrl, syncAccounts } from '@/lib/upload-post.functions';
import { publishContent, pollPublishingStatus } from '@/lib/publishing.functions';
import { ACTION_COSTS, CREDIT_BALANCE_KEY } from '@/lib/credits';
import { PUBLISHING_PLATFORMS, PLATFORM_META, PLATFORM_CAPABILITY_MATRIX, platformIncompatibilityReason, resolvePublishingError, type PublishingPlatform } from '@/lib/upload-post/shared';
import { finalCaption, tagList, publishingLimit, type PlatformCopy } from '@/lib/content-library';
import { cardLimit, fitCard, deliveryStatus, failureFix, videoWarnings, type CopyField } from '@/lib/film-publish';

const emptyCopy = (): PlatformCopy => ({title:'',description:'',caption:'',hashtags:''});

export function PublishStatusCards({ results, onFix }: { results: any[]; onFix: (platform: PublishingPlatform, action: string) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2" aria-label="Publishing results">{results.map(r => {
    const status=deliveryStatus(r.status), fix=failureFix(r.error_code ?? '', r.error_message ?? '');
    return <article key={r.platform} className="rounded-lg border border-border bg-card p-5"><div className="flex justify-between gap-3"><h3 className="font-bold">{PLATFORM_META[r.platform as PublishingPlatform]?.label ?? r.platform}</h3><span className={status==='Failed'?'text-destructive':status==='Posted'?'text-review-accent':'text-muted-foreground'}>{status}</span></div>{r.post_url&&<a className="mt-3 block text-primary underline" href={r.post_url} target="_blank" rel="noreferrer">View live post ↗</a>}{status==='Failed'&&<><p className="my-3 text-sm text-muted-foreground">{fix.message}</p><Button variant="outline" onClick={()=>onFix(r.platform,fix.label)}>{fix.label}</Button></>}</article>;
  })}</div>;
}

export function FilmPublishScreen({ projectId, draftId, onSaveDraft }: {projectId:string;draftId:string;onSaveDraft:()=>void}) {
  const search=useSearch({from:'/_authenticated/app'});
  const load=useServerFn(getLibraryContent),save=useServerFn(saveLibraryContent),pack=useServerFn(generateCaptionPack),rewrite=useServerFn(rewritePublishCard),connectFn=useServerFn(generateConnectUrl),sync=useServerFn(syncAccounts),publish=useServerFn(publishContent),poll=useServerFn(pollPublishingStatus);
  const gen=useGenJob();
  const qc=useQueryClient();
  const {data,error}=useQuery({queryKey:['library-content',projectId],queryFn:()=>load({data:{id:projectId}})});
  const [initialized,setInitialized]=useState(false),[stage,setStage]=useState(0),[selected,setSelected]=useState<PublishingPlatform[]>([]),[copies,setCopies]=useState<Record<string,PlatformCopy>>({}),[date,setDate]=useState(''),[time,setTime]=useState(''),[timezone,setTimezone]=useState(''),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[editing,setEditing]=useState(''),[magic,setMagic]=useState(''),[instruction,setInstruction]=useState(''),[confirmation,setConfirmation]=useState<'now'|'schedule'|null>(null),[result,setResult]=useState<any>(null),[jobId,setJobId]=useState('');
  const [videoInfo,setVideoInfo]=useState<{duration:number;width:number;height:number;bytes?:number}|null>(null);
  const pending=useRef<Promise<unknown>>(Promise.resolve()),lastSaved=useRef(''),syncStarted=useRef(false);
  const wrapup={selected,copies,date,time,timezone,publishStage:stage};
  const snapshot=useRef(wrapup);snapshot.current=wrapup;
  const persist=(value=snapshot.current)=>{
    const task=pending.current.catch(()=>{}).then(async()=>{const saved=await save({data:{id:projectId,wrapup:value}});qc.setQueryData(['library-content',projectId],(old:Awaited<ReturnType<typeof getLibraryContent>>|undefined)=>old?{...old,item:{...old.item,project_data:{...old.item.project_data,wrapup:value}}}:old);return saved;});pending.current=task;return task;
  };
  useEffect(()=>{setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);},[]);
  useEffect(()=>{
    if(!data||initialized)return;
    const s=data.item.project_data?.wrapup??{},c={...(s.copies??{})};
    for(const p of data.item.project_data?.captionPack??[])if(!c[p.platform])c[p.platform]={title:p.title??'',caption:p.caption??'',description:p.description??'',hashtags:(p.hashtags??[]).join(' ')};
    setCopies(c);setSelected(s.selected??[]);setDate(s.date??'');setTime(s.time??'');setStage(s.publishStage??0);
    if(data.item.job){setJobId(data.item.job.id);setResult({status:data.item.job.status,results:data.item.job.publishing_results??[]});}
    setInitialized(true);
  },[data,initialized]);
  useEffect(()=>{
    if(!initialized)return;
    const json=JSON.stringify(wrapup);if(json===lastSaved.current)return;
    const timer=setTimeout(()=>persist(wrapup).then(()=>{lastSaved.current=json;}).catch(()=>setNotice('Your changes could not be saved. Use Save as draft to try again.')),650);return()=>clearTimeout(timer);
  },[initialized,selected,copies,date,time,timezone,stage]);
  useEffect(()=>{
    const handler=(event:Event)=>{(event as CustomEvent<{tasks:Promise<unknown>[]}>).detail.tasks.push(persist());};
    window.addEventListener('creation-save',handler);return()=>window.removeEventListener('creation-save',handler);
  },[]);
  useEffect(()=>{
    if(!search.connected||syncStarted.current)return;syncStarted.current=true;
    sync().then(()=>qc.invalidateQueries({queryKey:['library-content',projectId]})).catch(e=>setNotice(resolvePublishingError(e).message));
  },[search.connected]);
  useEffect(()=>{
    const url=data?.item.media[0]?.url;if(!url)return;let live=true;fetch(url,{method:'HEAD'}).then(r=>{const bytes=Number(r.headers.get('content-length'));if(live&&bytes)setVideoInfo(old=>({...old,duration:old?.duration??0,width:old?.width??0,height:old?.height??0,bytes}));}).catch(()=>{});return()=>{live=false;};
  },[data?.item.media[0]?.url]);
  useEffect(()=>{
    if(!jobId||!['queued','uploading','processing'].includes(result?.status))return;
    const timer=setInterval(()=>poll({data:{jobId}}).then(r=>{setResult(r);qc.invalidateQueries({queryKey:['content-library']});qc.invalidateQueries({queryKey:['projects']});}).catch(()=>setNotice('Status check paused. Your post has not been submitted again.')),4000);return()=>clearInterval(timer);
  },[jobId,result?.status]);
  const run=async(name:string,fn:()=>Promise<void>)=>{setBusy(name);setNotice('');try{await fn();}catch(e){setNotice(name==='connect'||name==='publish'?resolvePublishingError(e).message:(e as Error).message);}finally{setBusy('');qc.invalidateQueries({queryKey:CREDIT_BALANCE_KEY});}};
  const connect=(p:PublishingPlatform)=>run('connect',async()=>{await persist();const r=await connectFn({data:{platforms:[p],returnPath:`/app?draftId=${draftId}&connected=true`}});window.location.assign(r.accessUrl);});
  const patch=(p:PublishingPlatform,field:CopyField,text:string)=>setCopies(old=>({...old,[p]:{...emptyCopy(),...old[p],[field]:text}}));
  const generate=()=>run('copy',async()=>{
    await persist();const r=await gen.run({slot:"copy",title:"Your platform copy",stage:`Writing copy for ${selected.length} platform${selected.length>1?"s":""}…`,expectedSeconds:30,doneLabel:"Your platform copy is ready",paid:true,items:selected.map(p=>({label:String(p),state:"running" as const})),resultSelector:"#publish-copy"}, () => pack({data:{projectId,platforms:selected,requestId:crypto.randomUUID(),regenerate:Object.keys(copies).length?Date.now():undefined}}));
    const next={...copies};for(const p of r.platforms)next[p.platform]={title:p.title,description:p.description,caption:p.caption,hashtags:p.hashtags.map(t=>`#${t.replace(/^#/,'')}`).join(' ')};
    setCopies(next);await persist({...snapshot.current,copies:next});if(r.cached)setNotice('Saved copy loaded — no charge.');
  });
  const rewriteOne=(p:PublishingPlatform,field:CopyField)=>run('rewrite',async()=>{
    await persist();const r=await gen.run({slot:`rw-${p}-${field}`,title:`${p} ${field}`,stage:`Rewriting your ${field}…`,expectedSeconds:12,doneLabel:`Your ${p} ${field} is rewritten`,paid:true,resultSelector:`#card-${p}-${field}`}, () => rewrite({data:{projectId,platform:p,field,text:copies[p]?.[field]??'',instruction,requestId:crypto.randomUUID()}}));patch(p,field,r.text);setMagic('');setInstruction('');
  });
  const submit=(platforms=selected)=>run('publish',async()=>{
    if(!data)return;
    const scheduledAt=confirmation==='schedule'?new Date(`${date}T${time}`).toISOString():undefined;
    await persist();const r=await publish({data:{projectId,contentType:'video',title:copies[platforms.find(p=>p==='youtube'||p==='pinterest')??platforms[0]]?.title||data.item.title,captionPerPlatform:Object.fromEntries(platforms.map(p=>[p,finalCaption(p,copies[p]??emptyCopy(),'')])),mediaUrls:data.item.media.map((m:any)=>m.url),platforms,scheduledAt}});
    setJobId(r.jobId);setResult({status:r.status,results:platforms.map(platform=>({platform,status:r.status}))});setConfirmation(null);qc.invalidateQueries({queryKey:['library-content',projectId]});qc.invalidateQueries({queryKey:['projects']});
  });
  if(error)return <p role="alert">Your video could not be loaded. <Button onClick={()=>qc.invalidateQueries({queryKey:['library-content',projectId]})}>Try again</Button></p>;
  if(!data||!initialized)return <p className="flex gap-2"><Loader2 className="size-5 animate-spin"/>Loading your publishing draft…</p>;
  const accounts=data.accounts;
  const accountFor=(p:PublishingPlatform)=>accounts.find((a:any)=>a.platform===p);
  const handle=(p:PublishingPlatform)=>{const a=accountFor(p);return a?.profile_display_name??'Connected account';};
  const warnings=(p:PublishingPlatform)=>videoInfo?videoWarnings(p,videoInfo):[];
  const checked=selected.filter(p=>accountFor(p));
  const canSubmit=checked.length===selected.length&&checked.length>0&&data.item.finished&&data.item.media.length>0;
  const validSchedule=date&&time&&new Date(`${date}T${time}`).getTime()>Date.now();
  return <div className="film-publish space-y-7">
    {stage!==2&&data.item.media[0]&&<video className="hidden" preload="metadata" src={data.item.media[0].url} onLoadedMetadata={e=>{const v=e.currentTarget;setVideoInfo(old=>({...old,duration:v.duration,width:v.videoWidth,height:v.videoHeight}));}}/>}
    <nav aria-label="Publish steps" className="grid grid-cols-3 gap-2">{['Platforms','Copy','Publish'].map((label,i)=><Button key={label} variant={stage===i?'default':'outline'} disabled={i>0&&!checked.length} onClick={()=>setStage(i)} className="min-w-0"><span className="hidden sm:inline">{String.fromCharCode(65+i)} · </span>{label}</Button>)}</nav>
    {stage===0&&<section className="space-y-5"><h2 className="text-2xl font-bold">Where do you want to post?</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{PUBLISHING_PLATFORMS.map(p=>{
      const account=accountFor(p),reason=platformIncompatibilityReason(p,'video'),isSelected=selected.includes(p);
      return <article key={p} className={`rounded-lg border bg-card p-5 ${isSelected?'border-primary':account?'border-primary/40':'border-border text-muted-foreground'}`}><div className="flex items-center gap-3"><Checkbox id={`platform-${p}`} aria-label={`Select ${PLATFORM_META[p].label}`} checked={isSelected} disabled={!account} onCheckedChange={on=>setSelected(s=>on?[...s,p]:s.filter(x=>x!==p))}/><label htmlFor={`platform-${p}`} className="text-lg font-semibold">{PLATFORM_META[p].label}</label></div><p className="mt-3 break-words text-sm">{account?handle(p):'Not connected'}</p>{warnings(p).map(w=><p key={w} role="status" className="mt-3 text-sm text-muted-foreground">{w}</p>)}{reason&&<p role="status" className="mt-3 text-sm">{reason}. Choose another platform for the video, or save this destination for text.</p>}{!account&&<Button variant="outline" className="mt-4" disabled={!!busy} onClick={()=>connect(p)}><Globe className="size-4"/>Connect</Button>}</article>;
    })}</div><Button disabled={!checked.length||!!busy} onClick={()=>{setSelected(checked);setStage(1);}}>Next<ChevronRight className="size-4"/></Button>{!checked.length&&<p className="text-sm text-muted-foreground">Select at least one connected platform to continue. You can save your draft meanwhile.</p>}</section>}
    {stage===1&&<section className="space-y-7"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-bold">Your platform copy</h2><Button disabled={!!busy} onClick={generate}><Sparkles className="size-4"/>{busy==='copy'?'Writing your copy…':`${Object.keys(copies).length?'Regenerate':'Write'} all copy · ${ACTION_COSTS.captionPack} plan credit`}</Button></div><div id="publish-copy">{gen.ring('copy',false)}</div>{selected.map(p=>{
      const c={...emptyCopy(),...copies[p]},caps=PLATFORM_CAPABILITY_MATRIX[p],fields:CopyField[]=[...(caps.maxTitleChars?['title' as const]:[]),'description','caption','hashtags'];
      return <section key={p} className="space-y-4 border-t border-border pt-6"><h3 className="text-xl font-bold">{PLATFORM_META[p].label} <span className="ml-2 text-sm font-normal text-muted-foreground">{handle(p)}</span></h3><div className="grid items-start gap-4 md:grid-cols-2">{fields.map(field=>{
        const id=`${p}-${field}`,limit=cardLimit(p,field),count=field==='hashtags'?tagList(c[field]).length:c[field].length,over=limit!==undefined&&count>limit;
        return <article key={field} id={`card-${p}-${field}`} className="min-w-0 rounded-lg border border-border bg-card p-5"><header className="flex items-center justify-between gap-2"><h4 className="font-semibold capitalize">{field}</h4><div className="flex"><Button size="icon" variant="ghost" title="Rewrite only this card" aria-label={`AI rewrite ${PLATFORM_META[p].label} ${field}`} onClick={()=>{setMagic(magic===id?'':id);setInstruction('');}}><Sparkles className="size-4"/></Button><Button size="icon" variant="ghost" title="Edit this card" aria-label={`Edit ${PLATFORM_META[p].label} ${field}`} onClick={()=>setEditing(editing===id?'':id)}><Pencil className="size-4"/></Button></div></header>
          {field==='hashtags'?<><div className="my-3 flex flex-wrap gap-2">{tagList(c.hashtags).map((tag,i)=><span key={`${tag}-${i}`} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm">#{tag}<Button variant="ghost" size="icon" className="size-7" aria-label={`Remove ${tag}`} onClick={()=>patch(p,'hashtags',tagList(c.hashtags).filter((_,j)=>i!==j).map(t=>`#${t}`).join(' '))}><X className="size-3"/></Button></span>)}</div><Input aria-label={`Add ${PLATFORM_META[p].label} hashtag`} placeholder="Add hashtag and press Enter" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const input=e.currentTarget;if(!input.value.trim())return;patch(p,'hashtags',[c.hashtags,...tagList(input.value).map(t=>`#${t}`)].filter(Boolean).join(' '));input.value='';}}}/></>:editing===id?<Textarea autoFocus aria-label={`${PLATFORM_META[p].label} ${field}`} className="my-3 min-h-28" value={c[field]} onChange={e=>patch(p,field,e.target.value)}/>:<p className="my-3 min-h-16 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{c[field]||'No copy yet. Write all copy above, or use the pencil to add your own.'}</p>}
          <p role="status" className={`text-sm ${over?'text-destructive':'text-muted-foreground'}`}>{count}{limit!==undefined?` / ${limit}`:''} {field==='hashtags'?'tags':'characters'}{over?' · Over limit':''}</p>
          {(field==='description'||field==='caption')&&<p className="mt-2 text-xs text-muted-foreground">{(p==='youtube'||p==='pinterest')===(field==='description')?'Included in this post.':'Optional alternative; saved for reuse.'}</p>}
          {field!=='title'&&<Button variant="link" className="mt-2 px-0 text-sm text-review-accent" onClick={()=>{setCopies(old=>{const next={...old};for(const target of selected)next[target]={...emptyCopy(),...next[target],[field]:fitCard(target,field,c[field])};return next;});setNotice('Applied to selected platforms, trimmed to each limit.');}}>Apply to all platforms</Button>}
          {magic===id&&<div className="mt-4 space-y-3 border-t border-border pt-4"><label className="block text-sm font-medium">Tell the AI what to change<Textarea aria-label="Tell the AI what to change" className="mt-2" value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Make it warmer and more direct"/></label><Button disabled={!!busy} onClick={()=>rewriteOne(p,field)}><Sparkles className="size-4"/>{busy==='rewrite'?'Rewriting…':`Rewrite this card · ${ACTION_COSTS.captionPack} plan credit`}</Button></div>}{gen.ring(`rw-${p}-${field}`)}
        </article>;
      })}</div>{publishingLimit(p,'video')&&finalCaption(p,c,'').length>(publishingLimit(p,'video')??Infinity)&&<p role="status" className="text-destructive">{PLATFORM_META[p].label}: combined copy and hashtags exceed {publishingLimit(p,'video')} characters. Edit or publish with this warning; the platform may reject it.</p>}</section>;
    })}<div className="flex justify-between gap-3"><Button variant="outline" onClick={()=>setStage(0)}><ChevronLeft className="size-4"/>Platforms</Button><Button onClick={()=>setStage(2)}>Next<ChevronRight className="size-4"/></Button></div></section>}
    {stage===2&&<section className="space-y-6"><h2 className="text-2xl font-bold">Publish your video</h2>{data.item.media[0]&&<video controls preload="metadata" src={data.item.media[0].url} poster={data.item.thumbnail||undefined} className="max-h-96 w-full rounded-lg bg-muted object-contain" onLoadedMetadata={e=>{const v=e.currentTarget;setVideoInfo(old=>({...old,duration:v.duration,width:v.videoWidth,height:v.videoHeight}));}}/>}<div className="rounded-lg border border-border bg-card p-5"><h3 className="font-semibold">Confirmation summary</h3><ul className="mt-3 space-y-2">{selected.map(p=><li key={p}>{PLATFORM_META[p].label} · {handle(p)}{warnings(p).map(w=><p key={w} role="status" className="mt-2 text-sm text-muted-foreground">{w}</p>)}</li>)}</ul><p className="mt-3 text-sm text-muted-foreground">{videoInfo?`${videoInfo.duration.toFixed(1)} seconds · ${videoInfo.width} × ${videoInfo.height}`:'Video dimensions are checked when the preview loads.'}</p><p className="mt-2 text-sm text-muted-foreground">Platform length, aspect and file-size restrictions depend on the destination and account. Limits unavailable here are not treated as unlimited.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 font-medium">Date<Input type="date" aria-label="Schedule date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="space-y-2 font-medium">Time<Input type="time" aria-label="Schedule time" value={time} onChange={e=>setTime(e.target.value)}/></label></div><p className="text-sm text-muted-foreground">{timezone} · your local timezone</p><div className="flex flex-wrap gap-3"><Button disabled={!!busy||!canSubmit} onClick={()=>setConfirmation('now')}><Send className="size-4"/>Publish now</Button><Button variant="outline" disabled={!!busy||!canSubmit} onClick={()=>{if(!validSchedule){setNotice('Choose a future date and time.');return;}setConfirmation('schedule');}}><Calendar className="size-4"/>Schedule</Button></div>{!canSubmit&&<p className="text-sm text-muted-foreground">{!checked.length?'Connect and select an account first.':'Finish assembling your film or reconnect the selected account before posting.'} Save as draft is available.</p>}{date&&!validSchedule&&<p role="status" className="text-sm text-muted-foreground">Choose a future date and time to schedule.</p>}{confirmation&&<div role="dialog" aria-label="Confirm publishing" className="rounded-lg border border-primary bg-card p-5"><h3 className="font-bold">{confirmation==='now'?'Publish now?':`Schedule for ${date} at ${time} (${timezone})?`}</h3><p className="my-3 text-sm">{selected.map(p=>`${PLATFORM_META[p].label} (${handle(p)})`).join(', ')}</p><div className="flex flex-wrap gap-3"><Button disabled={!!busy} onClick={()=>submit()}><Check className="size-4"/>Confirm {confirmation==='now'?'publish':'schedule'}</Button><Button variant="outline" disabled={!!busy} onClick={()=>setConfirmation(null)}>Cancel</Button></div></div>}{result&&<PublishStatusCards results={result.results?.length?result.results:selected.map(platform=>({platform,status:result.status}))} onFix={(p,action)=>{if(action==='Reconnect')connect(p);else if(action==='Edit')setStage(1);else {setSelected([p]);setConfirmation('now');}}}/>}</section>}
    {notice&&<p role="status" className="rounded-lg border border-border bg-muted p-4 text-sm">{notice}</p>}
    <footer className="sticky bottom-3 z-20 flex justify-between gap-3 rounded-lg border border-border bg-card p-3"><Button variant="outline" disabled={!!busy} onClick={onSaveDraft}><Save className="size-4"/>Save as draft</Button><span className="self-center text-sm text-muted-foreground">Nothing posts until you confirm.</span></footer>
  </div>;
}
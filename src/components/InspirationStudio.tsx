import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Film, Plus, Download, Check, ImagePlus, Play, Trash2, Save, Pencil, Loader2, AlertTriangle, Lock, Mic, ArrowLeft } from 'lucide-react';
import { GenerationProgress } from './GenerationProgress';
import { startJob, finishJob, slideTo, type JobItem } from '@/lib/generation-jobs';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { ReviewCard } from './ReviewPostPrimitives';
import { AssemblyDelivery } from './AssemblyDelivery';
import { StudioCostWorksheet } from './StudioCostWorksheet';
import { supabase } from '@/integrations/supabase/client';
import { VIDEO_BALANCE_KEY,STUDIO_PRICING,videoCreditsForWorkspace,videoBalanceQuote } from '@/lib/studio-pricing';
import { VideoPackAvailability } from './VideoPackAvailability';
import { CREDIT_BALANCE_KEY } from '@/lib/credits';
import { STUDIO_MODELS, type SceneDraft, type ObjectCheck, priceFromWorkspaceCost } from '@/lib/inspiration';
import { getInspirationStudio, createInspirationProject, saveInspirationScene, manageInspirationReference, approveInspirationStill, inspirationQuote, animateInspirationScene, recoverInspirationClips, finishInspirationStill, writeInspirationStoryboard } from '@/lib/inspiration.functions';
import { saveCreationDraft } from '@/lib/creation-drafts.functions';
import { EMPTY_CREATION } from '@/lib/creation-draft';

export const inspirationQuery = (projectId?: string) => queryOptions({ queryKey: ['inspiration-studio', projectId], queryFn: () => getInspirationStudio({ data: { projectId } }) });
type StudioData = Awaited<ReturnType<typeof getInspirationStudio>>;
type Scene = StudioData['scenes'][number];
const blank: SceneDraft = { environment: 'The same setting as the source shot', action: 'The new person performs the same action as the source shot', endState: 'The action finishes in the same final position as the source', camera: 'Static full shot at eye level', audio: 'Natural room ambience', duration: 8, objects: [{ name: 'person', state: 'in the starting position of the action' }] };
const LEGACY_FIXTURE = /pours water|open bottle|into the cup/i;
const kinds = [{ id: 'character_face', label: 'Face anchor' }, { id: 'character_body', label: 'Full body' }, { id: 'character_back', label: 'Back view' }, { id: 'product', label: 'Product' }, { id: 'logo', label: 'Logo' }, { id: 'setting', label: 'Setting' }] as const;

export function InspirationStudio({ projectId, wizardStage, wizardBrief = '', wizardDraft, onWizardDraft, speechMode, initialDelivery, onBackToMake }: { onBackToMake?: () => void; projectId?: string; wizardStage?: 'words'|'make'|'deliver'; wizardBrief?: string; wizardDraft?: Record<string, unknown>; onWizardDraft?: (draft: Record<string, unknown>) => void; speechMode?: 'voiceover'|'silent'; initialDelivery?: boolean }) {
  const { data } = useSuspenseQuery(inspirationQuery(projectId));
  const navigate = useNavigate(); const qc = useQueryClient();
  const saveCreation=useServerFn(saveCreationDraft);
  const reviewAction=async(publish:boolean)=>{
    if(!data.selected)return;
    const tasks:Promise<unknown>[]=[];window.dispatchEvent(new CustomEvent('creation-save',{detail:{tasks}}));await Promise.all(tasks);
    const id=crypto.randomUUID();
    await saveCreation({data:{id,step:5,title:data.selected.title,state:{...EMPTY_CREATION,format:'film',title:data.selected.title,projectId:data.selected.id,analysisId:data.selected.analysis_id??undefined,production:{publishPlaceholder:publish}},completed:false}});
    toast.success('Video draft saved.');await navigate(publish?{to:'/app',search:{draftId:id}}:{to:'/projects'});
  };
  const create = useServerFn(createInspirationProject), save = useServerFn(saveInspirationScene), refs = useServerFn(manageInspirationReference), approve = useServerFn(approveInspirationStill), quote = useServerFn(inspirationQuote), animate = useServerFn(animateInspirationScene), recover = useServerFn(recoverInspirationClips), finish = useServerFn(finishInspirationStill), write = useServerFn(writeInspirationStoryboard);
  const [tab, setTab] = useState<'storyboard'|'references'|'observations'|'delivery'>(initialDelivery?'delivery':'storyboard');
  const [newProject, setNewProject] = useState(false), [title, setTitle] = useState(''), [analysisId, setAnalysisId] = useState('');
  const [editing, setEditing] = useState<Scene | 'new' | null>(null), [draft, setDraft] = useState<SceneDraft>(() => { const d = wizardDraft?.sceneDraft as SceneDraft | undefined; return d && !LEGACY_FIXTURE.test(`${d.action} ${d.environment}`) ? d : blank; });
  const [busy, setBusy] = useState(false), [checks, setChecks] = useState<Record<string,ObjectCheck[]>>((wizardDraft?.checks as Record<string,ObjectCheck[]>)??{});
  const [model, setModel] = useState<(typeof STUDIO_MODELS)[number]['id']>((wizardDraft?.model as (typeof STUDIO_MODELS)[number]['id'])??'google/veo-3.1-fast');
  const [confirmation, setConfirmation] = useState<{ scene: Scene; operation: 'still'|'animate'; frame?: 'first'|'last'; q: Awaited<ReturnType<typeof inspirationQuote>> } | null>(null);
  const [partial, setPartial] = useState<Record<string,{ url: string; final: boolean }>>({});
  const [makePart, setMakePart] = useState<'stills'|'animate'>((wizardDraft?.makePart as 'stills'|'animate') ?? 'stills');
  useEffect(() => { if (wizardStage) setTab(wizardStage==='deliver'?'delivery':'storyboard'); }, [wizardStage]);
  useEffect(() => {
    if (!onWizardDraft) return;
    const next = { ...wizardDraft, sceneDraft: draft, makePart, model, checks };
    if (JSON.stringify(next)!==JSON.stringify(wizardDraft)) onWizardDraft(next);
  }, [draft, makePart, model, checks]);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['inspiration-studio'] }); await qc.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY }); await qc.invalidateQueries({queryKey:VIDEO_BALANCE_KEY}); };
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await refresh(); } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  useEffect(() => {
    if (!data.attempts.some(a => ['queued','in_progress','collecting'].includes(a.status) && a.operation === 'animate')) return;
    const timer = setInterval(() => { recover().then(refresh).catch(e => toast.error(e.message)); }, 8000);
    return () => clearInterval(timer);
  }, [data.attempts, recover]);
  const edit = (s?: Scene) => { setEditing(s ?? 'new'); setDraft(s ? { ...(s.scene_input as unknown as SceneDraft), stillPrompt: s.still_prompt, motionPrompt: s.motion_prompt } : blank); };
  const upload = async (file: File, kind: (typeof kinds)[number]['id']) => {
    if (file.size > 10 * 1024 * 1024) throw new Error('Maximum reference size is 10MB.');
    const base64 = await new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(file); });
    await refs({ data: { action: 'upload', kind, filename: file.name, mime: file.type as 'image/png'|'image/jpeg'|'image/webp', base64 } });
  };
  const makeStill = async (scene: Scene, q: Awaited<ReturnType<typeof inspirationQuote>>, frame: 'first'|'last', requestKey = crypto.randomUUID()) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Sign in required.');
      const { streamImage } = await import('@/lib/inspiration-stream');
      let image = '';
      try {
        await streamImage('/api/public/inspiration-still', { sceneId: scene.id, requestKey, revision: q.revision, confirmedCredits: q.customerCredits, frame }, (url, final) => { if (frame !== 'last') setPartial(p => ({ ...p, [scene.id]: { url, final } })); if (final) image = url.split(',')[1]; }, undefined, { Authorization: `Bearer ${session.session.access_token}` });
        const done = await finish({ data: { requestKey, base64: image } });
        if (done?.outfitFallback) toast.info('The image service declined the source outfit, so this still uses fitted athletic wear in the same colours.');
      } catch(e) { await finish({ data: { requestKey, error: (e as Error).message } }).catch(() => {}); throw e; }
  };
  const [batch, setBatch] = useState<{ kind: 'stills'|'animate'; items: JobItem[]; startedAt: number; status: 'running'|'error'|'done'; error?: string; refunded?: boolean } | null>(null);
  /** One click, cost shown on the button: draw every missing still in order, each with its own quote and refund-on-failure. */
  const createStills = async () => {
    const todo = data.scenes.filter(s => !s.preview); if (!todo.length) return;
    const jobId = `stills-${projectId}`; const items: JobItem[] = todo.map(s => ({ label: `Scene ${s.scene_order+1}`, state: 'waiting' }));
    setBatch({ kind: 'stills', items, startedAt: Date.now(), status: 'running' });
    startJob({ id: jobId, kind: 'stills', title: 'Your stills', href: window.location.pathname + window.location.search, expectedSeconds: 40 * todo.length, doneLabel: todo.length > 1 ? 'Your stills are ready' : 'Your still is ready' });
    setBusy(true);
    for (let k = 0; k < todo.length; k++) {
      items[k] = { ...items[k], state: 'running' }; setBatch(b => b && { ...b, items: [...items] });
      try { const q = await quote({ data: { sceneId: todo[k].id, model, operation: 'still' } }); if (!q.available) throw new Error(q.reason ?? 'This still cannot be priced right now.'); await makeStill(todo[k], q, 'first'); items[k] = { ...items[k], state: 'done' }; await refresh(); }
      catch (e) { items[k] = { ...items[k], state: 'failed' }; setBatch(b => b && { ...b, items: [...items], status: 'error', error: (e as Error).message, refunded: true }); finishJob(jobId, false, { error: (e as Error).message, refunded: true }); setBusy(false); await refresh(); return; }
      setBatch(b => b && { ...b, items: [...items] });
    }
    setBusy(false); setBatch(b => b && { ...b, status: 'done' }); finishJob(jobId, true, { resultSelector: '#make-scenes' }); setTimeout(() => setBatch(null), 2500);
  };
  /** Submit animation for every approved scene without a clip; progress then follows the saved attempts (survives refresh). */
  const animateApproved = async () => {
    const todo = data.scenes.filter(s => s.approved_at && !data.attempts.some(a => a.scene_id === s.id && a.operation === 'animate' && ['completed','queued','in_progress','collecting','claimed'].includes(a.status)));
    if (!todo.length) return;
    startJob({ id: `animate-${projectId}`, kind: 'animate', title: 'Your video clips', href: window.location.pathname + window.location.search, expectedSeconds: 120, doneLabel: 'Your video clips are ready', long: true });
    await run(async () => { for (const s of todo) { const q = await quote({ data: { sceneId: s.id, model, operation: 'animate' } }); if (!q.available) throw new Error(q.reason ?? 'Animation cannot be priced right now.'); await animate({ data: { sceneId: s.id, model, requestKey: crypto.randomUUID(), revision: q.revision, confirmedCredits: q.customerCredits ?? 0 } }); } });
  };
  const confirm = async () => {
    if (!confirmation || confirmation.q.customerCredits === null) return;
    const c = confirmation; setConfirmation(null); const requestKey = crypto.randomUUID();
    await run(async () => {
      if (c.operation === 'animate') { await animate({ data: { sceneId: c.scene.id, model, requestKey, revision: c.q.revision, confirmedCredits: c.q.customerCredits ?? 0 } }); return; }
      await makeStill(c.scene, c.q, c.frame ?? 'first', requestKey);
    });
  };
  const downloadClips = async () => {
    const files: Record<string, Uint8Array> = {};
    for (const s of data.scenes) {
      const a = data.attempts.find(a => a.scene_id === s.id && a.operation === 'animate' && a.status === 'completed' && a.preview);
      if (a?.preview) { const res = await fetch(a.preview); if (!res.ok) throw new Error('Clip download failed.'); files[`scene-${String(s.scene_order+1).padStart(2,'0')}.mp4`] = new Uint8Array(await res.arrayBuffer()); }
    }
    const { zipSync } = await import('fflate'); const bytes = zipSync(files, { level: 0 });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' })); const link = document.createElement('a'); link.href = url; link.download = 'inspiration-clips.zip'; link.click(); URL.revokeObjectURL(url);
  };
  const completed = data.attempts.filter(a => a.operation === 'animate' && a.status === 'completed');
  // Tell the wizard how many finished clips exist so Next can't skip to an empty review.
  useEffect(() => { if (onWizardDraft && wizardDraft && wizardDraft.clipsReady !== completed.length) onWizardDraft({ ...wizardDraft, clipsReady: completed.length }); }, [completed.length]);
  // Announce animation completion (also after a refresh, since the job is remembered).
  const liveAnim = data.attempts.some(a => a.operation === 'animate' && ['claimed','queued','in_progress','collecting'].includes(a.status));
  useEffect(() => { if (!liveAnim && completed.length) finishJob(`animate-${projectId}`, true, { resultSelector: '#make-scenes' }); }, [liveAnim, completed.length]);
  return <div className={wizardStage ? "wizard-production space-y-6" : "mx-auto max-w-7xl px-4 py-8 sm:px-8"}>
    {!wizardStage && <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Film className="size-4"/> Production / Structure-only inspiration</div><h1 className="text-3xl font-bold">Video Inspiration Studio</h1><p className="mt-2 text-sm text-muted-foreground">New subjects, settings and words. Never copy a real person’s likeness.</p></div>
      <Button onClick={() => navigate({to:'/app',search:{format:'film'}})}><Plus className="size-4"/> New video</Button>
    </div>}
    {!wizardStage && <div className="flex flex-wrap items-center justify-between gap-4 py-5">
      <select aria-label="Film" className="max-w-full rounded-md border border-input bg-background p-2 text-sm" value={data.selected?.id ?? ''} onChange={e => navigate({ to: '/studio/inspiration', search: { projectId: e.target.value } })}><option value="" disabled>Select a video</option>{data.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
      <span className="text-sm font-semibold">{data.videoBalance} video credits · separate balance</span><span className="text-sm text-muted-foreground">9:16 · 720p · {data.scenes.length} scenes · {completed.length} clips</span>
    </div>}
    {!wizardStage && <div className="mb-6 flex flex-wrap gap-1 border-b border-border">{(['storyboard','references','observations','delivery'] as const).map(t => <Button key={t} variant={tab === t ? 'secondary' : 'ghost'} className="mb-2 capitalize" onClick={() => setTab(t)}>{t}</Button>)}</div>}
    {wizardStage==='words' && <div className="mb-6 flex flex-wrap gap-2"><Button variant={tab==='storyboard'?'secondary':'outline'} onClick={()=>setTab('storyboard')}>Scene words</Button><Button variant={tab==='references'?'secondary':'outline'} onClick={()=>setTab('references')}>Your reference photos</Button></div>}
    {wizardStage==='make' && (()=>{
      const n=data.scenes.length, stills=data.scenes.filter(x=>x.preview).length, approved=data.scenes.filter(x=>x.approved_at).length, missing=n-stills;
      const perStill=data.stillWorkspaceQuote===null?null:priceFromWorkspaceCost(data.stillWorkspaceQuote,data.usdPerWorkspaceCredit);
      const toAnimate=data.scenes.filter(x=>x.approved_at&&!data.attempts.some(t=>t.scene_id===x.id&&t.operation==='animate'&&t.status!=='failed'&&t.status!=='refunded'));
      const animCost=toAnimate.reduce((t,x)=>t+videoCreditsForWorkspace(x.duration*(STUDIO_PRICING.rates[model]??0)),0);
      const cur=stills===0?1:approved===0?2:completed.length===0?3:4;
      const steps=[
        {n:1,title:'Create stills',body:missing?`Draw a picture for ${missing===n?'each':'the remaining'} scene${missing>1?'s':''}.`:'All scenes have a still.',lock:'',action:missing>0&&<Button size="lg" disabled={busy||!!batch&&batch.status==='running'} onClick={createStills}><ImagePlus className="size-5"/>Create {missing} still{missing>1?'s':''}{perStill!==null?` · ${perStill*missing} credit${perStill*missing===1?'':'s'}`:' · priced at the next step'}</Button>},
        {n:2,title:'Approve stills',body:'Tick what you see in each picture, then press Approve on the scene card below.',lock:'Unlocks after your first still is made',action:cur===2&&<Button size="lg" onClick={()=>slideTo('#make-scenes')}><Check className="size-5"/>Go to my stills</Button>},
        {n:3,title:'Animate',body:approved?`Turn ${toAnimate.length||approved} approved still${(toAnimate.length||approved)>1?'s':''} into moving clips.`:'',lock:'Unlocks after you approve at least one still',action:approved>0&&toAnimate.length>0&&<Button size="lg" disabled={busy||data.videoBalance===0} onClick={animateApproved}><Play className="size-5"/>Animate {toAnimate.length} scene{toAnimate.length>1?'s':''} · {animCost} video credits</Button>},
        {n:4,title:'Add voice & music (optional)',body:'Press Next to add a voiceover or music and put your video together.',lock:'Unlocks after your first clip is finished',action:null},
      ];
      return <ol className="grid gap-3" aria-label="Make your video in four steps">{steps.map(st=>{const state=st.n<cur||(st.n===1&&missing===0)?'done':st.n===cur?'current':st.n===4&&cur>=4?'current':st.n>cur?'locked':'done';return <li key={st.n} className="make-step" data-state={state} aria-current={state==='current'?'step':undefined}>
        <span className="make-step-num">{state==='done'?<Check className="size-4"/>:state==='locked'?<Lock className="size-4"/>:st.n}</span>
        <div className="min-w-0 flex-1"><p className="text-lg font-bold">{st.title}{state==='done'&&<span className="ml-2 text-sm font-medium text-status-success">Done</span>}</p>
        <p className="text-sm">{state==='locked'?st.lock:st.body}</p>
        {state!=='locked'&&st.action&&<div className="mt-3">{st.action}</div>}</div></li>;})}</ol>;
    })()}
    {wizardStage==='make' && batch && <GenerationProgress status={batch.status} stage={batch.status==='error'?'':(()=>{const k=batch.items.findIndex(i=>i.state==='running');return k<0?'Finishing…':`Drawing scene ${k+1} of ${batch.items.length}…`;})()} startedAt={batch.startedAt} expectedSeconds={40*batch.items.length} items={batch.items} error={batch.error} refunded={batch.refunded} onRetry={()=>{setBatch(null);createStills();}}/>}
    {wizardStage==='make' && (()=>{const live=data.attempts.filter(t=>t.operation==='animate'&&['claimed','queued','in_progress','collecting'].includes(t.status));if(!live.length)return null;const started=Math.min(...live.map(t=>new Date(t.created_at).getTime()));const items=data.scenes.filter(x=>data.attempts.some(t=>t.scene_id===x.id&&t.operation==='animate')).map(x=>{const t=data.attempts.find(t=>t.scene_id===x.id&&t.operation==='animate');return {label:`Scene ${x.scene_order+1}`,state:(t?.status==='completed'?'done':t?.status==='failed'||t?.status==='refunded'?'failed':'running') as JobItem['state']};});const k=items.findIndex(i=>i.state==='running');return <GenerationProgress stage={`Animating scene ${k+1}…`} startedAt={started} expectedSeconds={120} items={items} note="You can leave this page — we’ll tell you when it’s done"/>;})()}
    {data.videoBalance===0&&<div role="status" className="mb-5 flex flex-wrap items-center gap-4 border-b border-border pb-5"><div><p className="font-semibold">You need video credits to animate scenes, narrate and render.</p><p className="text-sm text-muted-foreground">Storyboards and stills use plan credits and still work. Everything you make stays saved; nothing is charged.</p></div><VideoPackAvailability/></div>}
    {data.selected?.pause_reason && <p role="alert" className="mb-5 text-destructive">Paused: {data.selected.pause_reason}</p>}
    {!data.selected && tab !== 'references' ? <div className="py-16 text-center"><Film className="mx-auto mb-5 size-12 text-muted-foreground"/><h2 className="text-xl font-semibold">Your first video</h2><Button className="mt-5" onClick={() => navigate({to:'/app',search:{format:'film'}})}><Plus className="size-4"/> Create video</Button></div> : null}
    {tab === 'storyboard' && data.selected && <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{wizardStage ? 'Your scenes' : data.selected.title}</h2>{!wizardStage && <p className="text-xs text-muted-foreground">{data.sourceAnalysis ? <>Inspired by <a className="underline" href={data.sourceAnalysis.instagram_url} target="_blank" rel="noreferrer">{data.sourceAnalysis.source_account ?? data.sourceAnalysis.instagram_url}</a></> : 'No source post recorded'}</p>}</div><div className="flex flex-wrap gap-2">{(!wizardStage || (wizardStage==='make' && data.scenes.some(x=>x.approved_at))) && <select aria-label="Animation model" value={model} onChange={e => setModel(e.target.value as typeof model)} className="max-w-full rounded-md border border-input bg-background p-2 text-sm">{STUDIO_MODELS.map(m => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}</select>}{data.sourceAnalysis && !data.scenes.length && (!wizardStage || wizardStage==='words') && <Button disabled={busy} onClick={() => run(async () => { const r = await write({ data: { projectId: data.selected?.id ?? '', brief: wizardBrief, speechMode } }); toast.success(`${r.scenes} scenes written · ${r.charged} plan credits. Edit any field before generating stills.`); })}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Pencil className="size-4"/>} Write storyboard with AI · {data.storyboardPlanCredits} plan credits</Button>}{(!wizardStage || wizardStage==='words') && <Button variant="outline" onClick={() => edit()}><Plus className="size-4"/> Add scene</Button>}</div></div>
      {!wizardStage && (()=>{const rate=STUDIO_PRICING.rates[model];const seconds=data.scenes.reduce((n,s)=>n+s.duration,0);if(rate===null||!seconds)return null;const v=videoBalanceQuote(data.scenes.reduce((n,s)=>n+videoCreditsForWorkspace(s.duration*rate),0)+Math.ceil(seconds/60*STUDIO_PRICING.renderUsdPerMinute/STUDIO_PRICING.video.unitCostUsd),data.videoBalance,seconds);return <div className="mb-5 space-y-2 text-sm"><p className="font-semibold">{STUDIO_PRICING.video.approved?'Approved':'Proposed'} clip + render budget: {v.equivalent}</p><p>{v.afterwards}</p><p className="text-muted-foreground">Plan credits separately: stills priced per still · AI storyboard {data.storyboardPlanCredits} · manual storyboard 0 · cached analysis import 0 (new analysis 3). Generated voiceover cost unset and excluded. No total is final.</p></div>;})()}
      <div id="make-scenes" className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">{data.scenes.map(s => {
        const objects = s.action_objects as unknown as SceneDraft['objects']; const checked = checks[s.id] ?? s.object_checks as unknown as ObjectCheck[];
        const clip = data.attempts.find(a => a.scene_id === s.id && a.operation === 'animate'); const image = partial[s.id]?.url ?? s.preview;
        return <article key={s.id} className={wizardStage ? "review-card wizard-scene" : "overflow-hidden rounded-lg border border-border bg-card"}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><h3 className="flex items-center gap-2 text-xl font-bold"><Film className="size-5 text-review-accent"/>Scene {s.scene_order+1}</h3><span className="text-xs text-muted-foreground">{s.duration}s · {s.status.replaceAll('_',' ')}</span></div>
          {wizardStage!=='words' && <div className="mx-auto aspect-[9/16] w-full max-w-64 bg-muted">{clip?.status === 'completed' && clip.preview ? <video controls playsInline src={clip.preview} className="h-full w-full object-contain"/> : image ? <img src={image} alt={`Scene ${s.scene_order+1} still`} className={`h-full w-full object-contain ${partial[s.id] && !partial[s.id].final ? 'blur-2xl' : ''}`}/> : <div className="flex h-full items-center justify-center"><ImagePlus className="size-10 text-muted-foreground"/></div>}</div>}
          <div className="space-y-4 p-4">{(s as any).endPreview && wizardStage!=='words' && <div className="flex items-center gap-3"><img src={(s as any).endPreview} alt={`Scene ${s.scene_order+1} end frame`} className="aspect-[9/16] w-16 rounded object-cover"/><p className="text-xs text-muted-foreground">End frame — the clip will move from the still to this pose (Veo Fast; Lite uses the start frame only).</p></div>}{wizardStage!=='words' && <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">This still contains</p>{objects.map(o => {
            const value = checked.some(c => c.name === o.name && c.state === o.state && c.present);
            return <label key={o.name} className="mb-2 flex items-start gap-2 text-sm"><Checkbox disabled={!s.preview || Boolean(s.approved_at)} checked={value} onCheckedChange={v => setChecks(old => ({ ...old, [s.id]: [...checked.filter(c => c.name !== o.name), { ...o, present: v === true, reason: 'User visually confirmed the approved still' }] }))}/><span>{o.name} {value ? '✓' : '— not verified'}<small className="block text-muted-foreground">{o.state}</small></span></label>;
          })}</div>}
          {wizardStage!=='words' && objects.some(o => !checked.some(c => c.name === o.name && c.state === o.state && c.present)) && <p className="flex gap-2 text-xs text-status-warning"><AlertTriangle className="size-4 shrink-0"/> Action objects must be visible in their stated initial states.</p>}
          <details open={wizardStage==='words'}><summary className="cursor-pointer text-sm font-medium">Scene words</summary>{(s.scene_input as unknown as SceneDraft)?.voiceover&&<p className="mt-3 text-sm"><strong>Spoken line: </strong>{(s.scene_input as unknown as SceneDraft).voiceover}</p>}<p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{s.still_prompt}</p><p className="mt-3 whitespace-pre-wrap break-words text-xs">{s.motion_prompt}</p></details>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => edit(s)}><Pencil className="size-3"/> Edit</Button>{(!wizardStage || wizardStage==='make') && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => setConfirmation({ scene: s, operation: 'still', q: await quote({ data: { sceneId: s.id, model, operation: 'still' } }) }))}><ImagePlus className="size-3"/> {s.preview ? 'Regenerate still' : 'Generate still'}{wizardStage ? ` · ${data.stillWorkspaceQuote===null?'view quote':priceFromWorkspaceCost(data.stillWorkspaceQuote,data.usdPerWorkspaceCredit)} plan credits` : ''}</Button>}
          {(s.scene_input as any)?.keyframes?.last && (!wizardStage || wizardStage==='make') && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => setConfirmation({ scene: s, operation: 'still', frame: 'last', q: await quote({ data: { sceneId: s.id, model, operation: 'still' } }) }))}><ImagePlus className="size-3"/> {(s as any).endPreview ? 'Redo end frame' : 'Recreate end frame'}{wizardStage ? ` · ${data.stillWorkspaceQuote===null?'view quote':priceFromWorkspaceCost(data.stillWorkspaceQuote,data.usdPerWorkspaceCredit)} plan credits` : ''}</Button>}
          {!s.approved_at && s.preview && (!wizardStage || wizardStage==='make') && <Button size="sm" disabled={busy} onClick={() => run(() => approve({ data: { sceneId: s.id, checks: checked.map(c => ({ ...c, present: c.present === true })) } }))}><Check className="size-3"/> Approve still</Button>}
          {s.approved_at && (!wizardStage || wizardStage==='make') && <Button size="sm" variant={wizardStage?'outline':'default'} disabled={busy} onClick={() => run(async () => setConfirmation({ scene: s, operation: 'animate', q: await quote({ data: { sceneId: s.id, model, operation: 'animate' } }) }))}><Play className="size-3"/> Quote animation{wizardStage ? ` · ${videoCreditsForWorkspace(s.duration*(STUDIO_PRICING.rates[model]??0))} video credits` : ''}</Button>}</div>
          {clip?.failure_reason && <p className="break-words text-xs text-destructive">{clip.failure_reason}</p>}</div>
        </article>;
      })}</div>
    </>}
    {tab === 'references' && <><h2 className="mb-5 text-xl font-semibold">Reference library</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{kinds.map(k => <section key={k.id} className="border-t border-border py-4"><h3 className="mb-3 font-semibold">{k.label}</h3>{data.references.filter(r => r.kind === k.id).map(r => <div key={r.id} className="mb-4"><img src={r.preview ?? ''} alt={r.filename} className="mb-2 aspect-square w-32 rounded-md object-contain bg-muted"/><div className="flex items-center gap-3"><Switch aria-label={`Use ${r.filename}`} checked={r.enabled} onCheckedChange={enabled => run(() => refs({ data: { action: 'toggle', id: r.id, enabled } }))}/><span className="min-w-0 truncate text-xs">{r.filename}</span><Button variant="ghost" size="icon" aria-label={`Delete ${r.filename}`} onClick={() => run(() => refs({ data: { action: 'delete', id: r.id } }))}><Trash2 className="size-4"/></Button></div></div>)}<Input aria-label={`Upload ${k.label}`} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const f=e.target.files?.[0]; if(f) run(() => upload(f,k.id)); }}/></section>)}</div></>}
    {tab === 'observations' && data.selected && <div className="grid gap-8 lg:grid-cols-2"><section><h2 className="mb-4 text-xl font-semibold">Visual-only evidence</h2><pre className="max-h-[600px] overflow-auto whitespace-pre-wrap break-words border-t border-border py-4 text-xs">{JSON.stringify(data.selected.visual_observations,null,2)}</pre></section><section><h2 className="mb-4 text-xl font-semibold">Audio-only evidence</h2><pre className="max-h-[600px] overflow-auto whitespace-pre-wrap break-words border-t border-border py-4 text-xs">{JSON.stringify(data.selected.audio_observations,null,2)}</pre><p className="text-xs text-muted-foreground">{(data.selected.observation_notes as string[]).join(' ')}</p></section></div>}
    {tab === 'delivery' && data.selected && wizardStage==='deliver' && completed.length===0 && <div className="review-card py-12 text-center"><Film className="mx-auto mb-4 size-12 text-review-muted"/><h2 className="text-2xl font-bold">Nothing to review yet</h2><p className="mx-auto mt-2 max-w-md text-review-muted">Make and animate at least one scene first. Your video shows up here once a clip is finished.</p>{onBackToMake&&<Button size="lg" className="mt-6" onClick={onBackToMake}><ArrowLeft className="size-5"/>Back to Make the content</Button>}</div>}
    {tab === 'delivery' && data.selected && !(wizardStage==='deliver' && completed.length===0) && <><AssemblyDelivery wizard={!!wizardStage} key={data.selected.id} speechMode={speechMode} direction={{direction:wizardDraft?.remixDirection,instructions:wizardDraft?.remixInstructions}} wizardDraft={wizardDraft?.assembly as Record<string, unknown> | undefined} onWizardDraft={onWizardDraft ? assembly => onWizardDraft({ ...wizardDraft, assembly }) : undefined} data={data} busy={busy} run={run} refresh={refresh} downloadClips={downloadClips}/>{!wizardStage && <><StudioCostWorksheet allowance={data.monthlyAllowance}/><footer className="sticky bottom-3 z-30 flex justify-between gap-3 rounded-lg border border-border bg-card p-3"><Button variant="outline" disabled={busy} onClick={()=>run(()=>reviewAction(false))}><Save className="size-4"/>Save as draft</Button><Button disabled={busy} onClick={()=>run(()=>reviewAction(true))}>Publish</Button></footer></>}</>}
    <Dialog open={newProject} onOpenChange={setNewProject}><DialogContent><DialogHeader><DialogTitle>New inspiration video</DialogTitle></DialogHeader><label className="text-sm">Video title<Input aria-label="Film title" value={title} onChange={e => setTitle(e.target.value)}/></label><label className="text-sm">Saved source analysis<select aria-label="Saved source analysis" value={analysisId} onChange={e => setAnalysisId(e.target.value)} className="mt-2 w-full rounded-md border border-input bg-background p-2"><option value="">Blank storyboard</option>{data.analyses.map(a => <option key={a.id} value={a.id}>{a.source_account ?? a.instagram_url}</option>)}</select></label><Button disabled={!title.trim() || busy} onClick={() => run(async () => { const p=await create({ data: { title, analysisId: analysisId || undefined } }); setNewProject(false); navigate({ to: '/studio/inspiration', search: { projectId: p.id } }); })}>Create video</Button></DialogContent></Dialog>
    <Dialog open={editing !== null} onOpenChange={v => { if(!v)setEditing(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing === 'new' ? 'Add scene' : 'Edit scene · approval resets'}</DialogTitle></DialogHeader>{(['environment','action','endState','camera','audio'] as const).map(key => <label key={key} className="text-sm capitalize">{key.replace('endState','End state')}<Textarea aria-label={key} value={draft[key]} onChange={e => setDraft(p => ({ ...p, [key]:e.target.value, stillPrompt: undefined, motionPrompt: undefined }))}/></label>)}<label className="text-sm">Spoken line<Textarea aria-label="Spoken line" value={draft.voiceover??''} onChange={e=>setDraft(p=>({...p,voiceover:e.target.value}))}/></label><label className="text-sm">On-screen text<Input aria-label="On-screen text" value={draft.onScreenText ?? ''} onChange={e => setDraft(p => ({ ...p, onScreenText: e.target.value }))}/></label><label className="text-sm">Duration<select aria-label="Scene duration" value={draft.duration} onChange={e => setDraft(p => ({ ...p,duration:Number(e.target.value) as 4|6|8 }))} className="ml-3 rounded-md border border-input bg-background p-2">{[4,6,8].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label><label className="text-sm">Action objects (one per line: object | initial state)<Textarea aria-label="Action objects" value={draft.objects.map(o => `${o.name} | ${o.state}`).join('\n')} onChange={e => setDraft(p => ({ ...p, objects:e.target.value.split('\n').map(l => { const [name,...state]=l.split('|'); return { name, state:state.join('|') }; }),stillPrompt:undefined }))}/></label><label className="text-sm">Still prompt<Textarea aria-label="Still prompt" value={draft.stillPrompt ?? ''} placeholder="Built from scene and every required object" onChange={e => setDraft(p => ({ ...p,stillPrompt:e.target.value }))}/></label><label className="text-sm">Motion prompt<Textarea aria-label="Motion prompt" value={draft.motionPrompt ?? ''} placeholder="Built from action, end state, camera and audio" onChange={e => setDraft(p => ({ ...p,motionPrompt:e.target.value }))}/></label><Button disabled={busy} onClick={() => run(async () => { if(!data.selected)return; await save({ data: { projectId:data.selected.id,sceneId:editing !== 'new' ? editing?.id : undefined,scene:{ ...draft,stillPrompt:draft.stillPrompt || undefined,motionPrompt:draft.motionPrompt || undefined } } }); setEditing(null); })}><Save className="size-4"/> Save scene</Button></DialogContent></Dialog>
    <Dialog open={confirmation !== null} onOpenChange={v => {if(!v)setConfirmation(null);}}><DialogContent><DialogHeader><DialogTitle>{confirmation?.operation === 'still' ? 'Still quote' : 'Animation quote'}</DialogTitle></DialogHeader>{confirmation && <><p className="break-words text-sm">{confirmation.q.model}</p><p className="text-sm">{confirmation.q.seconds} billable seconds × {confirmation.q.rate ?? 'input-dependent'} workspace credits/s</p><p className="font-semibold">Total: {confirmation.q.totalWorkspaceCredits ?? 'unset'} workspace credits · {confirmation.q.customerCredits ?? 'unset'} {confirmation.q.billingBalance} credits {confirmation.q.billingBalance==='video'?(STUDIO_PRICING.video.approved?'· approved':'· proposed'):''}</p>{confirmation.q.video&&<><p>{confirmation.q.video.equivalent}</p><p>{confirmation.q.video.afterwards}</p><p className="text-sm text-muted-foreground">Plan credits separately: {confirmation.q.planCharges.stills}; {confirmation.q.planCharges.storyboardWriting}; {confirmation.q.planCharges.analysis}. No plan charge in this animation.</p>{!confirmation.q.video.sufficient&&<VideoPackAvailability/>}</>}{confirmation.q.monthlyEquivalent && <p>{confirmation.q.monthlyEquivalent}</p>}{confirmation.q.usdCost!==null && <p className="text-sm">Direct cost: ${confirmation.q.usdCost.toFixed(4)}</p>}{confirmation.q.reason && <p role="alert" className="text-sm text-status-warning">{confirmation.q.reason}</p>}<Button disabled={!confirmation.q.available || busy} onClick={confirm}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Play className="size-4"/>} Confirm generation</Button></>}</DialogContent></Dialog>
  </div>;
}
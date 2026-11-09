import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Image, Film, LayoutGrid } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { getAnalysisById } from '@/lib/analyze.functions';
import { SourceWritingGuide } from './SourceWritingGuide';
import { CreationWizardShell } from './CreationWizardShell';
import { AppPage } from './AppPage';
import { CopyModePicker } from './CopyModePicker';
import { CopyWorkbench } from './CopyWorkbench';
import { ImageStudio } from './ImageStudio';
import { CarouselStudio } from './CarouselStudio';
import { ReelStudio } from './ReelStudio';
import { CopyStudio } from './CopyStudio';
import { InspirationStudio } from './InspirationStudio';
import { creationSources, loadCreationDraft, saveCreationDraft } from '@/lib/creation-drafts.functions';
import { EMPTY_CREATION, restoreCreation, resumeStep, type CreationState } from '@/lib/creation-draft';
import { updateProject, createProject } from '@/lib/projects.functions';
import { createInspirationProject } from '@/lib/inspiration.functions';
import { POST_GOALS } from '@/lib/post-goals';
import { CREDIT_BALANCE_KEY } from '@/lib/credits';
import { VIDEO_BALANCE_KEY } from '@/lib/studio-pricing';
import { getCreditBalance } from '@/lib/credits.functions';
import { getVideoCreditBalance } from '@/lib/video-credits.functions';

const instructions = [
  'Start with a post you like. Paste its Instagram or Facebook link, or pick one you have already checked. Then press Next.',
  'This is what we found in the post: its hook, structure and words. Have a look, then press Next.',
  'Give your project a name and pick what to make. For posts, also pick how close to the original it should be.',
  'Start with a direction from the source, or write your own message. Edit it until it sounds like you. Optional hooks and captions show their price before you start.',
  'Now make it. Go through each small step in the panel below. Nothing is charged until you press a button that shows a price.',
  'Your content is ready. Download it and copy your caption, then post it wherever you like.',
];
const formatHints: Record<string, string[]> = {
  reel: ['', '', '', 'Your reel script is written on the next step, after you approve the look of the reel.', 'For a reel: 1) Read the visual direction and approve it, 2) choose a style, 3) press "Generate script", then add audio and render.', ''],
  film: ['', '', '', 'Write your storyboard here: press "Write storyboard with AI" or fill in the scenes yourself.', 'Make a picture for each scene and approve it. Then turn approved pictures into moving clips.', 'Add the voiceover, put the film together and download it.'],
};

export function CreateProjectWizard() {
  const search = useSearch({ from: '/_authenticated/app' });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveCreationDraft), loadFn = useServerFn(loadCreationDraft), sourcesFn = useServerFn(creationSources);
  const updateFn = useServerFn(updateProject);
  const analysisFn = useServerFn(getAnalysisById);
  const createFn = useServerFn(createProject), filmFn = useServerFn(createInspirationProject);
  const balanceFn = useServerFn(getCreditBalance), videoFn = useServerFn(getVideoCreditBalance);
  const { data: credits } = useQuery({ queryKey: CREDIT_BALANCE_KEY, queryFn: () => balanceFn() });
  const { data: video } = useQuery({ queryKey: VIDEO_BALANCE_KEY, queryFn: () => videoFn() });
  const { data: sources = [] } = useQuery({ queryKey: ['creation-sources'], queryFn: () => sourcesFn() });
  const [state, setState] = useState<CreationState>({ ...EMPTY_CREATION, analysisId: search.analysisId, format:search.format??'image' });
  const [step, setStep] = useState(search.analysisId ? 1 : 0), [id, setId] = useState('');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [saved, setSaved] = useState('');
  const {data: writingSource} = useQuery({queryKey:['writing-source',state.analysisId],queryFn:()=>analysisFn({data:{id:state.analysisId ?? ''}}),enabled:!!state.analysisId && step===3});
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const closing = useRef(false);
  const current = useRef({ state, step }); current.current = { state, step };
  const patch = (p: Partial<CreationState>) => setState(s => ({ ...s, ...p }));
  useEffect(() => {
    let live = true;
    setReady(false);
    (async () => {
      try {
        if (search.draftId) {
          const d = await loadFn({ data: { id: search.draftId } });
          if (!live) return;
          setId(d.id); setState(restoreCreation(d.state)); setStep(resumeStep(d.step));
        } else {
          if (!live) return;
          setId(crypto.randomUUID()); setState({ ...EMPTY_CREATION, analysisId: search.analysisId, format: search.format??'image' }); setStep(search.analysisId ? 1 : 0);
        }
        setReady(true);
      } catch(e) { toast.error((e as Error).message); }
    })();
    return () => { live = false; };
  }, [search.draftId, search.format]);
  const persist = (nextStep = current.current.step, nextState = current.current.state, completed = false) => {
    if (!id) return Promise.resolve();
    setSaved('Saving…');
    const task = queue.current.catch(() => {}).then(() => saveFn({ data: { id, step: nextStep, state: nextState, title: nextState.title.trim() || 'Untitled project', completed } }));
    queue.current = task;
    return task.then(() => { setSaved('Draft saved'); qc.invalidateQueries({ queryKey: ['creation-drafts'] }); if (!search.draftId && !closing.current) navigate({to:'/app',search:{draftId:id},replace:true}); }).catch(e => { setSaved('Not saved'); throw e; });
  };
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { if(!closing.current) persist().catch(e => toast.error(`Draft not saved: ${e.message}`)); }, 700);
    return () => clearTimeout(timer);
  }, [state, step, ready]);
  const move = async (target: number) => {
    setBusy(true);
    try {
      let next = current.current.state;
      if (target===3 && !next.projectId && next.analysisId) {
        if (next.format!=='film' && (next.mode==='A0'||next.mode==='A1')) throw new Error('Confirm permission and open the copy first.');
        const preferences = { intent: next.mode, cloneMethod: next.mode, goal: next.goal || undefined, niche: next.niche || undefined, toneOfVoice: next.tone || undefined, targetAudience: next.audience || undefined, selectedPlatforms: next.platforms, angle: next.brief || undefined, speechMode: next.speechMode ?? 'voiceover' };
        const projectId = next.format==='film'
          ? (await filmFn({ data: { title: next.title.trim() || 'New film', analysisId: next.analysisId } })).id
          : (await createFn({ data: { analysisId: next.analysisId, format: next.format, title: next.title.trim() || 'New project', userPreferences: preferences } })).project.id;
        next = { ...next, projectId }; setState(next);
      }
      if (target===4 && next.projectId && next.format!=='film' && !next.copyProject) await updateFn({ data: { id: next.projectId, patch: { user_preferences: { intent:next.mode,cloneMethod:next.mode,goal:next.goal||undefined,niche:next.niche,toneOfVoice:next.tone,targetAudience:next.audience,selectedPlatforms:next.platforms,angle:next.brief,speechMode:next.speechMode??'voiceover' } } } });
      const tasks: Promise<unknown>[] = [];
      window.dispatchEvent(new CustomEvent('creation-save', { detail: { tasks } }));
      await Promise.all(tasks);
      await persist(target, next); setStep(target); window.scrollTo({ top: 0, behavior: 'instant' });
    } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const close = async (completed = false) => {
    closing.current = true;
    setBusy(true);
    try { const tasks: Promise<unknown>[]=[]; window.dispatchEvent(new CustomEvent('creation-save',{detail:{tasks}})); await Promise.all(tasks); await persist(step, current.current.state, completed);
      const s=current.current.state;
      if(completed&&s.projectId){
        const to=s.format==='film'?'/studio/inspiration':s.copyProject?'/studio/copy':s.format==='image'?'/studio/image':s.format==='carousel'?'/studio/carousel':'/studio/reel';
        await navigate({to,search:{projectId:s.projectId,...(s.format==='film'?{delivery:true}:{})}});
      }else await navigate({ to: '/projects' }); }
    catch(e) { closing.current=false; toast.error((e as Error).message); } finally { setBusy(false); }
  };
  if (!ready) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin"/></div>;
  const sourceId = state.analysisId;
  const production = (stage: 'make'|'deliver') => state.projectId ? <Suspense fallback={<p className="flex items-center gap-2 py-10"><Loader2 className="size-4 animate-spin"/>Loading saved content…</p>}>
    {state.format==='film' ? <InspirationStudio projectId={state.projectId} wizardStage={stage} speechMode={state.speechMode} wizardDraft={state.production} onWizardDraft={production => patch({ production })}/>
      : state.copyProject ? <CopyStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : state.format==='image' ? <ImageStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : state.format==='carousel' ? <CarouselStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : <ReelStudio embeddedProjectId={state.projectId} wizardStage={stage} speechMode={state.speechMode}/>}
  </Suspense> : null;
  return <CreationWizardShell step={step} instructions={[instructions[step], formatHints[state.format]?.[step]].filter(Boolean).join(' ')} saved={saved} busy={busy}
    disabled={(step<2&&!sourceId)||(step===2&&state.format!=='film'&&(state.mode==='A0'||state.mode==='A1')&&!state.projectId)}
    nextHint={step===0&&!sourceId?'Pick or analyze a post first':step===2&&state.format!=='film'&&(state.mode==='A0'||state.mode==='A1')&&!state.projectId?'Confirm permission first':undefined}
    onBack={() => move(step-1)} onNext={() => step===5?close(true):move(step+1)} onClose={() => close()}>
    
    {step===0 && <div className="space-y-5"><label className="block max-w-xl text-lg font-medium">Use a post you already checked<select aria-label="Choose saved analysis" value={sourceId??''} className="mt-3 w-full rounded-xl border border-input bg-background/70 p-4 text-base backdrop-blur" onChange={e => { patch({ analysisId: e.target.value || undefined, projectId: undefined, copyProject: false }); }}><option value="">No — I will paste a new link</option>{sources.map(s => <option key={s.id} value={s.id}>{s.source_account ?? s.instagram_url}</option>)}</select></label>{!sourceId && <AppPage embedded initialUrl={state.url} onUrlChange={url => patch({ url })} onAnalysisReady={analysisId => {const next={...current.current.state,analysisId};setState(next);setStep(1);persist(1,next).catch(e=>toast.error(e.message));window.scrollTo({top:0,behavior:'instant'});}}/>}</div>}
    {step===1 && sourceId && <AppPage key={sourceId} embedded sourceAnalysisId={sourceId} onAnalysisReady={() => {}}/>}
    {step===2 && sourceId && <div className="space-y-6"><label className="block max-w-xl text-lg font-medium">Project name<Input aria-label="Project name" className="mt-3 h-12 text-base" placeholder="For example: Spring launch post" value={state.title} onChange={e => patch({ title: e.target.value })}/></label><div className="grid gap-3 sm:grid-cols-4">{([{id:'image',label:'Image',Icon:Image},{id:'carousel',label:'Carousel',Icon:LayoutGrid},{id:'reel',label:'Reel',Icon:Film},{id:'film',label:'Video film',Icon:Film}] as const).map(f => <Button key={f.id} variant={state.format===f.id?'secondary':'outline'} className="h-20 text-base" disabled={!!state.projectId} onClick={() => patch({ format:f.id })}><f.Icon className="size-5"/>{f.label}</Button>)}</div>{state.format==='film' ? <p className="text-base text-muted-foreground">New scenes inspired by the post’s order and pacing, with your own subjects and words.</p> : <CopyModePicker analysisId={sourceId} value={state.mode} onChange={mode => patch({mode,projectId:undefined,copyProject:false})} onCreated={projectId => { patch({projectId,copyProject:true}); }}/>}</div>}
    {step===3 && <div className="space-y-8">{writingSource && <SourceWritingGuide analysis={writingSource} onUse={brief => patch({brief})}/>}<label className="block text-lg font-medium">Your message — use a direction above or start fresh<Textarea aria-label="Your message" className="mt-3 min-h-28 text-base" placeholder="What do you want people to know or do? One or two sentences is enough." value={state.brief} onChange={e => patch({brief:e.target.value})}/></label><details className="rounded-lg border border-border bg-card p-5"><summary className="cursor-pointer text-base font-medium">More options — goal, niche, audience and tone</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-base font-medium">What should this post achieve?<select aria-label="Post goal" value={state.goal} onChange={e => patch({ goal:e.target.value })} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-base"><option value="">Choose a goal</option>{POST_GOALS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label><label className="text-base font-medium">Your niche<Input aria-label="Your niche" className="mt-2 h-11 text-base" value={state.niche} onChange={e => patch({niche:e.target.value})}/></label><label className="text-base font-medium">Who is this for?<Input aria-label="Audience" className="mt-2 h-11 text-base" value={state.audience} onChange={e => patch({audience:e.target.value})}/></label><label className="text-base font-medium">Tone of voice<Input aria-label="Tone of voice" className="mt-2 h-11 text-base" value={state.tone} onChange={e => patch({tone:e.target.value})}/></label></div></details>{sourceId && state.format!=='film' && !state.copyProject && <CopyWorkbench analysisId={sourceId} projects={state.projectId?[{id:state.projectId,title:state.title||'This project'}]:[]} initialNiche={state.niche}/>}{state.format==='film' && state.projectId && <Suspense fallback={<p>Loading…</p>}><InspirationStudio projectId={state.projectId} wizardStage="words" speechMode={state.speechMode} wizardBrief={state.brief} wizardDraft={state.production} onWizardDraft={production => patch({production})}/></Suspense>}{state.copyProject && state.projectId && <CopyStudio embeddedProjectId={state.projectId} wizardStage="words"/>}</div>}
    {step===2 && (state.format==='film'||state.format==='reel') && <fieldset className="mt-6 space-y-3"><legend className="mb-3 text-lg font-medium">Will someone speak?</legend>{([{id:'voiceover',label:'Someone speaks (voiceover)'},{id:'silent',label:'No talking (music and text only)'}] as const).map(o=><label key={o.id} className="flex items-center gap-3 text-base"><input type="radio" name="speech-mode" checked={(state.speechMode??'voiceover')===o.id} onChange={()=>patch({speechMode:o.id})}/>{o.label}</label>)}</fieldset>}
    {step===4 && production('make')}
    {step===5 && production('deliver')}
  </CreationWizardShell>;
}
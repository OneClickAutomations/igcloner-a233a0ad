import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Image, Film, LayoutGrid } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
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
import { createProject } from '@/lib/projects.functions';
import { createInspirationProject } from '@/lib/inspiration.functions';
import { POST_GOALS } from '@/lib/post-goals';
import { CREDIT_BALANCE_KEY } from '@/lib/credits';
import { VIDEO_BALANCE_KEY } from '@/lib/studio-pricing';
import { getCreditBalance } from '@/lib/credits.functions';
import { getVideoCreditBalance } from '@/lib/video-credits.functions';

const instructions = [
  'Paste a public Instagram or Facebook link, or choose a post you already analyzed.',
  'Check what was found in the post before choosing what to make.',
  'Choose a format and how much you want to change.',
  'Add your message and audience. Generate hooks or captions only if you want them.',
  'Make your content one action at a time. Check each price before confirming.',
  'Check the finished content, download it, and copy the words for your social post.',
];

export function CreateProjectWizard() {
  const search = useSearch({ from: '/_authenticated/app' });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveCreationDraft), loadFn = useServerFn(loadCreationDraft), sourcesFn = useServerFn(creationSources);
  const createFn = useServerFn(createProject), filmFn = useServerFn(createInspirationProject);
  const balanceFn = useServerFn(getCreditBalance), videoFn = useServerFn(getVideoCreditBalance);
  const { data: credits } = useQuery({ queryKey: CREDIT_BALANCE_KEY, queryFn: () => balanceFn() });
  const { data: video } = useQuery({ queryKey: VIDEO_BALANCE_KEY, queryFn: () => videoFn() });
  const { data: sources = [] } = useQuery({ queryKey: ['creation-sources'], queryFn: () => sourcesFn() });
  const [state, setState] = useState<CreationState>({ ...EMPTY_CREATION, analysisId: search.analysisId });
  const [step, setStep] = useState(search.analysisId ? 1 : 0), [id, setId] = useState('');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [saved, setSaved] = useState('');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
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
          setId(crypto.randomUUID()); setState({ ...EMPTY_CREATION, analysisId: search.analysisId }); setStep(search.analysisId ? 1 : 0);
        }
        setReady(true);
      } catch(e) { toast.error((e as Error).message); }
    })();
    return () => { live = false; };
  }, [search.draftId]);
  const persist = (nextStep = current.current.step, nextState = current.current.state, completed = false) => {
    if (!id) return Promise.resolve();
    setSaved('Saving…');
    const task = queue.current.catch(() => {}).then(() => saveFn({ data: { id, step: nextStep, state: nextState, title: nextState.title.trim() || 'Untitled project', completed } }));
    queue.current = task;
    return task.then(() => { setSaved('Draft saved'); qc.invalidateQueries({ queryKey: ['creation-drafts'] }); }).catch(e => { setSaved('Not saved'); throw e; });
  };
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { persist().catch(e => toast.error(`Draft not saved: ${e.message}`)); }, 700);
    return () => clearTimeout(timer);
  }, [state, step, ready]);
  const move = async (target: number) => {
    setBusy(true);
    try {
      let next = current.current.state;
      if (target===3 && !next.projectId && next.analysisId) {
        if (next.mode==='A0'||next.mode==='A1') throw new Error('Confirm permission and open the copy first.');
        const preferences = { intent: next.mode, cloneMethod: next.mode, goal: next.goal || undefined, niche: next.niche || undefined, toneOfVoice: next.tone || undefined, targetAudience: next.audience || undefined, selectedPlatforms: next.platforms, angle: next.brief || undefined };
        const projectId = next.format==='film'
          ? (await filmFn({ data: { title: next.title.trim() || 'New film', analysisId: next.analysisId } })).id
          : (await createFn({ data: { analysisId: next.analysisId, format: next.format, title: next.title.trim() || 'New project', userPreferences: preferences } })).project.id;
        next = { ...next, projectId }; setState(next);
      }
      await persist(target, next); setStep(target); window.scrollTo({ top: 0, behavior: 'instant' });
    } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const close = async (completed = false) => {
    setBusy(true);
    try { await persist(step, current.current.state, completed); await navigate({ to: '/projects' }); }
    catch(e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  if (!ready) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin"/></div>;
  const sourceId = state.analysisId;
  const production = (stage: 'make'|'deliver') => state.projectId ? <Suspense fallback={<p className="flex items-center gap-2 py-10"><Loader2 className="size-4 animate-spin"/>Loading saved content…</p>}>
    {state.format==='film' ? <InspirationStudio projectId={state.projectId} wizardStage={stage} wizardDraft={state.production} onWizardDraft={production => patch({ production })}/>
      : state.copyProject ? <CopyStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : state.format==='image' ? <ImageStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : state.format==='carousel' ? <CarouselStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : <ReelStudio embeddedProjectId={state.projectId} wizardStage={stage}/>}
  </Suspense> : null;
  return <CreationWizardShell step={step} instructions={instructions[step]} saved={saved} busy={busy}
    disabled={(step<2&&!sourceId)||(step===2&&(state.mode==='A0'||state.mode==='A1')&&!state.projectId)}
    onBack={() => move(step-1)} onNext={() => step===5?close(true):move(step+1)} onClose={() => close()}>
    <div className="mb-5 flex flex-wrap justify-end gap-4 text-xs text-muted-foreground"><span>{credits?.balance ?? '…'} plan credits</span><span>{video?.balance ?? '…'} video credits</span></div>
    {step===0 && <div className="space-y-5"><label className="block max-w-xl text-sm">Use a saved analysis<select aria-label="Choose saved analysis" value={sourceId??''} className="mt-2 w-full rounded-md border border-input bg-background p-3" onChange={e => { patch({ analysisId: e.target.value || undefined, projectId: undefined, copyProject: false }); }}><option value="">Paste a new link instead</option>{sources.map(s => <option key={s.id} value={s.id}>{s.source_account ?? s.instagram_url}</option>)}</select></label>{!sourceId && <AppPage embedded initialUrl={state.url} onUrlChange={url => patch({ url })} onAnalysisReady={analysisId => patch({ analysisId })}/>}</div>}
    {step===1 && sourceId && <AppPage key={sourceId} embedded onAnalysisReady={() => {}}/>}
    {step===2 && sourceId && <div className="space-y-6"><label className="block max-w-xl text-sm">Project name<Input aria-label="Project name" className="mt-2" value={state.title} onChange={e => patch({ title: e.target.value })}/></label><div className="grid gap-3 sm:grid-cols-4">{([{id:'image',label:'Image',Icon:Image},{id:'carousel',label:'Carousel',Icon:LayoutGrid},{id:'reel',label:'Reel',Icon:Film},{id:'film',label:'Video film',Icon:Film}] as const).map(f => <Button key={f.id} variant={state.format===f.id?'secondary':'outline'} className="h-16" disabled={!!state.projectId} onClick={() => patch({ format:f.id })}><f.Icon className="size-5"/>{f.label}</Button>)}</div>{state.format==='film' ? <p className="text-sm text-muted-foreground">New scenes inspired by the post’s order and pacing, with your own subjects and words.</p> : <CopyModePicker analysisId={sourceId} value={state.mode} onChange={mode => patch({mode,projectId:undefined,copyProject:false})} onCreated={projectId => { patch({projectId,copyProject:true}); }}/>}</div>}
    {step===3 && <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">What should this post achieve?<select aria-label="Post goal" value={state.goal} onChange={e => patch({ goal:e.target.value })} className="mt-2 w-full rounded-md border border-input bg-background p-3"><option value="">Choose a goal</option>{POST_GOALS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label><label className="text-sm">Your niche<Input aria-label="Your niche" className="mt-2" value={state.niche} onChange={e => patch({niche:e.target.value})}/></label><label className="text-sm">Who is this for?<Input aria-label="Audience" className="mt-2" value={state.audience} onChange={e => patch({audience:e.target.value})}/></label><label className="text-sm">Tone of voice<Input aria-label="Tone of voice" className="mt-2" value={state.tone} onChange={e => patch({tone:e.target.value})}/></label></div><label className="block text-sm">Your message<Textarea aria-label="Your message" className="mt-2" value={state.brief} onChange={e => patch({brief:e.target.value})}/></label>{sourceId && state.format!=='film' && !state.copyProject && <CopyWorkbench analysisId={sourceId} projects={state.projectId?[{id:state.projectId,title:state.title||'This project'}]:[]} initialNiche={state.niche}/>}{state.format==='film' && state.projectId && <Suspense fallback={<p>Loading…</p>}><InspirationStudio projectId={state.projectId} wizardStage="words" wizardBrief={state.brief} wizardDraft={state.production} onWizardDraft={production => patch({production})}/></Suspense>}{state.copyProject && state.projectId && <CopyStudio embeddedProjectId={state.projectId} wizardStage="words"/>}</div>}
    {step===4 && production('make')}
    {step===5 && production('deliver')}
  </CreationWizardShell>;
}
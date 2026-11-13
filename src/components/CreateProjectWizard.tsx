import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Image, Film, LayoutGrid, Link2, FolderOpen, Pencil, Settings2, Mic, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { getAnalysisById } from '@/lib/analyze.functions';
import { ReviewCard } from './ReviewPostPrimitives';
import { SourceWritingGuide } from './SourceWritingGuide';
import { ReviewAndPublish } from './ReviewAndPublish';
import { FilmPublishScreen } from './FilmPublishScreen';
import { CreationWizardShell } from './CreationWizardShell';
import { AppPage } from './AppPage';
import { CopyModePicker } from './CopyModePicker';
import { CopyWorkbench } from './CopyWorkbench';
import { ImageStudio } from './ImageStudio';
import { CarouselStudio } from './CarouselStudio';
import { ReelStudio } from './ReelStudio';
import { CopyStudio } from './CopyStudio';
import { InspirationStudio } from './InspirationStudio';
import { RemixDirectionsPanel } from './RemixDirectionsPanel';
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
  'Review your content, choose where to post and edit your captions. Post now, schedule it, or save to your library.',
];
const formatHints: Record<string, string[]> = {
  reel: ['', '', '', 'Choose a source-based remake, then references, script, audio and length.', 'Review and approve your pictures, then animate the approved scenes.', ''],
  film: ['', '', '', 'Choose a source-based remake; scene editing is optional under Advanced.', 'Make a picture for each scene and approve it. Then turn approved pictures into moving clips.', 'Add the voiceover, put the film together and download it.'],
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
  const {data: writingSource} = useQuery({queryKey:['writing-source',state.analysisId],queryFn:()=>analysisFn({data:{id:state.analysisId ?? ''}}),enabled:!!state.analysisId && (step===1||step===3)});
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
        const projectId = (next.format==='film'||(next.format==='reel'&&(next.mode==='A2'||next.mode==='A3')))
          ? (await filmFn({ data: { title: next.title.trim() || 'New film', analysisId: next.analysisId } })).id
          : (await createFn({ data: { analysisId: next.analysisId, format: next.format, title: next.title.trim() || 'New project', userPreferences: preferences } })).project.id;
        next = { ...next, projectId, production: {...next.production, ...(next.format==='reel'&&(next.mode==='A2'||next.mode==='A3')?{simpleVideo:true}:{})} }; setState(next);
      }
      if (target===4 && next.projectId && next.format!=='film' && !next.production?.simpleVideo && !next.copyProject) await updateFn({ data: { id: next.projectId, patch: { user_preferences: { intent:next.mode,cloneMethod:next.mode,goal:next.goal||undefined,niche:next.niche,toneOfVoice:next.tone,targetAudience:next.audience,selectedPlatforms:next.platforms,angle:next.brief,speechMode:next.speechMode??'voiceover' } } } });
      const tasks: Promise<unknown>[] = [];
      window.dispatchEvent(new CustomEvent('creation-save', { detail: { tasks } }));
      await Promise.all(tasks);
      await persist(target, next); setStep(target); window.scrollTo({ top: 0, behavior: 'instant' });
    } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const close = async (completed = false) => {
    closing.current = true;
    setBusy(true);
    try { const tasks: Promise<unknown>[]=[]; window.dispatchEvent(new CustomEvent('creation-save',{detail:{tasks}})); await Promise.all(tasks); const snapshot=current.current.state;await persist(step, snapshot, completed);
      const s=current.current.state;
      if(completed&&s.projectId){
        const to=(s.format==='film'||s.production?.simpleVideo)?'/studio/inspiration':s.copyProject?'/studio/copy':s.format==='image'?'/studio/image':s.format==='carousel'?'/studio/carousel':'/studio/reel';
        await navigate({to,search:{projectId:s.projectId,...((s.format==='film'||s.production?.simpleVideo)?{delivery:true}:{})}});
      }else {toast.success('Draft saved. Resume from Projects.');await navigate({ to: '/projects' });} }
    catch(e) { closing.current=false; toast.error((e as Error).message); } finally { setBusy(false); }
  };
  if (!ready) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin"/></div>;
  const sourceId = state.analysisId;
  const simpleVideo = state.format==='film' || state.production?.simpleVideo === true;
  const publishing=simpleVideo&&state.production?.publishPlaceholder===true;
  const changePublish=async(open:boolean)=>{const next={...current.current.state,production:{...current.current.state.production,publishPlaceholder:open}};setState(next);await persist(5,next);window.scrollTo({top:0,behavior:'instant'});};
  const production = (stage: 'make'|'deliver') => state.projectId ? <Suspense fallback={<p className="flex items-center gap-2 py-10"><Loader2 className="size-4 animate-spin"/>Loading saved content…</p>}>
    {(state.format==='film'||state.production?.simpleVideo) ? <InspirationStudio projectId={state.projectId} wizardStage={stage} speechMode={(state.production?.speechMode as 'voiceover'|'silent'|undefined)??state.speechMode} wizardDraft={state.production} onWizardDraft={production => patch({ production })}/>
      : state.copyProject ? <CopyStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : state.format==='image' ? <ImageStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : state.format==='carousel' ? <CarouselStudio embeddedProjectId={state.projectId} wizardStage={stage}/>
      : <ReelStudio embeddedProjectId={state.projectId} wizardStage={stage} speechMode={state.speechMode}/>}
  </Suspense> : null;
  return <CreationWizardShell step={step} instructions={publishing&&step===5?'Choose accounts, edit your platform copy, then confirm publishing or scheduling.':simpleVideo&&step===5?'Review the film and each shot, adjust audio, then save your draft or continue to Publish.':[instructions[step], formatHints[state.format]?.[step]].filter(Boolean).join(' ')} saved={saved} busy={busy}
    disabled={(step<2&&!sourceId)||(step===2&&state.format!=='film'&&(state.mode==='A0'||state.mode==='A1')&&!state.projectId)}
    nextHint={step===0&&!sourceId?'Pick or analyze a post first':step===2&&state.format!=='film'&&(state.mode==='A0'||state.mode==='A1')&&!state.projectId?'Confirm permission first':undefined}
    filmReview={simpleVideo&&step===5} publishing={publishing&&step===5}
    onBack={() => publishing&&step===5?changePublish(false):move(step-1)} onNext={() => step===5&&simpleVideo?publishing?close():changePublish(true):step===5?close(true):move(step+1)} onClose={() => close()}>
    
    {step===0 && <div className="grid items-start gap-6 lg:grid-cols-2"><ReviewCard title="Paste a post link" icon={Link2}>{!sourceId ? <AppPage embedded initialUrl={state.url} onUrlChange={url => patch({ url })} onAnalysisReady={analysisId => {const next={...current.current.state,analysisId};setState(next);setStep(1);persist(1,next).catch(e=>toast.error(e.message));window.scrollTo({top:0,behavior:'instant'});}}/> : <><p className="mb-5 text-review-muted">A saved post is selected. You can use a different link instead.</p><Button variant="outline" onClick={()=>patch({analysisId:undefined,projectId:undefined,copyProject:false})}>Use a new link</Button></>}</ReviewCard><ReviewCard title="Choose an analysed post" icon={FolderOpen}><p className="mb-5 text-review-muted">Or pick a saved post. Its analysis is ready to use, with no new charge.</p><div className="space-y-3"><label id="saved-post-label" className="block text-sm font-semibold">Saved post</label><Select value={sourceId??''} onValueChange={analysisId => patch({ analysisId, projectId: undefined, copyProject: false })}><SelectTrigger aria-label="Choose saved analysis" aria-labelledby="saved-post-label" className="saved-post-trigger min-h-12 text-base"><SelectValue placeholder="Choose a saved post"/></SelectTrigger><SelectContent className="saved-post-menu" position="popper">{sources.length === 0 ? <SelectItem value="empty" disabled>No saved analyses yet</SelectItem> : sources.map((s, i) => <SelectItem key={s.id} value={s.id} className="saved-post-option"><span className="flex min-w-0 items-center gap-3"><FolderOpen className="size-5 shrink-0 text-primary"/><span className="min-w-0"><span className="block truncate font-semibold">{s.source_account || `Saved post ${i + 1}`}</span><span className="block truncate text-xs text-muted-foreground">{s.instagram_url}</span></span></span></SelectItem>)}</SelectContent></Select></div></ReviewCard></div>}
    {step===1 && sourceId && <AppPage key={sourceId} embedded sourceAnalysisId={sourceId} onAnalysisStarted={async analysisId=>{const next={...current.current.state,analysisId,projectId:undefined,production:{}};setState(next);await persist(1,next);}} onAnalysisReady={analysisId => {if(analysisId!==sourceId)patch({analysisId,projectId:undefined,production:{}});}}/>}
    {step===2 && sourceId && <div className="space-y-6"><ReviewCard title="What are you making?" icon={LayoutGrid}><label className="mb-6 block max-w-xl text-base font-medium">Project name<Input aria-label="Project name" className="mt-3 h-12 text-base" placeholder="For example: Spring launch post" value={state.title} onChange={e => patch({ title: e.target.value })}/></label><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([{id:'image',label:'Image',description:'One image with your message.',Icon:Image},{id:'carousel',label:'Carousel',description:'A swipe-through series of slides.',Icon:LayoutGrid},{id:'reel',label:'Reel',description:'A short video with a script and audio.',Icon:Film},{id:'film',label:'Video film',description:'A story made from animated scenes.',Icon:Film}] as const).map(f => <Button key={f.id} variant="outline" aria-pressed={state.format===f.id} className={`wizard-choice ${state.format===f.id?'wizard-selected':''}`} disabled={!!state.projectId} onClick={() => patch({ format:f.id })}><span className="flex w-full items-center justify-between"><f.Icon className="size-6 text-review-accent"/>{state.format===f.id&&<Check className="size-5 text-review-accent"/>}</span><span className="text-xl font-bold">{f.label}</span><span className="text-sm font-normal leading-relaxed text-review-muted">{f.description}</span></Button>)}</div></ReviewCard>{state.format==='film' ? <ReviewCard title="Your own story" icon={Film}><p className="text-base text-review-muted">New scenes inspired by the post’s order and pacing, with your own subjects and words.</p></ReviewCard> : <CopyModePicker wizard analysisId={sourceId} value={state.mode} onChange={mode => patch({mode,projectId:undefined,copyProject:false})} onCreated={projectId => { patch({projectId,copyProject:true}); }}/>}</div>}
    {step===3 && simpleVideo && state.projectId && writingSource && <Suspense fallback={<p>Loading proposals…</p>}><RemixDirectionsPanel analysis={writingSource} projectId={state.projectId} value={state.production} onChange={production=>patch({production})} onSpeech={speechMode=>patch({speechMode})}/></Suspense>}
    {step===3 && !simpleVideo && <div className="space-y-8"><div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"><ReviewCard title="Your message" icon={Pencil}><label className="block text-base font-medium">Use a starting direction or write your own<Textarea aria-label="Your message" className="mt-3 min-h-28 text-base" placeholder="What do you want people to know or do? One or two sentences is enough." value={state.brief} onChange={e => patch({brief:e.target.value})}/></label></ReviewCard>{writingSource && <SourceWritingGuide wizard selectedBrief={state.brief} analysis={writingSource} onUse={brief => patch({brief})}/>}</div><details className="review-card"><summary className="cursor-pointer text-base font-medium">More options — goal, niche, audience and tone</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-base font-medium">What should this post achieve?<select aria-label="Post goal" value={state.goal} onChange={e => patch({ goal:e.target.value })} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-base"><option value="">Choose a goal</option>{POST_GOALS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label><label className="text-base font-medium">Your niche<Input aria-label="Your niche" className="mt-2 h-11 text-base" value={state.niche} onChange={e => patch({niche:e.target.value})}/></label><label className="text-base font-medium">Who is this for?<Input aria-label="Audience" className="mt-2 h-11 text-base" value={state.audience} onChange={e => patch({audience:e.target.value})}/></label><label className="text-base font-medium">Tone of voice<Input aria-label="Tone of voice" className="mt-2 h-11 text-base" value={state.tone} onChange={e => patch({tone:e.target.value})}/></label></div></details>{sourceId && state.format!=='film' && !state.copyProject && <CopyWorkbench wizard analysisId={sourceId} projects={state.projectId?[{id:state.projectId,title:state.title||'This project'}]:[]} initialNiche={state.niche}/>}{state.format==='film' && state.projectId && <Suspense fallback={<p>Loading…</p>}><InspirationStudio projectId={state.projectId} wizardStage="words" speechMode={state.speechMode} wizardBrief={state.brief} wizardDraft={state.production} onWizardDraft={production => patch({production})}/></Suspense>}{state.copyProject && state.projectId && <CopyStudio embeddedProjectId={state.projectId} wizardStage="words"/>}</div>}
    {step===2 && state.format==='reel' && (state.mode==='A0'||state.mode==='A1') && <fieldset className="review-card mt-6 space-y-3"><legend className="px-2 text-xl font-bold">Will someone speak?</legend>{([{id:'voiceover',label:'Someone speaks (voiceover)'},{id:'silent',label:'No talking (music and text only)'}] as const).map(o=><label key={o.id} className="flex items-center gap-3 text-base"><input type="radio" name="speech-mode" checked={(state.speechMode??'voiceover')===o.id} onChange={()=>patch({speechMode:o.id})}/>{o.label}</label>)}</fieldset>}
    {step===4 && production('make')}
    {step===5 && state.projectId && (simpleVideo?publishing?<FilmPublishScreen projectId={state.projectId} draftId={id} onSaveDraft={()=>close()}/>:production('deliver'):<ReviewAndPublish wizard projectId={state.projectId} production={production('deliver')}/>)}
  </CreationWizardShell>;
}
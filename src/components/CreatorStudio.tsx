import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronDown, Download, Image as ImageIcon, Film, LayoutGrid, Loader2, RefreshCw, Sparkles, Upload, Wand2, Lightbulb, Shuffle, PenLine, ArrowLeft, ArrowRight, Settings2, History, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { AppPage } from './AppPage';
import { ReviewPostPanel } from './ReviewPostPanel';
import { ReviewAndPublish } from './ReviewAndPublish';
import { getAnalysisById } from '@/lib/analyze.functions';
import { createProject } from '@/lib/projects.functions';
import { creationSources } from '@/lib/creation-drafts.functions';
import { listProjectImages } from '@/lib/image.functions';
import { generateStudioIdeas, generateStudioImage, loadStudioProject, saveStudioState, uploadStudioSource } from '@/lib/creator-studio.functions';
import { DIRECTIONS, EDIT_TARGETS, GROUP_LABEL, STUDIO_STEPS, dnaSummary, shortlist, type StudioAspect, type StudioDirection, type StudioFormat, type StudioIdea } from '@/lib/creator-studio';
import { ACTION_COSTS, CREDIT_BALANCE_KEY } from '@/lib/credits';

type State = {
  step: number; analysisId?: string; sourcePath?: string; sourcePreview?: string; format: StudioFormat; direction: StudioDirection;
  ideas: StudioIdea[]; recommended: number; recommendedWhy: string; idea?: StudioIdea; own: string;
  keep: string; change: string[]; newText: string; textOnImage: boolean; aspect: StudioAspect; style: string; brandColors: string; notes: string; activeAsset?: string;
};
const EMPTY: State = { step: 0, format: 'image', direction: 'refresh', ideas: [], recommended: 0, recommendedWhy: '', own: '', keep: '', change: [], newText: '', textOnImage: true, aspect: '4:5', style: '', brandColors: '', notes: '' };
const FORMAT_CARDS = [{ id: 'image', label: 'Image', icon: ImageIcon, note: 'One scroll-stopping picture' }, { id: 'reel', label: 'Reel', icon: Film, note: 'Short video, scene by scene' }, { id: 'carousel', label: 'Carousel', icon: LayoutGrid, note: 'Swipeable multi-slide post' }] as const;
const STYLES = ['Photoreal', 'Cinematic', 'Editorial', 'Bold & vibrant', 'Minimal', 'Illustration'];

export function CreatorStudio() {
  const search = useSearch({ from: '/_authenticated/app' }) as { studio?: string };
  const navigate = useNavigate(), qc = useQueryClient();
  const loadFn = useServerFn(loadStudioProject), saveFn = useServerFn(saveStudioState), createFn = useServerFn(createProject), analysisFn = useServerFn(getAnalysisById);
  const ideasFn = useServerFn(generateStudioIdeas), imageFn = useServerFn(generateStudioImage), uploadFn = useServerFn(uploadStudioSource), listFn = useServerFn(listProjectImages);
  const [s, setS] = useState<State>(EMPTY);
  const [projectId, setProjectId] = useState<string | undefined>(search.studio);
  const [saved, setSaved] = useState(''); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false); const [tab, setTab] = useState<StudioIdea['group']>('engagement');
  const [advanced, setAdvanced] = useState(false); const [fullDna, setFullDna] = useState(false); const [editReq, setEditReq] = useState('');
  const [ideaMode, setIdeaMode] = useState<'ideas' | 'own' | 'surprise'>('ideas');
  const sourcesFn = useServerFn(creationSources);
  const { data: sources = [] } = useQuery({ queryKey: ['studio-sources'], queryFn: () => sourcesFn() });
  const loaded = useRef(false);
  const patch = (p: Partial<State>) => setS(v => ({ ...v, ...p }));

  useEffect(() => {
    if (loaded.current || !search.studio) return; loaded.current = true;
    loadFn({ data: { projectId: search.studio } }).then(r => { const st = JSON.parse(r.stateJson) as Partial<State>; setS({ ...EMPTY, ...st, analysisId: r.analysisId ?? st.analysisId }); }).catch(() => toast.error('That project could not be opened.'));
  }, [search.studio, loadFn]);

  // Autosave once a project exists.
  useEffect(() => {
    if (!projectId) return;
    setSaved('Saving…');
    const t = setTimeout(() => { const { sourcePreview: _p, ...rest } = s; saveFn({ data: { projectId, state: rest as any } }).then(() => setSaved('All changes saved')).catch(() => setSaved('Not saved')); }, 700);
    return () => clearTimeout(t);
  }, [s, projectId, saveFn]);

  const { data: analysis } = useQuery({ queryKey: ['studio-analysis', s.analysisId], enabled: Boolean(s.analysisId), queryFn: () => analysisFn({ data: { id: s.analysisId! } }) as Promise<any> });
  const { data: versions, refetch: refetchVersions } = useQuery({ queryKey: ['studio-versions', projectId], enabled: Boolean(projectId) && s.step >= 3, queryFn: () => listFn({ data: { projectId: projectId! } }) });
  const studioImages = (versions?.images ?? []).filter((v: any) => (v.metadata as any)?.studio);
  const active = studioImages.find((v: any) => v.filename === s.activeAsset) ?? studioImages[0];
  const summary = dnaSummary(analysis?.dna);

  const ensureProject = async (): Promise<string> => {
    if (projectId) return projectId;
    const fmt = s.format === 'carousel' ? 'carousel' : s.format === 'reel' ? 'reel' : 'image';
    const r: any = await createFn({ data: { analysisId: s.analysisId ?? null, format: fmt, title: analysis?.dna?.sourceAccount ? `From @${String(analysis.dna.sourceAccount).replace(/^@/, '')}` : 'Creator Studio project' } });
    const id = r?.project?.id ?? r?.id;
    loaded.current = true; setProjectId(id); navigate({ to: '/app', search: { studio: id } as any, replace: true });
    return id;
  };
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError('');
    try { await fn(); } catch (e) { const m = (e as Error).message; setError(m); toast.error(m); } finally { setBusy(''); qc.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY }); }
  };

  const onUpload = (file: File) => run('upload', async () => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Please upload a PNG, JPG or WebP picture.');
    if (file.size > 10_000_000) throw new Error('Please use a picture under 10 MB.');
    const id = await ensureProject();
    const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(file); });
    const up = await uploadFn({ data: { projectId: id, mime: file.type as any, base64 } });
    patch({ sourcePath: up.path, sourcePreview: up.url ?? undefined, step: 1, direction: 'edit' });
  });

  const getIdeas = (mode: 'ideas' | 'surprise' | 'more') => run('ideas', async () => {
    const id = await ensureProject();
    const r = await ideasFn({ data: { projectId: id, format: s.format, direction: s.direction, mode, own: s.own || undefined, requestKey: crypto.randomUUID() } });
    if (mode === 'more') patch({ ideas: [...s.ideas, ...r.ideas] });
    else patch({ ideas: r.ideas, recommended: r.recommendedIndex, recommendedWhy: r.recommendedWhy, idea: mode === 'surprise' ? r.ideas[r.recommendedIndex] : s.idea });
    if (mode === 'surprise') patch({ step: 3 });
  });

  const useOwnIdea = () => {
    if (s.own.trim().length < 5) { toast.error('Describe your idea in a few words first.'); return; }
    patch({ idea: { group: 'fresh', title: s.own.slice(0, 60), angle: 'Your idea', visual: s.own, hook: s.newText || '', reaction: '', why: 'Your own concept.', format: s.format }, step: 3 });
  };

  const generate = (edit?: string) => run(edit ? 'edit' : 'image', async () => {
    if (!s.idea) throw new Error('Pick an idea first.');
    const id = await ensureProject();
    const r: any = await imageFn({ data: { projectId: id, requestKey: crypto.randomUUID(), aspect: s.aspect, direction: s.direction, idea: { title: s.idea.title, visual: s.idea.visual, hook: s.idea.hook }, keep: s.keep || undefined, change: s.change as any, newText: s.newText || undefined, textOnImage: s.textOnImage, style: s.style || undefined, brandColors: s.brandColors || undefined, notes: s.notes || undefined, sourcePath: s.sourcePath, ...(edit && active ? { editOf: active.filename, editRequest: edit } : {}) } });
    patch({ activeAsset: r.asset.filename }); setEditReq('');
    await refetchVersions();
  });

  const goReelOrCarousel = () => navigate({ to: '/app', search: { advanced: true, format: s.format === 'reel' ? 'film' : 'carousel', ...(s.analysisId ? { analysisId: s.analysisId } : {}) } as any });
  const canNext = [Boolean(s.analysisId || s.sourcePath), true, Boolean(s.idea), Boolean(active), false][s.step];
  const next = async () => {
    if (s.step === 1 && s.format !== 'image') return goReelOrCarousel();
    if (s.step === 1) await run('save', async () => { await ensureProject(); });
    patch({ step: Math.min(4, s.step + 1) }); window.scrollTo({ top: 0 });
  };
  const visibleIdeas = showAll ? s.ideas.filter(i => i.group === tab) : shortlist(s.ideas, s.recommended);
  const recIdea = s.ideas[s.recommended];

  return <div className="creator-studio mx-auto w-full max-w-[1180px] px-4 py-6 lg:px-8 lg:py-10">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-[28px] font-extrabold tracking-tight sm:text-[34px]">Create High-Performing Content</h1>
        <p className="mt-1 text-base text-muted-foreground">Analyze a post, discover better ideas, and create content ready to publish.</p></div>
      <div className="flex items-center gap-3">{saved && <span className="text-sm text-muted-foreground" aria-live="polite">{saved}</span>}
        <Button variant="outline" size="sm" onClick={() => navigate({ to: '/app', search: { advanced: true } as any })}><Settings2 className="size-4" />Advanced Studio</Button></div>
    </header>

    <ol className="cs-progress mb-8" aria-label="Progress">{STUDIO_STEPS.map((label, i) => <li key={label}>
      <button type="button" disabled={i > s.step} onClick={() => patch({ step: i })} aria-current={i === s.step ? 'step' : undefined} className={`cs-step ${i < s.step ? 'is-done' : ''} ${i === s.step ? 'is-current' : ''}`}>
        <span className="cs-dot">{i < s.step ? <Check className="size-4" /> : i + 1}</span><span className="cs-label">{label}</span></button></li>)}</ol>

    {error && <div role="alert" className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}

    {s.step === 0 && <section className="space-y-6">
      {!s.analysisId && <div className="cs-panel">
        <h2 className="cs-h2">Paste a URL</h2><p className="cs-sub mb-5">A public Instagram or Facebook post, Reel or carousel. Analysis costs {ACTION_COSTS.analysis} credits.</p>
        <AppPage embedded onAnalysisReady={id => { patch({ analysisId: id }); setProjectId(undefined); }} />
        {sources.length > 0 && <label className="mt-6 block"><span className="cs-h3">Or reuse a post you already analyzed</span><span className="block text-sm text-muted-foreground">No new charge.</span>
          <select aria-label="Saved analyzed post" className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-3 text-base" value="" onChange={e => { if (e.target.value) { patch({ analysisId: e.target.value }); setProjectId(undefined); } }}>
            <option value="">Choose a saved post</option>{sources.map((src: any) => <option key={src.id} value={src.id}>{src.source_account ? `@${String(src.source_account).replace(/^@/, '')} — ` : ''}{src.instagram_url}</option>)}</select></label>}
        <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" /></div>
        <label className="cs-upload"><Upload className="size-5" /><span><b>Upload your own picture</b><span className="block text-sm text-muted-foreground">PNG, JPG or WebP up to 10 MB — best for editing text or details</span></span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy === 'upload'} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />{busy === 'upload' && <Loader2 className="ml-auto size-5 animate-spin" />}</label>
      </div>}
      {s.analysisId && !analysis && <div className="cs-panel flex items-center gap-3"><Loader2 className="size-5 animate-spin" />Loading your analysis…</div>}
      {s.analysisId && analysis && <>
        <div className="cs-panel">
          <p className="cs-eyebrow">Content DNA</p>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <div><h3 className="cs-h3">What worked</h3><ul className="cs-list">{summary.worked.length ? summary.worked.map(w => <li key={w}><Check className="size-4 shrink-0 text-status-success" />{w}</li>) : <li className="text-muted-foreground">Not recorded for this post.</li>}</ul></div>
            <div><h3 className="cs-h3">What could be better</h3><ul className="cs-list">{summary.improve.length ? summary.improve.map(w => <li key={w}><span className="cs-bullet" />{w}</li>) : <li className="text-muted-foreground">Not recorded for this post.</li>}</ul></div>
            <div className="cs-opportunity"><h3 className="cs-h3">The opportunity</h3><p>{summary.opportunity || 'Open the full Content DNA to choose what to improve.'}</p><p className="mt-2 text-xs text-muted-foreground">AI interpretation of the saved analysis</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3"><Button size="lg" onClick={() => patch({ step: 1 })}>Create Something Better<ArrowRight className="size-4" /></Button>
            <Button variant="outline" size="lg" onClick={() => setFullDna(v => !v)} aria-expanded={fullDna}>View Full Content DNA<ChevronDown className={`size-4 transition-transform ${fullDna ? 'rotate-180' : ''}`} /></Button>
            <Button variant="ghost" size="lg" onClick={() => { setS(EMPTY); setProjectId(undefined); navigate({ to: '/app', search: {} as any, replace: true }); }}>Analyze a different post</Button></div>
        </div>
        {fullDna && <ReviewPostPanel analysisId={s.analysisId} scraped={analysis.scraped} dna={analysis.dna} blueprint={analysis.blueprint} transcript={analysis.transcript ?? null} analysisConfidence={analysis.analysisConfidence ?? null} url={analysis.instagramUrl ?? ''} />}
      </>}
    </section>}

    {s.step === 1 && <section className="space-y-8">
      <div><h2 className="cs-h2">What would you like to create?</h2>
        <div role="radiogroup" aria-label="Format" className="mt-4 grid gap-4 sm:grid-cols-3">{FORMAT_CARDS.map(f => <button key={f.id} type="button" role="radio" aria-checked={s.format === f.id} onClick={() => patch({ format: f.id })} className={`cs-card ${s.format === f.id ? 'is-selected' : ''}`}>
          <span className="cs-icon"><f.icon className="size-5" /></span><span className="cs-card-title">{f.label}</span><span className="text-sm text-muted-foreground">{f.note}</span>
          {(analysis?.dna?.postType ?? '').toLowerCase().includes(f.id === 'image' ? 'image' : f.id) && <span className="cs-pill">Matches source</span>}</button>)}</div>
        {s.format !== 'image' && <p className="mt-3 text-sm text-muted-foreground">Reels and carousels open in the Advanced Studio with this post selected. The guided flow for them is coming next.</p>}</div>
      {s.format === 'image' && <div><h2 className="cs-h2">How should we recreate the idea?</h2>
        <div role="radiogroup" aria-label="Creative direction" className="mt-4 grid gap-4 md:grid-cols-3">{DIRECTIONS.map((d, i) => <button key={d.id} type="button" role="radio" aria-checked={s.direction === d.id} onClick={() => patch({ direction: d.id })} className={`cs-card cs-direction ${s.direction === d.id ? 'is-selected' : ''}`}>
          <span className={`cs-illus cs-illus-${i}`} aria-hidden><span /><span /><span /></span>
          <span className="cs-card-title">{d.title}</span><span className="text-[15px]">{d.tagline}</span><span className="text-sm text-muted-foreground">e.g. {d.example}</span>
          {s.direction === d.id && <Check className="absolute right-4 top-4 size-5 text-primary" />}</button>)}</div>
        {s.direction === 'edit' && <div className="cs-panel mt-6 grid gap-5 md:grid-cols-2">
          <div><h3 className="cs-h3">What should change?</h3><div className="mt-3 flex flex-wrap gap-2">{EDIT_TARGETS.map(t => <button key={t} type="button" aria-pressed={s.change.includes(t)} onClick={() => patch({ change: s.change.includes(t) ? s.change.filter(x => x !== t) : [...s.change, t] })} className={`cs-chip ${s.change.includes(t) ? 'is-on' : ''}`}>{t}</button>)}</div></div>
          <div className="space-y-3"><label className="block"><span className="cs-h3">What should stay the same?</span><Input className="mt-2" value={s.keep} onChange={e => patch({ keep: e.target.value })} placeholder="e.g. the person and the wall" /></label>
            {s.change.includes('Text') && <label className="block"><span className="cs-h3">What should the new text say?</span><Input className="mt-2" value={s.newText} onChange={e => patch({ newText: e.target.value })} placeholder="Your new words" /></label>}</div>
        </div>}
      </div>}
    </section>}

    {s.step === 2 && <section className="space-y-6">
      <div className="cs-panel"><h2 className="cs-h2">Want IGCloner to come up with ideas for you?</h2>
        <div role="radiogroup" className="mt-4 grid gap-3 sm:grid-cols-3">{([['ideas', 'Generate 15 Ideas', Lightbulb], ['own', 'I Have My Own Idea', PenLine], ['surprise', 'Surprise Me', Shuffle]] as const).map(([id, label, Icon]) => <button key={id} type="button" role="radio" aria-checked={ideaMode === id} onClick={() => setIdeaMode(id)} className={`cs-card cs-compact ${ideaMode === id ? 'is-selected' : ''}`}><Icon className="size-5 text-primary" /><span className="font-semibold">{label}</span></button>)}</div>
        {ideaMode === 'own' ? <div className="mt-5 space-y-3"><Textarea value={s.own} onChange={e => patch({ own: e.target.value })} rows={3} placeholder="Describe the picture you want, in your own words" /><div className="flex flex-wrap gap-3"><Button onClick={useOwnIdea}>Use my idea<ArrowRight className="size-4" /></Button><Button variant="outline" disabled={!!busy} onClick={() => getIdeas('ideas')}>{busy === 'ideas' && <Loader2 className="size-4 animate-spin" />}Build 15 ideas from it · {ACTION_COSTS.ideas} credits</Button></div></div>
          : <Button size="lg" className="mt-5" disabled={!!busy} onClick={() => getIdeas(ideaMode === 'surprise' ? 'surprise' : 'ideas')}>{busy === 'ideas' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{busy === 'ideas' ? 'Thinking up ideas…' : `${ideaMode === 'surprise' ? 'Surprise me' : 'Generate ideas'} · ${ACTION_COSTS.ideas} credits`}</Button>}
      </div>
      {s.ideas.length > 0 && <div className="space-y-4">
        {recIdea && s.recommendedWhy && <p className="text-sm text-muted-foreground"><Star className="mr-1 inline size-4 text-primary" />AI recommended “{recIdea.title}”: {s.recommendedWhy}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="cs-h2">{showAll ? 'All ideas' : 'Top picks for you'}</h2><Button variant="outline" size="sm" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show top 3' : `Explore all ${s.ideas.length}`}</Button></div>
        {showAll && <div role="tablist" className="flex flex-wrap gap-2">{(['engagement', 'bold', 'fresh'] as const).map(g => <button key={g} role="tab" aria-selected={tab === g} onClick={() => setTab(g)} className={`cs-chip ${tab === g ? 'is-on' : ''}`}>{GROUP_LABEL[g]}</button>)}</div>}
        <div className="grid gap-4 md:grid-cols-3">{visibleIdeas.map(idea => { const n = s.ideas.indexOf(idea); const sel = s.idea?.title === idea.title; return <article key={n} className={`cs-idea ${sel ? 'is-selected' : ''}`}>
          <div className="flex items-center justify-between gap-2"><span className="cs-eyebrow">Idea {String(n + 1).padStart(2, '0')} · {GROUP_LABEL[idea.group]}</span>{n === s.recommended && <span className="cs-pill">AI Recommended</span>}</div>
          <h3 className="cs-card-title mt-2">{idea.title}</h3>
          <p className="mt-2 text-[15px] font-semibold">“{idea.hook}”</p>
          <dl className="mt-3 space-y-2 text-sm"><div><dt className="cs-dt">The angle</dt><dd>{idea.angle}</dd></div><div><dt className="cs-dt">Visual</dt><dd>{idea.visual}</dd></div><div><dt className="cs-dt">Why it could work</dt><dd className="text-muted-foreground">{idea.why}</dd></div></dl>
          <Button className="mt-4 w-full" variant={sel ? 'default' : 'outline'} onClick={() => patch({ idea })}>{sel ? <><Check className="size-4" />Selected</> : 'Select this idea'}</Button></article>; })}</div>
        <Button variant="ghost" disabled={!!busy} onClick={() => getIdeas('more')}>{busy === 'ideas' ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Get 5 more ideas · {ACTION_COSTS.ideas} credits</Button>
      </div>}
    </section>}

    {s.step === 3 && s.idea && <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      <div className="cs-panel cs-preview">
        {busy === 'image' || busy === 'edit' ? <div className="cs-preview-empty"><Loader2 className="size-8 animate-spin text-primary" /><p className="mt-3 font-semibold">{busy === 'edit' ? 'Applying your change…' : 'Creating your picture…'}</p><p className="text-sm text-muted-foreground">This usually takes under a minute. Keep this page open.</p></div>
          : active ? <img src={active.url} alt={`Generated: ${s.idea.title}`} className="mx-auto max-h-[70vh] w-auto rounded-xl" />
          : <div className="cs-preview-empty"><ImageIcon className="size-10 text-muted-foreground" /><p className="mt-3 font-semibold">Your picture will appear here</p></div>}
        {active && !busy && <div className="mt-5 space-y-3">
          <div className="flex gap-2"><Input value={editReq} onChange={e => setEditReq(e.target.value)} placeholder="Ask for a change, e.g. make the background darker" aria-label="Describe a change" onKeyDown={e => { if (e.key === 'Enter' && editReq.trim()) generate(editReq.trim()); }} />
            <Button className="shrink-0 whitespace-nowrap" variant="secondary" disabled={!editReq.trim()} onClick={() => generate(editReq.trim())}><Wand2 className="size-4" />Apply · {ACTION_COSTS.imageGeneration} credit</Button></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => generate()}><RefreshCw className="size-4" />Try another version · {ACTION_COSTS.imageGeneration}</Button>
            <Button variant="outline" asChild><a href={active.url} download target="_blank" rel="noreferrer"><Download className="size-4" />Download</a></Button></div>
        </div>}
        {studioImages.length > 1 && <div className="mt-5"><p className="cs-dt mb-2 flex items-center gap-1"><History className="size-3.5" />Versions</p><div className="flex gap-2 overflow-x-auto pb-1">{studioImages.map((v: any) => <button key={v.id} type="button" onClick={() => patch({ activeAsset: v.filename })} aria-label="Show this version" aria-pressed={v.filename === active?.filename} className={`cs-thumb ${v.filename === active?.filename ? 'is-on' : ''}`}><img src={v.url} alt="" /></button>)}</div></div>}
      </div>
      <aside className="space-y-4">
        <div className="cs-panel"><p className="cs-eyebrow">Selected idea</p><h3 className="cs-card-title mt-2">{s.idea.title}</h3><p className="mt-1 text-sm text-muted-foreground">{DIRECTIONS.find(d => d.id === s.direction)?.title}</p>
          <label className="mt-4 block"><span className="cs-dt">What the picture shows</span><Textarea className="mt-1" rows={3} value={s.idea.visual} onChange={e => patch({ idea: { ...s.idea!, visual: e.target.value } })} /></label>
          <label className="mt-3 block"><span className="cs-dt">Text on the picture</span><Input className="mt-1" value={s.newText || s.idea.hook} onChange={e => patch({ newText: e.target.value })} disabled={!s.textOnImage} /></label>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.textOnImage} onChange={e => patch({ textOnImage: e.target.checked })} />Put text on the picture</label>
          <div className="mt-4"><span className="cs-dt">Shape</span><div className="mt-1 flex gap-2">{(['4:5', '1:1', '9:16'] as const).map(a => <button key={a} type="button" aria-pressed={s.aspect === a} onClick={() => patch({ aspect: a })} className={`cs-chip ${s.aspect === a ? 'is-on' : ''}`}>{a}</button>)}</div></div>
          <button type="button" className="mt-4 flex w-full items-center justify-between text-sm font-semibold" aria-expanded={advanced} onClick={() => setAdvanced(v => !v)}>Advanced Creative Settings<ChevronDown className={`size-4 transition-transform ${advanced ? 'rotate-180' : ''}`} /></button>
          {advanced && <div className="mt-3 space-y-3"><div className="flex flex-wrap gap-2">{STYLES.map(st => <button key={st} type="button" aria-pressed={s.style === st} onClick={() => patch({ style: s.style === st ? '' : st })} className={`cs-chip ${s.style === st ? 'is-on' : ''}`}>{st}</button>)}</div>
            <Input value={s.brandColors} onChange={e => patch({ brandColors: e.target.value })} placeholder="Brand colors, e.g. black and gold" aria-label="Brand colors" />
            <Textarea rows={2} value={s.notes} onChange={e => patch({ notes: e.target.value })} placeholder="Anything else? e.g. outdoor, golden hour" aria-label="Extra instructions" /></div>}
          <Button size="lg" className="mt-5 w-full" disabled={!!busy} onClick={() => generate()}>{busy === 'image' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{active ? 'Generate a new version' : 'Generate image'} · {ACTION_COSTS.imageGeneration} credit</Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Failed pictures are refunded automatically.</p>
        </div>
      </aside>
    </section>}

    {s.step === 4 && projectId && <ReviewAndPublish wizard projectId={projectId} />}

    <nav className="cs-nav mt-10" aria-label="Step navigation">
      <Button variant="outline" disabled={s.step === 0} onClick={() => patch({ step: Math.max(0, s.step - 1) })}><ArrowLeft className="size-4" />Back</Button>
      {s.step < 4 && <Button disabled={!canNext || !!busy} onClick={next}>{s.step === 1 && s.format !== 'image' ? 'Open in Advanced Studio' : s.step === 3 ? 'Continue to Publish' : 'Continue'}<ArrowRight className="size-4" /></Button>}
    </nav>
  </div>;
}

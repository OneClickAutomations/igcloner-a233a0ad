import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Film, Plus, Download, Check, ImagePlus, Play, Trash2, Save, Pencil, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { AssemblyDelivery } from './AssemblyDelivery';
import { StudioCostWorksheet } from './StudioCostWorksheet';
import { supabase } from '@/integrations/supabase/client';
import { VIDEO_BALANCE_KEY,STUDIO_PRICING,videoCreditsForWorkspace,videoBalanceQuote } from '@/lib/studio-pricing';
import { VideoPackAvailability } from './VideoPackAvailability';
import { CREDIT_BALANCE_KEY } from '@/lib/credits';
import { STUDIO_MODELS, type SceneDraft, type ObjectCheck } from '@/lib/inspiration';
import { getInspirationStudio, createInspirationProject, saveInspirationScene, manageInspirationReference, approveInspirationStill, inspirationQuote, animateInspirationScene, recoverInspirationClips, finishInspirationStill, writeInspirationStoryboard } from '@/lib/inspiration.functions';

export const inspirationQuery = (projectId?: string) => queryOptions({ queryKey: ['inspiration-studio', projectId], queryFn: () => getInspirationStudio({ data: { projectId } }) });
type StudioData = Awaited<ReturnType<typeof getInspirationStudio>>;
type Scene = StudioData['scenes'][number];
const blank: SceneDraft = { environment: 'A new sunlit garden table', action: 'A hand pours water from the open bottle into the cup', endState: 'The cup is half full and the bottle rests upright', camera: 'One slow push-in', audio: 'Water pouring and outdoor ambience', duration: 8, objects: [{ name: 'cup', state: 'empty, beside the bottle' }, { name: 'open bottle', state: 'open, hand gripping it; cap resting on the table' }] };
const kinds = [{ id: 'character_face', label: 'Face anchor' }, { id: 'character_body', label: 'Full body' }, { id: 'character_back', label: 'Back view' }, { id: 'product', label: 'Product' }, { id: 'logo', label: 'Logo' }] as const;

export function InspirationStudio({ projectId }: { projectId?: string }) {
  const { data } = useSuspenseQuery(inspirationQuery(projectId));
  const navigate = useNavigate(); const qc = useQueryClient();
  const create = useServerFn(createInspirationProject), save = useServerFn(saveInspirationScene), refs = useServerFn(manageInspirationReference), approve = useServerFn(approveInspirationStill), quote = useServerFn(inspirationQuote), animate = useServerFn(animateInspirationScene), recover = useServerFn(recoverInspirationClips), finish = useServerFn(finishInspirationStill), write = useServerFn(writeInspirationStoryboard);
  const [tab, setTab] = useState<'storyboard'|'references'|'observations'|'delivery'>('storyboard');
  const [newProject, setNewProject] = useState(false), [title, setTitle] = useState(''), [analysisId, setAnalysisId] = useState('');
  const [editing, setEditing] = useState<Scene | 'new' | null>(null), [draft, setDraft] = useState<SceneDraft>(blank);
  const [busy, setBusy] = useState(false), [checks, setChecks] = useState<Record<string,ObjectCheck[]>>({});
  const [model, setModel] = useState<(typeof STUDIO_MODELS)[number]['id']>('google/veo-3.1-fast');
  const [confirmation, setConfirmation] = useState<{ scene: Scene; operation: 'still'|'animate'; q: Awaited<ReturnType<typeof inspirationQuote>> } | null>(null);
  const [partial, setPartial] = useState<Record<string,{ url: string; final: boolean }>>({});
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
  const confirm = async () => {
    if (!confirmation || confirmation.q.customerCredits === null) return;
    const c = confirmation; setConfirmation(null); const requestKey = crypto.randomUUID();
    await run(async () => {
      if (c.operation === 'animate') { await animate({ data: { sceneId: c.scene.id, model, requestKey, revision: c.q.revision, confirmedCredits: c.q.customerCredits ?? 0 } }); return; }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Sign in required.');
      const { streamImage } = await import('@/lib/inspiration-stream');
      let image = '';
      try {
        await streamImage('/api/public/inspiration-still', { sceneId: c.scene.id, requestKey, revision: c.q.revision, confirmedCredits: c.q.customerCredits }, (url, final) => { setPartial(p => ({ ...p, [c.scene.id]: { url, final } })); if (final) image = url.split(',')[1]; }, undefined, { Authorization: `Bearer ${session.session.access_token}` });
        await finish({ data: { requestKey, base64: image } });
      } catch(e) { await finish({ data: { requestKey, error: (e as Error).message } }).catch(() => {}); throw e; }
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
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Film className="size-4"/> Production / Structure-only inspiration</div><h1 className="text-3xl font-bold">Video Inspiration Studio</h1><p className="mt-2 text-sm text-muted-foreground">New subjects, settings and words. Never copy a real person’s likeness.</p></div>
      <Button onClick={() => setNewProject(true)}><Plus className="size-4"/> New film</Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 py-5">
      <select aria-label="Film" className="max-w-full rounded-md border border-input bg-background p-2 text-sm" value={data.selected?.id ?? ''} onChange={e => navigate({ to: '/studio/inspiration', search: { projectId: e.target.value } })}><option value="" disabled>Select a film</option>{data.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
      <span className="text-sm font-semibold">{data.videoBalance} video credits · separate balance</span><span className="text-sm text-muted-foreground">9:16 · 720p · {data.scenes.length} scenes · {completed.length} clips</span>
    </div>
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border">{(['storyboard','references','observations','delivery'] as const).map(t => <Button key={t} variant={tab === t ? 'secondary' : 'ghost'} className="mb-2 capitalize" onClick={() => setTab(t)}>{t}</Button>)}</div>
    {data.videoBalance===0&&<div role="status" className="mb-5 flex flex-wrap items-center gap-4 border-b border-border pb-5"><div><p className="font-semibold">You need video credits to animate scenes, narrate and render.</p><p className="text-sm text-muted-foreground">Storyboards and stills use plan credits and still work. Everything you make stays saved; nothing is charged.</p></div><VideoPackAvailability/></div>}
    {data.selected?.pause_reason && <p role="alert" className="mb-5 text-destructive">Paused: {data.selected.pause_reason}</p>}
    {!data.selected && tab !== 'references' ? <div className="py-16 text-center"><Film className="mx-auto mb-5 size-12 text-muted-foreground"/><h2 className="text-xl font-semibold">Your first film</h2><Button className="mt-5" onClick={() => setNewProject(true)}><Plus className="size-4"/> Create film</Button></div> : null}
    {tab === 'storyboard' && data.selected && <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{data.selected.title}</h2><p className="text-xs text-muted-foreground">{data.sourceAnalysis ? <>Inspired by <a className="underline" href={data.sourceAnalysis.instagram_url} target="_blank" rel="noreferrer">{data.sourceAnalysis.source_account ?? data.sourceAnalysis.instagram_url}</a></> : 'No source post recorded'}</p></div><div className="flex flex-wrap gap-2"><select aria-label="Animation model" value={model} onChange={e => setModel(e.target.value as typeof model)} className="max-w-full rounded-md border border-input bg-background p-2 text-sm">{STUDIO_MODELS.map(m => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}</select>{data.sourceAnalysis && !data.scenes.length && <Button disabled={busy} onClick={() => run(async () => { const r = await write({ data: { projectId: data.selected!.id, brief: '' } }); toast.success(`${r.scenes} scenes written · ${r.charged} plan credits. Edit any field before generating stills.`); })}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Pencil className="size-4"/>} Write storyboard with AI · {data.storyboardPlanCredits} plan credits</Button>}<Button variant="outline" onClick={() => edit()}><Plus className="size-4"/> Add scene</Button></div></div>
      {(()=>{const rate=STUDIO_PRICING.rates[model];const seconds=data.scenes.reduce((n,s)=>n+s.duration,0);if(rate===null||!seconds)return null;const v=videoBalanceQuote(data.scenes.reduce((n,s)=>n+videoCreditsForWorkspace(s.duration*rate),0)+Math.ceil(seconds/60*STUDIO_PRICING.renderUsdPerMinute/STUDIO_PRICING.video.unitCostUsd),data.videoBalance,seconds);return <div className="mb-5 space-y-2 text-sm"><p className="font-semibold">{STUDIO_PRICING.video.approved?'Approved':'Proposed'} clip + render budget: {v.equivalent}</p><p>{v.afterwards}</p><p className="text-muted-foreground">Plan credits separately: stills priced per still · AI storyboard {data.storyboardPlanCredits} · manual storyboard 0 · cached analysis import 0 (new analysis 3). Generated voiceover cost unset and excluded. No total is final.</p></div>;})()}
      <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">{data.scenes.map(s => {
        const objects = s.action_objects as unknown as SceneDraft['objects']; const checked = checks[s.id] ?? s.object_checks as unknown as ObjectCheck[];
        const clip = data.attempts.find(a => a.scene_id === s.id && a.operation === 'animate'); const image = partial[s.id]?.url ?? s.preview;
        return <article key={s.id} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><h3 className="font-semibold">Scene {s.scene_order+1}</h3><span className="text-xs text-muted-foreground">{s.duration}s · {s.status.replaceAll('_',' ')}</span></div>
          <div className="mx-auto aspect-[9/16] w-full max-w-64 bg-muted">{clip?.status === 'completed' && clip.preview ? <video controls playsInline src={clip.preview} className="h-full w-full object-contain"/> : image ? <img src={image} alt={`Scene ${s.scene_order+1} still`} className={`h-full w-full object-contain ${partial[s.id] && !partial[s.id].final ? 'blur-2xl' : ''}`}/> : <div className="flex h-full items-center justify-center"><ImagePlus className="size-10 text-muted-foreground"/></div>}</div>
          <div className="space-y-4 p-4"><div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">This still contains</p>{objects.map(o => {
            const value = checked.some(c => c.name === o.name && c.state === o.state && c.present);
            return <label key={o.name} className="mb-2 flex items-start gap-2 text-sm"><Checkbox disabled={!s.preview || Boolean(s.approved_at)} checked={value} onCheckedChange={v => setChecks(old => ({ ...old, [s.id]: [...checked.filter(c => c.name !== o.name), { ...o, present: v === true, reason: 'User visually confirmed the approved still' }] }))}/><span>{o.name} {value ? '✓' : '— not verified'}<small className="block text-muted-foreground">{o.state}</small></span></label>;
          })}</div>
          {objects.some(o => !checked.some(c => c.name === o.name && c.state === o.state && c.present)) && <p className="flex gap-2 text-xs text-status-warning"><AlertTriangle className="size-4 shrink-0"/> Action objects must be visible in their stated initial states.</p>}
          <details><summary className="cursor-pointer text-sm font-medium">Still & motion prompts</summary><p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{s.still_prompt}</p><p className="mt-3 whitespace-pre-wrap break-words text-xs">{s.motion_prompt}</p></details>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => edit(s)}><Pencil className="size-3"/> Edit</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => setConfirmation({ scene: s, operation: 'still', q: await quote({ data: { sceneId: s.id, model, operation: 'still' } }) }))}><ImagePlus className="size-3"/> {s.preview ? 'Regenerate still' : 'Generate still'}</Button>
          {!s.approved_at && <Button size="sm" variant="secondary" disabled={!s.preview || busy} onClick={() => run(() => approve({ data: { sceneId: s.id, checks: checked.map(c => ({ ...c, present: c.present === true })) } }))}><Check className="size-3"/> Approve still</Button>}
          <Button size="sm" disabled={!s.approved_at || busy} onClick={() => run(async () => setConfirmation({ scene: s, operation: 'animate', q: await quote({ data: { sceneId: s.id, model, operation: 'animate' } }) }))}><Play className="size-3"/> Quote animation</Button></div>
          {clip?.failure_reason && <p className="break-words text-xs text-destructive">{clip.failure_reason}</p>}</div>
        </article>;
      })}</div>
    </>}
    {tab === 'references' && <><h2 className="mb-5 text-xl font-semibold">Reference library</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{kinds.map(k => <section key={k.id} className="border-t border-border py-4"><h3 className="mb-3 font-semibold">{k.label}</h3>{data.references.filter(r => r.kind === k.id).map(r => <div key={r.id} className="mb-4"><img src={r.preview ?? ''} alt={r.filename} className="mb-2 aspect-square w-32 rounded-md object-contain bg-muted"/><div className="flex items-center gap-3"><Switch aria-label={`Use ${r.filename}`} checked={r.enabled} onCheckedChange={enabled => run(() => refs({ data: { action: 'toggle', id: r.id, enabled } }))}/><span className="min-w-0 truncate text-xs">{r.filename}</span><Button variant="ghost" size="icon" aria-label={`Delete ${r.filename}`} onClick={() => run(() => refs({ data: { action: 'delete', id: r.id } }))}><Trash2 className="size-4"/></Button></div></div>)}<Input aria-label={`Upload ${k.label}`} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const f=e.target.files?.[0]; if(f) run(() => upload(f,k.id)); }}/></section>)}</div></>}
    {tab === 'observations' && data.selected && <div className="grid gap-8 lg:grid-cols-2"><section><h2 className="mb-4 text-xl font-semibold">Visual-only evidence</h2><pre className="max-h-[600px] overflow-auto whitespace-pre-wrap break-words border-t border-border py-4 text-xs">{JSON.stringify(data.selected.visual_observations,null,2)}</pre></section><section><h2 className="mb-4 text-xl font-semibold">Audio-only evidence</h2><pre className="max-h-[600px] overflow-auto whitespace-pre-wrap break-words border-t border-border py-4 text-xs">{JSON.stringify(data.selected.audio_observations,null,2)}</pre><p className="text-xs text-muted-foreground">{(data.selected.observation_notes as string[]).join(' ')}</p></section></div>}
    {tab === 'delivery' && data.selected && <><AssemblyDelivery key={data.selected.id} data={data} busy={busy} run={run} refresh={refresh} downloadClips={downloadClips}/><StudioCostWorksheet allowance={data.monthlyAllowance}/></>}
    <Dialog open={newProject} onOpenChange={setNewProject}><DialogContent><DialogHeader><DialogTitle>New inspiration film</DialogTitle></DialogHeader><label className="text-sm">Film title<Input aria-label="Film title" value={title} onChange={e => setTitle(e.target.value)}/></label><label className="text-sm">Saved source analysis<select aria-label="Saved source analysis" value={analysisId} onChange={e => setAnalysisId(e.target.value)} className="mt-2 w-full rounded-md border border-input bg-background p-2"><option value="">Blank storyboard</option>{data.analyses.map(a => <option key={a.id} value={a.id}>{a.source_account ?? a.instagram_url}</option>)}</select></label><Button disabled={!title.trim() || busy} onClick={() => run(async () => { const p=await create({ data: { title, analysisId: analysisId || undefined } }); setNewProject(false); navigate({ to: '/studio/inspiration', search: { projectId: p.id } }); })}>Create film</Button></DialogContent></Dialog>
    <Dialog open={editing !== null} onOpenChange={v => { if(!v)setEditing(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing === 'new' ? 'Add scene' : 'Edit scene · approval resets'}</DialogTitle></DialogHeader>{(['environment','action','endState','camera','audio'] as const).map(key => <label key={key} className="text-sm capitalize">{key.replace('endState','End state')}<Textarea aria-label={key} value={draft[key]} onChange={e => setDraft(p => ({ ...p, [key]:e.target.value, stillPrompt: undefined, motionPrompt: undefined }))}/></label>)}<label className="text-sm">On-screen text<Input aria-label="On-screen text" value={draft.onScreenText ?? ''} onChange={e => setDraft(p => ({ ...p, onScreenText: e.target.value }))}/></label><label className="text-sm">Duration<select aria-label="Scene duration" value={draft.duration} onChange={e => setDraft(p => ({ ...p,duration:Number(e.target.value) as 4|6|8 }))} className="ml-3 rounded-md border border-input bg-background p-2">{[4,6,8].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label><label className="text-sm">Action objects (one per line: object | initial state)<Textarea aria-label="Action objects" value={draft.objects.map(o => `${o.name} | ${o.state}`).join('\n')} onChange={e => setDraft(p => ({ ...p, objects:e.target.value.split('\n').map(l => { const [name,...state]=l.split('|'); return { name, state:state.join('|') }; }),stillPrompt:undefined }))}/></label><label className="text-sm">Still prompt<Textarea aria-label="Still prompt" value={draft.stillPrompt ?? ''} placeholder="Built from scene and every required object" onChange={e => setDraft(p => ({ ...p,stillPrompt:e.target.value }))}/></label><label className="text-sm">Motion prompt<Textarea aria-label="Motion prompt" value={draft.motionPrompt ?? ''} placeholder="Built from action, end state, camera and audio" onChange={e => setDraft(p => ({ ...p,motionPrompt:e.target.value }))}/></label><Button disabled={busy} onClick={() => run(async () => { if(!data.selected)return; await save({ data: { projectId:data.selected.id,sceneId:editing !== 'new' ? editing?.id : undefined,scene:{ ...draft,stillPrompt:draft.stillPrompt || undefined,motionPrompt:draft.motionPrompt || undefined } } }); setEditing(null); })}><Save className="size-4"/> Save scene</Button></DialogContent></Dialog>
    <Dialog open={confirmation !== null} onOpenChange={v => {if(!v)setConfirmation(null);}}><DialogContent><DialogHeader><DialogTitle>{confirmation?.operation === 'still' ? 'Still quote' : 'Animation quote'}</DialogTitle></DialogHeader>{confirmation && <><p className="break-words text-sm">{confirmation.q.model}</p><p className="text-sm">{confirmation.q.seconds} billable seconds × {confirmation.q.rate ?? 'input-dependent'} workspace credits/s</p><p className="font-semibold">Total: {confirmation.q.totalWorkspaceCredits ?? 'unset'} workspace credits · {confirmation.q.customerCredits ?? 'unset'} {confirmation.q.billingBalance} credits {confirmation.q.billingBalance==='video'?(STUDIO_PRICING.video.approved?'· approved':'· proposed'):''}</p>{confirmation.q.video&&<><p>{confirmation.q.video.equivalent}</p><p>{confirmation.q.video.afterwards}</p><p className="text-sm text-muted-foreground">Plan credits separately: {confirmation.q.planCharges.stills}; {confirmation.q.planCharges.storyboardWriting}; {confirmation.q.planCharges.analysis}. No plan charge in this animation.</p>{!confirmation.q.video.sufficient&&<VideoPackAvailability/>}</>}{confirmation.q.monthlyEquivalent && <p>{confirmation.q.monthlyEquivalent}</p>}{confirmation.q.usdCost!==null && <p className="text-sm">Direct cost: ${confirmation.q.usdCost.toFixed(4)}</p>}{confirmation.q.reason && <p role="alert" className="text-sm text-status-warning">{confirmation.q.reason}</p>}<Button disabled={!confirmation.q.available || busy} onClick={confirm}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Play className="size-4"/>} Confirm generation</Button></>}</DialogContent></Dialog>
  </div>;
}
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Film, ImagePlus, Loader2, Minus, Plus, Mic } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { ReviewCard } from './ReviewPostPrimitives';
import { InspirationStudio } from './InspirationStudio';
import { getInspirationStudio, manageInspirationReference, writeInspirationStoryboard } from '@/lib/inspiration.functions';
import { suggestVideoRemakes } from '@/lib/video-remake.functions';
import { referenceKinds, remakeClipCredits, sourceAudioProposal, type ReferenceChoice, type RemakeChoice } from '@/lib/video-remake';
import { STUDIO_PRICING } from '@/lib/studio-pricing';
import { CREDIT_BALANCE_KEY } from '@/lib/credits';
import { VideoChangeList } from './VideoChangeList';
import { observedVideoChanges, videoChangeBrief } from '@/lib/video-changes';

export function VideoRemakePlanner({ analysis, projectId, value = {}, onChange, onSpeech }: { analysis: any; projectId: string; value?: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; onSpeech: (mode: 'voiceover'|'silent') => void }) {
  const suggest = useServerFn(suggestVideoRemakes), load = useServerFn(getInspirationStudio), manage = useServerFn(manageInspirationReference), write = useServerFn(writeInspirationStoryboard);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ['remake-references', projectId], queryFn: () => load({ data: { projectId } }) });
  const audio = sourceAudioProposal(analysis);
  const patch = (next: Record<string, unknown>) => onChange({ ...value, ...next });
  const blueprint = analysis?.dna?.blueprint ?? analysis?.dna_analysis?.blueprint ?? analysis?.blueprint;
  const observed = analysis?.evidence?.video?.shots?.[0]?.onScreen ?? blueprint?.scenes?.[0]?.description ?? analysis?.source_caption ?? 'the source’s opening and payoff';
  const detail = String(observed).slice(0, 220);
  const starting = blueprint?.audio?.transcriptFull ?? analysis?.transcript ?? blueprint?.scenes?.map((s: any) => s.onScreenText).flat().join(' ') ?? analysis?.source_caption ?? detail;
  const hasPerson = /person|presenter|woman|man\b|talking|coach/i.test(detail);
  const hasProduct = /product|bottle|phone|tool|knife|app\b/i.test(detail);
  const initialNames = hasPerson && hasProduct ? ['Similar presenter, similar product', 'Similar presenter, your product', 'Different presenter, your product', 'Show the result first', 'A hands-on close-up'] : hasPerson ? ['Same energy, a new message', 'A different presenter explains it', 'Show the advice in action', 'Start with the payoff', 'A personal, conversational version'] : ['Same reveal, a new subject', 'Show the result first', 'A closer view of the action', 'Explain how it works', 'A before-and-after reveal'];
  const proposedScript = String(starting).split(/(?<=[.!?])\s+/).map((line, i) => i === 0 ? line.replace(/achieving your goals|making any kind of change|learning any new skill/gi,'building a daily creative practice') : line.replace(/success|strength/gi,'creative confidence')).join(' ');
  const approaches = (value.approaches as RemakeChoice[] | undefined) ?? initialNames.map((name, i) => ({ id: String(i + 1), name, summary: `${i === 3 ? 'Open with the payoff, then explain' : i === 4 ? 'Move closer to the main action' : 'Keep the source’s pacing and reveal'}: ${detail}`, brief: `${name}. Preserve this observed beat: ${detail}. New original subjects; identity only from uploaded references.`, script: proposedScript, sourceDetail: detail }));
  const selected = String(value.approachId ?? approaches[0]?.id ?? '1');
  const active = approaches.find(a => a.id === selected) ?? approaches[0];
  const referenceChoice = (value.referenceChoice as ReferenceChoice) ?? 'design-both';
  const ids = (value.referenceIds as string[]) ?? [];
  const seconds = Number(value.duration ?? 20);
  const model = (value.model === 'google/veo-3.1-lite' ? 'google/veo-3.1-lite' : 'google/veo-3.1-fast');
  const background = String(value.background ?? audio.background);
  const speech = (value.speechMode as 'voiceover'|'silent') ?? audio.speechMode;
  const script = String(value.script ?? active?.script ?? starting);
  useEffect(() => {
    if (value.speechMode !== undefined) return;
    patch({speechMode:audio.speechMode,background:audio.background,duration:seconds,script,brief:active?.brief});
  }, [projectId]);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  const upload = async (file: File, kind: 'character_face' | 'product') => {
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    await manage({ data: { action: 'upload', kind, filename: file.name, mime: file.type as 'image/png'|'image/jpeg'|'image/webp', base64 } });
    const updated = await load({ data: { projectId } });
    const added = updated.references.filter(r => !data?.references.some(old => old.id === r.id));
    patch({ referenceIds: [...ids, ...added.map(r => r.id)] });
    await qc.invalidateQueries({ queryKey: ['remake-references', projectId] });
  };
  return <div className="space-y-6">
    <ReviewCard title="Five ways to remake this" icon={Film}>
      <p className="mb-4 text-review-muted">From this post: {detail}</p>
      <div className="grid gap-4 sm:grid-cols-2">{approaches.map(a => <Button key={a.id} variant="outline" aria-pressed={selected === a.id} className={`wizard-choice ${selected === a.id ? 'wizard-selected' : ''}`} onClick={() => patch({ approachId: a.id, script: a.script, brief: a.brief })}><span className="flex w-full justify-between text-lg font-semibold">{a.name}{selected === a.id && <Check className="size-5 shrink-0"/>}</span><span className="whitespace-normal text-left text-sm font-normal text-review-muted">{a.summary}</span><span className="whitespace-normal text-left text-sm font-normal">{a.sourceDetail}</span></Button>)}</div>
      {!value.approaches && <Button className="mt-5" disabled={busy} onClick={() => run(async () => { const result = await suggest({ data: { analysisId: analysis.analysisId ?? analysis.id } }); patch({ approaches: result.approaches, approachId: result.approaches[0].id, script: result.approaches[0].script, brief: result.approaches[0].brief, suggestionUsage: result.usage }); toast.success('Five source-specific proposals ready'); })}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Film className="size-4"/>} Suggest five tailored remakes · no plan credit charge</Button>}
    </ReviewCard>
    <VideoChangeList source={analysis} values={value.changes as Record<string,string>|undefined} onChange={changes=>patch({changes})}/>
    <ReviewCard title="Which reference photos would you like to use?" icon={ImagePlus}>
      <div className="grid gap-3 sm:grid-cols-2">{([{ id:'person', label:'Upload a person; AI designs the product' },{ id:'product', label:'Upload a product; AI designs the person' },{ id:'both', label:'Upload both person and product' },{ id:'design-person', label:'AI designs the person; use my product' },{ id:'design-both', label:'Let AI design both' }] as const).map(option => <Button key={option.id} variant={referenceChoice === option.id ? 'secondary' : 'outline'} className="h-auto min-h-12 whitespace-normal text-left" aria-pressed={referenceChoice === option.id} onClick={() => patch({ referenceChoice: option.id, referenceIds: ids.filter(id => data?.references.some(r => r.id === id && referenceKinds(option.id).includes(r.kind))) })}>{option.label}</Button>)}</div>
      <p className="mt-4 text-sm text-review-muted">The selected photos define identity, not written descriptions. Similar energy never means copying the original person’s face.</p>
      {referenceChoice !== 'design-both' && <div className="mt-5 space-y-4">{(['character_face','product'] as const).filter(kind => kind === 'character_face' ? ['person','both'].includes(referenceChoice) : ['product','both','design-person'].includes(referenceChoice)).map(kind => <label key={kind} className="block font-medium">{kind === 'product' ? 'Your product photo' : 'Your person photo'}<Input className="mt-2" aria-label={kind === 'product' ? 'Upload product reference' : 'Upload person reference'} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if(file) run(() => upload(file, kind)); }}/></label>)}<div className="grid gap-3 sm:grid-cols-3">{data?.references.filter(r => referenceKinds(referenceChoice).includes(r.kind)).map(r => <Button key={r.id} variant="outline" aria-label={`Choose reference ${r.filename}`} aria-pressed={ids.includes(r.id)} className={`wizard-choice ${ids.includes(r.id) ? 'wizard-selected' : ''}`} onClick={() => patch({ referenceIds: ids.includes(r.id) ? ids.filter(id => id !== r.id) : [...ids,r.id] })}><img src={r.preview ?? ''} alt={r.filename} className="aspect-square w-full object-contain"/><span className="max-w-full truncate">{r.filename}</span></Button>)}</div></div>}
    </ReviewCard>
    <ReviewCard title="Your script" icon={Mic}><Textarea aria-label="Proposed reel script" className="min-h-48 text-base" value={script} onChange={e => patch({ script: e.target.value })}/><p className="mt-3 text-sm text-review-muted">Source hook and rhythm: {String(starting).slice(0,220)}</p>{speech==='voiceover' && script.split(/\s+/).length > seconds*3 && <p role="status" className="mt-3 text-status-warning">This script may need more time. Increase the duration or shorten the words; you can still continue.</p>}</ReviewCard>
    <ReviewCard title="Audio and length" icon={Film}>
      <div className="grid gap-5 sm:grid-cols-2"><label className="font-medium">Spoken words<select aria-label="Reel speech" className="mt-2 w-full rounded-md border border-input bg-background p-3" value={speech} onChange={e => { const mode = e.target.value as 'voiceover'|'silent'; patch({ speechMode: mode }); onSpeech(mode); }}><option value="voiceover">Voiceover</option><option value="silent">No talking</option></select></label><label className="font-medium">Background audio<select aria-label="Reel background audio" className="mt-2 w-full rounded-md border border-input bg-background p-3" value={background} onChange={e => patch({ background:e.target.value })}><option value="instrumental">Original instrumental</option><option value="ambience">Ambience</option><option value="none">None</option></select></label></div><p className="mt-3 text-sm text-review-muted">{audio.note}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4"><span className="font-medium">Duration</span><Button variant="outline" size="icon" aria-label="Decrease reel duration" disabled={seconds<=8} onClick={() => patch({ duration:seconds-2 })}><Minus className="size-4"/></Button><output aria-label="Reel duration" className="min-w-24 text-center font-semibold">{seconds} seconds</output><Button variant="outline" size="icon" aria-label="Increase reel duration" disabled={seconds>=60} onClick={() => patch({ duration:seconds+2 })}><Plus className="size-4"/></Button><select aria-label="Reel model" value={model} onChange={e => patch({ model:e.target.value })} className="rounded-md border border-input bg-background p-3"><option value="google/veo-3.1-fast">Veo Fast</option><option value="google/veo-3.1-lite">Veo Lite</option></select></div>
      <p role="status" className="mt-4 font-semibold">Clips: {remakeClipCredits(seconds,model)} video credits · {seconds}s. Stills, narration and assembly quoted separately.</p>
      <Button className="mt-5" disabled={busy} onClick={() => run(async () => { if(data?.scenes.length) { toast.info('Scenes already prepared. Edit them under Advanced.'); return; } const result = await write({ data:{ projectId, brief:active?.brief.slice(0,600) ?? '', speechMode:speech, remake:{ script, duration:seconds, referenceIds:referenceChoice === 'design-both' ? [] : ids, background, mood:audio.mood } } }); onSpeech(speech); patch({ prepared:true }); await qc.invalidateQueries({queryKey:['inspiration-studio']}); await qc.invalidateQueries({queryKey:['remake-references',projectId]}); await qc.invalidateQueries({queryKey:CREDIT_BALANCE_KEY}); toast.success(`${result.scenes} scenes prepared`); })}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Check className="size-4"/>} Prepare my video · {STUDIO_PRICING.storyboardPlanCredits} plan credits</Button>
    </ReviewCard>
    <details className="review-card"><summary className="cursor-pointer text-base font-semibold">Advanced — storyboard and scene editing</summary><div className="mt-5"><InspirationStudio projectId={projectId} wizardStage="words" speechMode={speech} wizardBrief={active?.brief}/></div></details>
  </div>;
}
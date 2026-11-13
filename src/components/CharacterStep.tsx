import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ReviewCard } from './ReviewPostPrimitives';
import { GenerationProgress } from './GenerationProgress';
import { getCharacterSheet, approveCharacterSheet } from '@/lib/character-sheet.functions';
import { LOOK_FIELDS, type LookBrief } from '@/lib/look-brief';
import { STUDIO_PRICING } from '@/lib/studio-pricing';
import { priceFromWorkspaceCost } from '@/lib/inspiration';
import { CREDIT_BALANCE_KEY } from '@/lib/credits';
import { startJob, finishJob } from '@/lib/generation-jobs';
import { supabase } from '@/integrations/supabase/client';

const labels = { skinTone: 'Skin shade', pigmentation: 'Visible pigmentation', hair: 'Hair', build: 'Build', outfit: 'Outfit', accessories: 'Accessories', openingPose: 'Opening pose', environment: 'Environment type' };
const views = ['character_face','character_body','character_back'] as const;
export function CharacterStep({ projectId, hasOwnReferences, instructions, savedBrief, onBrief, onApproved }: { projectId: string; hasOwnReferences: boolean; instructions: string; savedBrief?: LookBrief; onBrief: (brief: LookBrief) => void; onApproved: (ids: string[]) => void }) {
  const load = useServerFn(getCharacterSheet), approve = useServerFn(approveCharacterSheet), qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['character-sheet', projectId], queryFn: () => load({ data: { projectId } }), refetchInterval: q => ['claimed','in_progress'].includes(q.state.data?.sheet?.status ?? '') ? 4000 : false });
  const [brief, setBrief] = useState<LookBrief | undefined>(savedBrief), [extra, setExtra] = useState(''), [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [started, setStarted] = useState(0);
  const cost = priceFromWorkspaceCost(STUDIO_PRICING.stillWorkspaceCredits ?? 1, STUDIO_PRICING.workspaceCreditUsd) ?? 6;
  const sheet = data?.sheet, image = preview || sheet?.preview;
  useEffect(() => { if (!brief && data?.brief) setBrief(data.brief); }, [data?.brief]);
  useEffect(() => { if (sheet?.status === 'completed') finishJob(`character-${projectId}`, true, { resultSelector: '#character-preview' }); }, [sheet?.status]);
  const generate = async () => {
    if (!brief) return;
    setBusy(true); setError(''); setPreview(''); setStarted(Date.now());
    startJob({ id: `character-${projectId}`, kind: 'stills', title: 'Your character sheet', href: window.location.pathname + window.location.search, expectedSeconds: 70, doneLabel: 'Your character sheet is ready' });
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Sign in required.');
      const { streamImage } = await import('@/lib/inspiration-stream');
      await streamImage('/api/public/character-sheet', { projectId, requestKey: crypto.randomUUID(), brief, instructions: `${instructions}\n${extra}`, confirmedCredits: cost }, (src, final) => { if (final) setPreview(src); }, undefined, { Authorization: `Bearer ${session.session.access_token}` });
      await qc.invalidateQueries({ queryKey: ['character-sheet', projectId] });
      finishJob(`character-${projectId}`, true, { resultSelector: '#character-preview' });
    } catch (e) { setError((e as Error).message); finishJob(`character-${projectId}`, false, { error: (e as Error).message, refunded: true }); }
    finally { setBusy(false); await qc.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY }); }
  };
  const accept = async () => {
    if (!image || !sheet) return;
    setBusy(true);
    try {
      const im = new Image(); im.crossOrigin = 'anonymous'; im.src = image; await im.decode();
      const crops = views.map((kind, i) => {
        const canvas = document.createElement('canvas'); canvas.width = Math.floor(im.naturalWidth / 3); canvas.height = im.naturalHeight;
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Character preview could not be saved.');
        ctx.drawImage(im, i * im.naturalWidth / 3, 0, im.naturalWidth / 3, im.naturalHeight, 0, 0, canvas.width, canvas.height);
        return { kind, base64: canvas.toDataURL('image/jpeg', .92).split(',')[1] };
      });
      const result = await approve({ data: { id: sheet.id, views: crops } });
      onApproved(result.ids); toast.success('Your original character is approved.');
      await Promise.all([qc.invalidateQueries({ queryKey: ['character-sheet'] }), qc.invalidateQueries({ queryKey: ['remix-references'] }), qc.invalidateQueries({ queryKey: ['inspiration-studio'] })]);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  if (hasOwnReferences && sheet?.status !== 'approved') return <p role="status" className="text-sm text-review-muted">Your selected character references will be used for every scene.</p>;
  return <ReviewCard title="Your original character" icon={ImagePlus}>
    <div className="grid gap-3 sm:grid-cols-2">{brief && LOOK_FIELDS.map(k => <label key={k} className="min-w-0 text-sm font-medium">{labels[k]}<Input aria-label={`Character ${labels[k].toLowerCase()}`} className="mt-1" value={brief[k]} onChange={e => { const next = { ...brief, [k]: e.target.value }; setBrief(next); onBrief(next); }}/></label>)}</div>
    <label className="mt-4 block text-sm font-medium">Extra character instructions (optional)<Textarea aria-label="Extra character instructions" className="mt-2" value={extra} onChange={e => setExtra(e.target.value)}/></label>
    <p className="mt-3 text-sm text-review-muted">{instructions ? `Your changes: ${instructions}` : 'New original facial features; the written look stays consistent.'}</p>
    {(busy || ['claimed','in_progress'].includes(sheet?.status ?? '') || error) && <div className="mt-4"><GenerationProgress status={error ? 'error' : 'running'} startedAt={started || new Date(sheet?.created_at ?? Date.now()).getTime()} expectedSeconds={70} stage="Creating your character’s three views…" error={error} refunded={!!error} onRetry={generate}/></div>}
    {image && <div id="character-preview" className="mt-4 grid grid-cols-3 gap-2">{views.map((kind, i) => <figure key={kind} className="min-w-0"><div className="aspect-[1/2] overflow-hidden rounded-md bg-muted"><img src={image} alt={kind.replace('character_', '') + ' view of the original character'} className={`h-full w-[300%] max-w-none object-fill ${i === 1 ? '-translate-x-1/3' : i === 2 ? '-translate-x-2/3' : ''}`}/></div><figcaption className="mt-2 text-center text-sm">{['Portrait','Full body','Back view'][i]}</figcaption></figure>)}</div>}
    <div className="mt-4 flex flex-wrap gap-3"><Button disabled={busy || !brief || ['claimed','in_progress'].includes(sheet?.status ?? '')} onClick={generate}><ImagePlus className="size-4"/>{image ? 'Regenerate character' : 'Generate character sheet'} · {cost} plan credits</Button>{image && <Button variant="outline" disabled={busy || !sheet || !['completed','approved'].includes(sheet.status)} onClick={accept}><Check className="size-4"/>{sheet?.status === 'approved' ? 'Use approved character' : 'Approve character'}</Button>}</div>
    <p className="mt-2 text-xs text-muted-foreground">Medium quality · provisional price for one three-view sheet. No source images are sent.</p>
  </ReviewCard>;
}
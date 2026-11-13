import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ScanFace } from 'lucide-react';
import { Button } from './ui/button';
import { getSourceKeyframes, saveSourceKeyframe, analyzeSourceAppearance } from '@/lib/keyframes.functions';
import { personFromAppearance, outfitFromAppearance, type Appearance } from '@/lib/keyframes';

/** Free: pulls first/last (and mid) frames from the saved source video in the browser, then reads the person's style. */
async function grabFrames(url: string, times: number[]): Promise<string[]> {
  const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.src = url;
  await new Promise<void>((ok, bad) => { v.onloadeddata = () => ok(); v.onerror = () => bad(new Error('The saved source video could not be opened in this browser.')); });
  const out: string[] = [];
  for (const t of times) {
    await new Promise<void>(ok => { v.onseeked = () => ok(); v.currentTime = Math.min(t, Math.max(0, v.duration - 0.05)); });
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    out.push(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
  }
  return out;
}

export function SourceKeyframes({ analysisId, onAppearance }: { analysisId: string; onAppearance: (a: { person: string; outfit: string }) => void }) {
  const qc = useQueryClient(); const load = useServerFn(getSourceKeyframes), save = useServerFn(saveSourceKeyframe), read = useServerFn(analyzeSourceAppearance);
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const { data } = useQuery({ queryKey: ['source-keyframes', analysisId], queryFn: () => load({ data: { analysisId } }) });
  const run = async () => {
    if (!data?.videoUrl) return; setError('');
    try {
      setBusy('Extracting frames from your saved video…');
      const shots = await grabFrames(data.videoUrl, data.plan.map(p => p.time));
      for (let i = 0; i < data.plan.length; i++) await save({ data: { analysisId, ...data.plan[i], base64: shots[i] } });
      setBusy('Reading the person’s style (not identity)…');
      const { appearance } = await read({ data: { analysisId } });
      onAppearance({ person: personFromAppearance(appearance), outfit: outfitFromAppearance(appearance) });
      await qc.invalidateQueries({ queryKey: ['source-keyframes', analysisId] });
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const a = data?.appearance as Appearance | null | undefined;
  return <div className="mt-4 rounded-lg border border-border bg-background p-4">
    <p className="font-semibold">Source frames</p>
    <p className="mb-3 text-sm text-review-muted">Each still recreates these exact frames — same camera, pose, props and lighting — with a new person and a different face.</p>
    {!!data?.keyframes.length && <div className="mb-3 flex flex-wrap gap-2">{data.keyframes.sort((x, y) => x.shot - y.shot || x.time - y.time).map(k => <figure key={k.path} className="w-20"><img src={k.preview ?? ''} alt={`Shot ${k.shot + 1} ${k.pos} frame`} className="aspect-[9/16] w-full rounded object-cover"/><figcaption className="text-xs text-review-muted">Shot {k.shot + 1} · {k.pos} · {k.time}s</figcaption></figure>)}</div>}
    {a && <dl className="mb-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">{(['skinTone','undertone','build','hair','outfit','coveredOutfit','accessories','footwear','vibe'] as const).map(k => <div key={k} className="flex gap-2"><dt className="text-review-muted">{({skinTone:'Skin tone',undertone:'Undertone',coveredOutfit:'If outfit is declined',build:'Build',hair:'Hair',outfit:'Outfit',accessories:'Accessories',footwear:'Footwear',vibe:'Vibe'})[k]}:</dt><dd className="min-w-0 break-words">{a[k] ?? 'unclear'}</dd></div>)}</dl>}
    {data && !data.videoUrl && <p className="text-sm text-status-warning">No saved source video was found, so stills are written from the shot description only.</p>}
    {data?.videoUrl && <Button variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={!!busy} onClick={run}>{busy ? <Loader2 className="size-4 animate-spin"/> : <ScanFace className="size-4"/>}{busy || (data.keyframes.length ? 'Re-extract frames and style · Free' : 'Extract source frames and style · Free')}</Button>}
    {error && <p role="alert" className="mt-2 break-words text-sm text-destructive">{error}</p>}
  </div>;
}

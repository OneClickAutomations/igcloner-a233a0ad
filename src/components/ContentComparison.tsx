import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { getSourceMediaSignedUrls } from '@/lib/analyze.functions';
import { Button } from './ui/button';

type Media = { url: string; type: 'image' | 'video' };
export function ContentComparison({ analysisId, sourceThumbnail, sourceUrl, generated }: {
  analysisId?: string | null; sourceThumbnail?: string | null; sourceUrl?: string | null; generated: Media[];
}) {
  const load = useServerFn(getSourceMediaSignedUrls);
  const [originalIndex, setOriginalIndex] = useState(0), [generatedIndex, setGeneratedIndex] = useState(0);
  const { data, isPending } = useQuery({
    queryKey: ['comparison-source', analysisId], enabled: !!analysisId, staleTime: 30 * 60 * 1000,
    queryFn: () => { if (!analysisId) throw new Error('No source analysis'); return load({ data: { analysisId } }); },
  });
  const original: Media[] = (data?.media ?? []).flatMap(m => m ? [{ url: m.signedUrl, type: m.kind }] : []);
  if (!original.length && sourceThumbnail) original.push({ url: `/api/public/img?u=${encodeURIComponent(sourceThumbnail)}`, type: 'image' });
  if (!generated.length) return null;
  const side = (label: string, media: Media[], index: number, change: (n: number) => void) => {
    const current = media[Math.min(index, Math.max(0, media.length - 1))];
    return <figure className="min-w-0 space-y-2">
      <figcaption className="text-sm font-semibold">{label}</figcaption>
      <div className="flex aspect-[9/16] max-h-[480px] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {current ? current.type === 'video' ? <video key={current.url} aria-label={label} src={current.url} controls playsInline preload="metadata" className="h-full w-full object-contain"/> : <img src={current.url} alt={label} className="h-full w-full object-contain"/> : <p className="px-2 text-center text-sm text-muted-foreground">{analysisId && isPending ? 'Loading original…' : 'Original preview unavailable'}</p>}
      </div>
      {media.length > 1 && <div className="flex items-center justify-between gap-1">
        <Button size="icon" variant="outline" aria-label={`Previous ${label.toLowerCase()} slide`} disabled={index <= 0} onClick={() => change(index - 1)}><ChevronLeft className="size-4"/></Button>
        <span className="text-xs tabular-nums">{Math.min(index + 1, media.length)} / {media.length}</span>
        <Button size="icon" variant="outline" aria-label={`Next ${label.toLowerCase()} slide`} disabled={index >= media.length - 1} onClick={() => change(index + 1)}><ChevronRight className="size-4"/></Button>
      </div>}
    </figure>;
  };
  return <section aria-label="Original and generated comparison" className="space-y-3 border-t border-border py-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Compare your content</h3>{sourceUrl && <Button variant="ghost" size="sm" asChild><a href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4"/>Original post</a></Button>}</div>
    <div className="grid grid-cols-2 items-start gap-3 sm:gap-5">{side('Original', original, originalIndex, setOriginalIndex)}{side('Your creation', generated, generatedIndex, setGeneratedIndex)}</div>
  </section>;
}
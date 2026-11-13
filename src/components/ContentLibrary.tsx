import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Film, Image, LayoutGrid, FolderOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { listContentLibrary } from '@/lib/content-library.functions';
import { libraryStatus } from '@/lib/content-library';
import { ReviewAndPublish } from './ReviewAndPublish';
import { Route } from '@/routes/_authenticated/library';

export function ContentLibrary() {
  const { projectId } = Route.useSearch();
  const load = useServerFn(listContentLibrary);
  const { data, error } = useQuery({ queryKey: ['content-library'], queryFn: () => load() });
  const [query, setQuery] = useState(''), [type, setType] = useState('all');
  const item = data?.items.find((i: any) => i.id === projectId);
  const editPath = item?.format === 'film' ? '/studio/inspiration' : item?.user_preferences?.cloneMethod === 'A0' || item?.user_preferences?.cloneMethod === 'A1' ? '/studio/copy' : item?.format === 'carousel' ? '/studio/carousel' : item?.format === 'image' ? '/studio/image' : '/studio/reel';
  return <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">{projectId ? item?.title ?? 'Your content' : 'Content library'}</h1><p className="mt-2 text-base text-muted-foreground">{projectId ? 'Your saved content, captions and publishing results.' : 'Your images, carousels, reels and videos — saved together.'}</p></div>{projectId ? <div className="flex gap-2"><Button variant="outline" asChild><Link to="/library" search={{}}>All content</Link></Button>{item && <Button variant="outline" asChild><Link to={editPath} search={{ projectId, ...(item.format === 'film' ? { delivery: true } : {}) }}>Edit content</Link></Button>}</div> : <Button asChild><Link to="/app">Create content</Link></Button>}</header>
    {projectId ? <ReviewAndPublish key={projectId} projectId={projectId}/> : <><div className="flex flex-wrap gap-3"><Input aria-label="Search library" placeholder="Search your content" className="max-w-md" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="Content type" className="rounded-md border border-input bg-background px-3 py-2" value={type} onChange={e => setType(e.target.value)}>{['all', 'image', 'carousel', 'reel', 'film'].map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t[0].toUpperCase() + t.slice(1)}</option>)}</select></div>
      {error && <p role="alert">Your library could not load. <Button variant="outline" onClick={() => location.reload()}>Try again</Button></p>}
      {!data && !error && <p>Loading saved content…</p>}
      {data && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.items.filter((i: any) => (type === 'all' || i.format === type) && `${i.title} ${i.source_account ?? ''}`.toLowerCase().includes(query.toLowerCase())).map((i: any) => <article key={i.id} className="overflow-hidden rounded-lg border border-border bg-card"><Link to="/library" search={{ projectId: i.id }} className="block"><div className="grid aspect-[4/3] place-items-center overflow-hidden bg-muted">{i.thumbnail ? <img src={i.thumbnail} alt={i.title} loading="lazy" className="h-full w-full object-cover"/> : i.media[0]?.type === 'video' ? <video src={i.media[0].url} preload="metadata" muted className="h-full w-full object-contain"/> : i.format === 'carousel' ? <LayoutGrid className="size-10 text-muted-foreground"/> : i.format === 'image' ? <Image className="size-10 text-muted-foreground"/> : <Film className="size-10 text-muted-foreground"/>}</div><div className="space-y-2 p-4"><div className="flex justify-between text-sm text-muted-foreground"><span className="capitalize">{i.format}</span><span>{libraryStatus(i, i.job)}</span></div><h2 className="text-lg font-semibold">{i.title}</h2><p className="text-sm text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</p></div></Link><div className="px-4 pb-4 text-sm">{i.source_url ? <a href={i.source_url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">Source post{i.source_account ? ` · ${i.source_account}` : ''}</a> : <span className="text-muted-foreground">No source post</span>}</div></article>)}</div>}
      {data?.items.length === 0 && <p className="flex items-center gap-3 text-muted-foreground"><FolderOpen className="size-5"/>Your saved content will appear here.</p>}
    </>}
  </div>;
}
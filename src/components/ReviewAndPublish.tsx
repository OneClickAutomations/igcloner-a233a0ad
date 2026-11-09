import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Download, FolderOpen, Loader2, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { getLibraryContent, saveLibraryContent } from '@/lib/content-library.functions';
import { generateCaptionPack, copyRequestProgress } from '@/lib/copy.functions';
import { publishContent, pollPublishingStatus } from '@/lib/publishing.functions';
import { CREDIT_BALANCE_KEY, ACTION_COSTS } from '@/lib/credits';
import { compatiblePlatforms, PLATFORM_META, PLATFORM_CAPABILITY_MATRIX, resolvePublishingError, type ContentType, type PublishingPlatform } from '@/lib/upload-post/shared';
import { finalCaption, publishingLimit, HASHTAG_GUIDANCE, tagList, type PlatformCopy } from '@/lib/content-library';

const blank = (): PlatformCopy => ({ caption: '', description: '', hashtags: '', title: '' });
export function ReviewAndPublish({ projectId, production }: { projectId: string; production?: React.ReactNode }) {
  const load = useServerFn(getLibraryContent), save = useServerFn(saveLibraryContent), pack = useServerFn(generateCaptionPack), publish = useServerFn(publishContent), poll = useServerFn(pollPublishingStatus), progressFn = useServerFn(copyRequestProgress);
  const qc = useQueryClient(), navigate = useNavigate();
  const { data, error } = useQuery({ queryKey: ['library-content', projectId], queryFn: () => load({ data: { id: projectId } }) });
  const [copies, setCopies] = useState<Record<string, PlatformCopy>>({}), [selected, setSelected] = useState<PublishingPlatform[]>([]), [link, setLink] = useState('');
  const [busy, setBusy] = useState(''), [progress, setProgress] = useState(''), [notice, setNotice] = useState(''), [date, setDate] = useState(''), [time, setTime] = useState(''), [timezone, setTimezone] = useState('');
  const [jobId, setJobId] = useState(''), [result, setResult] = useState<any>(null), [initialized, setInitialized] = useState('');
  useEffect(() => { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  useEffect(() => {
    if (!data || initialized === projectId) return;
    const saved = data.item.project_data?.wrapup;
    const next: Record<string, PlatformCopy> = saved?.copies ?? {};
    for (const p of data.item.project_data?.captionPack ?? []) if (!next[p.platform]) next[p.platform] = { caption: p.caption, description: p.description, title: p.title, hashtags: (p.hashtags ?? []).join(' ') };
    setCopies({ ...next }); setLink(saved?.link ?? '');
    setSelected(saved?.selected ?? data.accounts.map((a: any) => a.platform));
    setDate(saved?.date ?? ''); setTime(saved?.time ?? '');
    if (data.item.job) { setJobId(data.item.job.id); setResult({ status: data.item.job.status, results: data.item.job.publishing_results ?? [] }); }
    setInitialized(projectId);
  }, [data, projectId, initialized]);
  useEffect(() => {
    if (!jobId || !['queued', 'uploading', 'processing'].includes(result?.status)) return;
    const timer = setInterval(() => { poll({ data: { jobId } }).then(setResult).catch(() => {}); }, 4000);
    return () => clearInterval(timer);
  }, [jobId, result?.status]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['content-library'] }); qc.invalidateQueries({ queryKey: ['library-content', projectId] }); };
  const wrapup = { copies, selected, link, date, time, timezone };
  useEffect(() => {
    if (initialized !== projectId) return;
    const handler = (e: Event) => { (e as CustomEvent<{ tasks: Promise<unknown>[] }>).detail?.tasks.push(save({ data: { id: projectId, wrapup } })); };
    window.addEventListener('creation-save', handler);
    return () => window.removeEventListener('creation-save', handler);
  }, [initialized, projectId, copies, selected, link, date, time, timezone]);
  if (error) return <p role="alert">Could not load your content. <Button variant="outline" onClick={refresh}>Try again</Button></p>;
  if (!data) return <p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin"/>Loading your saved content…</p>;
  const item = data.item;
  const contentType: ContentType = item.format === 'film' || item.format === 'reel' ? 'video' : item.format === 'carousel' ? 'carousel' : item.format === 'caption' ? 'text' : 'image';
  const platforms = compatiblePlatforms(contentType);
  const connected = data.accounts.filter((a: any) => platforms.includes(a.platform));
  // With no accounts, prepare copy for a destination before connecting it.
  const shown = selected.length ? selected.filter(p => platforms.includes(p)) : ['instagram', 'tiktok', 'x', 'linkedin'].filter(p => platforms.includes(p as PublishingPlatform)) as PublishingPlatform[];
  const patch = (p: string, key: keyof PlatformCopy, value: string) => setCopies(c => ({ ...c, [p]: { ...blank(), ...c[p], [key]: value } }));
  const run = async (name: string, fn: () => Promise<void>) => { setBusy(name); setNotice(''); try { await fn(); } catch (e) { setNotice(name === 'publishing' ? resolvePublishingError(e).message : (e as Error).message); } finally { setBusy(''); refresh(); qc.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY }); } };
  const saveToLibrary = () => run('saving', async () => { await save({ data: { id: projectId, wrapup } }); toast.success('Saved to your content library'); setNotice('Saved to your content library.'); });
  const generate = () => run('captions', async () => {
    await save({ data: { id: projectId, wrapup } });
    const requestId = crypto.randomUUID(); setProgress('Writing your captions…');
    const timer = setInterval(() => { progressFn({ data: { requestId } }).then(r => setProgress(r.stage)).catch(() => {}); }, 2000);
    try {
      const r: any = await pack({ data: { projectId, platforms: shown, requestId } });
      const next = { ...copies };
      for (const p of r.platforms) next[p.platform] = { caption: p.caption, description: p.description, title: p.title, hashtags: (p.hashtags ?? []).join(' ') };
      setCopies(next);
      await save({ data: { id: projectId, wrapup: { ...wrapup, copies: next } } });
      toast.success(r.cached ? 'Saved captions loaded — no charge' : 'Your platform captions are ready');
    } finally { clearInterval(timer); }
  });
  const submit = (scheduled: boolean) => run('publishing', async () => {
    if (!selected.length) { setNotice('Choose a connected account, or connect one below. You can save to the library meanwhile.'); return; }
    if (!item.media.length || !item.finished) { setNotice('Finish your content below first. Your captions can be saved now.'); return; }
    if (link && !/^https?:\/\//i.test(link)) { setNotice('Use a full link beginning with https://'); return; }
    let scheduledAt: string | undefined;
    if (scheduled) {
      const when = new Date(`${date}T${time}`);
      if (!date || !time || !Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) { setNotice('Choose a future date and time.'); return; }
      scheduledAt = when.toISOString();
    }
    const captionPerPlatform: Record<string, string> = {};
    for (const p of selected) {
      const text = finalCaption(p, copies[p] ?? blank(), link), limit = publishingLimit(p, contentType);
      if (limit && text.length > limit) { setNotice(`${PLATFORM_META[p].label}: shorten the caption by ${text.length - limit} characters, or save it to the library to edit later. Nothing was cut.`); return; }
      const titleLimit = PLATFORM_CAPABILITY_MATRIX[p].maxTitleChars;
      if (titleLimit && (copies[p]?.title ?? item.title).length > titleLimit) { setNotice(`${PLATFORM_META[p].label}: shorten the title to ${titleLimit} characters.`); return; }
      captionPerPlatform[p] = text;
    }
    await save({ data: { id: projectId, wrapup } });
    const r = await publish({ data: { projectId, contentType, title: copies[selected.find(p => p === 'youtube' || p === 'pinterest') ?? selected[0]]?.title || item.title, captionPerPlatform, platforms: selected, mediaUrls: item.media.map((m: any) => m.url), scheduledAt } });
    setJobId(r.jobId); setResult({ status: r.status, results: selected.map(p => ({ platform: p, status: r.status })) });
    setNotice(scheduled ? 'Scheduled. You can find this in your library and publishing queue.' : 'Sent for publishing. Platform results appear below.');
  });
  const canPost = !!selected.length && selected.every(p => connected.some((a: any) => a.platform === p)) && item.media.length > 0 && item.finished;
  return <div className="space-y-8">
    <section className="space-y-4" aria-label="Finished content">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-2xl font-semibold">{item.title}</h3><Link to="/library" className="text-sm font-medium text-primary underline underline-offset-4">Saved in your content library</Link></div>
      {item.media.length ? <div className="flex snap-x gap-4 overflow-x-auto pb-2">{item.media.map((m: any, i: number) => <figure key={m.url} className="w-full max-w-md shrink-0 snap-start space-y-2">{m.type === 'video' ? <video controls preload="metadata" src={m.url} poster={item.thumbnail || undefined} className="max-h-[520px] w-full rounded-lg bg-muted object-contain"/> : <img src={m.url} alt={`${item.title}${item.media.length > 1 ? ` — slide ${i + 1}` : ''}`} className="max-h-[520px] w-full rounded-lg bg-muted object-contain"/>}<Button variant="outline" size="sm" asChild><a href={m.url} download target="_blank" rel="noreferrer"><Download className="size-4"/>Download{item.media.length > 1 ? ` slide ${i + 1}` : ''}</a></Button></figure>)}</div> : <p className="text-muted-foreground">Your finished preview will appear here. Finish making your content below.</p>}
      {!item.finished && <p className="text-muted-foreground">This is a scene preview. Put your film together below before posting.</p>}
      {production && <details open={!item.finished || !item.media.length} className="border-t border-border pt-4"><summary className="cursor-pointer font-medium">{item.finished && item.media.length ? 'Edit or download your content' : 'Finish making your content'}</summary><div className="mt-5">{production}</div></details>}
    </section>
    <section className="space-y-5 border-t border-border pt-7">
      <h3 className="text-2xl font-semibold">Where do you want to post?</h3>
      {connected.length ? <div className="flex flex-wrap gap-4">{connected.map((a: any) => <label key={a.id} className="flex items-center gap-2 text-base"><Checkbox checked={selected.includes(a.platform)} onCheckedChange={v => setSelected(s => v ? [...new Set([...s, a.platform])] : s.filter(p => p !== a.platform))}/>{PLATFORM_META[a.platform as PublishingPlatform]?.label} · {a.profile_display_name || 'Connected'}</label>)}</div> : <p className="text-muted-foreground">No connected accounts for this content yet. Prepare your captions now and save to the library, or connect an account to post.</p>}
      <Button variant="outline" onClick={async () => { await save({ data: { id: projectId, wrapup } }); await navigate({ to: '/settings', search: { section: 'social-accounts' } }); }}>Connect an account</Button>
      {!connected.length && <fieldset className="flex flex-wrap gap-4"><legend className="mb-3 font-medium">Prepare captions for</legend>{platforms.map(p => <label key={p} className="flex items-center gap-2"><Checkbox checked={shown.includes(p)} onCheckedChange={v => setSelected(s => v ? [...new Set([...shown, p])] : shown.filter(x => x !== p))}/>{PLATFORM_META[p].label}</label>)}</fieldset>}
      <label className="block space-y-2 font-medium">Your link<Input aria-label="Your link" type="url" placeholder="https://your-website.com" value={link} onChange={e => setLink(e.target.value)}/></label>
      <p className="text-sm text-muted-foreground">Links are added to descriptions on YouTube and Pinterest, and captions elsewhere. Instagram: this link will not appear in the caption; add it to your profile instead. First-comment posting is not supported here. TikTok caption links may not be clickable.</p>
      <Button variant="outline" disabled={!!busy || !shown.length} onClick={generate}>{busy === 'captions' ? <Loader2 className="size-4 animate-spin"/> : <Sparkles className="size-4"/>}{busy === 'captions' ? progress : `${Object.keys(copies).length ? 'Regenerate' : 'Generate'} caption pack (${ACTION_COSTS.captionPack} plan credit)`}</Button>
      <div className="space-y-6">{shown.map(p => {
        const c = copies[p] ?? blank(), description = p === 'youtube' || p === 'pinterest', limit = publishingLimit(p, contentType), length = finalCaption(p, c, link).length, caps = PLATFORM_CAPABILITY_MATRIX[p];
        return <section key={p} className="space-y-3 border-l-2 border-border pl-4"><h4 className="text-lg font-semibold">{PLATFORM_META[p].label}</h4>
          {description && <label className="block space-y-2 text-sm font-medium">Title<Input aria-label={`${PLATFORM_META[p].label} title`} value={c.title} onChange={e => patch(p, 'title', e.target.value)}/><span className="text-muted-foreground">{c.title.length} / {caps.maxTitleChars}</span></label>}
          <label className="block space-y-2 font-medium">{description ? 'Description' : 'Caption'}<Textarea aria-label={`${PLATFORM_META[p].label} ${description ? 'description' : 'caption'}`} className="min-h-32 text-base" value={description ? c.description : c.caption} onChange={e => patch(p, description ? 'description' : 'caption', e.target.value)}/></label>
          <p className="text-sm text-muted-foreground" role="status">{length}{limit ? ` / ${limit}` : ''} characters, including hashtags and link.{limit && length >= limit * .9 ? length > limit ? ' Over the limit — edit before posting. Nothing will be cut.' : ' Getting close to the limit.' : ''}</p>
          <label className="block space-y-2 text-sm font-medium">Hashtags<Input aria-label={`${PLATFORM_META[p].label} hashtags`} value={c.hashtags} onChange={e => patch(p, 'hashtags', e.target.value)}/></label>
          <p className="text-sm text-muted-foreground">{tagList(c.hashtags).length} hashtags · {HASHTAG_GUIDANCE[p] ? `${HASHTAG_GUIDANCE[p]} recommended` : caps.maxHashtags === 0 ? 'None recommended' : caps.maxHashtags ? `Up to ${caps.maxHashtags} recommended` : 'Use only relevant tags'}</p>
        </section>;
      })}</div>
    </section>
    <section className="space-y-4 border-t border-border pt-7"><h3 className="text-2xl font-semibold">Publish or save</h3>
      <div className="flex flex-wrap gap-3"><Button disabled={!!busy || !canPost} onClick={() => submit(false)}><Send className="size-4"/>Post now</Button><Button variant="outline" disabled={!!busy} onClick={saveToLibrary}><FolderOpen className="size-4"/>{busy === 'saving' ? 'Saving…' : 'Save to library'}</Button></div>
      {!canPost && <p className="text-sm text-muted-foreground">{!connected.length ? 'Connect an account to post or schedule. Save to library is available now.' : !item.finished || !item.media.length ? 'Finish making your content before posting or scheduling.' : 'Select an account to post or schedule.'}</p>}
      <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-2 font-medium">Date<Input type="date" aria-label="Schedule date" value={date} onChange={e => setDate(e.target.value)}/></label><label className="space-y-2 font-medium">Time<Input type="time" aria-label="Schedule time" value={time} onChange={e => setTime(e.target.value)}/></label><div className="space-y-2"><p className="font-medium">Timezone</p><p className="pt-2 text-sm text-muted-foreground">{timezone} (your local time)</p></div></div>
      <Button variant="outline" disabled={!!busy || !canPost} onClick={() => submit(true)}><Calendar className="size-4"/>Schedule</Button>
      {notice && <p role="status" className="text-base text-muted-foreground">{notice} <Link to="/library" className="text-primary underline">Open library</Link></p>}
      {result && <div role="status" className="space-y-2"><p className="font-semibold capitalize">{result.status.replaceAll('_', ' ')}</p>{(result.results ?? []).map((r: any) => <p key={r.platform} className="text-sm">{PLATFORM_META[r.platform as PublishingPlatform]?.label ?? r.platform}: {r.status}{r.error_message ? ` — ${r.error_message}` : ''}{r.post_url && <> · <a href={r.post_url} target="_blank" rel="noreferrer" className="text-primary underline">View post</a></>}</p>)}</div>}
    </section>
  </div>;
}
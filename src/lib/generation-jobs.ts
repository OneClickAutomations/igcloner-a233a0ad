// Browser-safe registry of running AI jobs: survives refresh (localStorage) and announces completion app-wide.
import { toast } from 'sonner';

export type JobItem = { label: string; state: 'waiting' | 'running' | 'done' | 'failed' };
export type GenJob = { id: string; kind: string; title: string; href?: string; startedAt: number; expectedSeconds: number; doneLabel: string; long?: boolean };
const KEY = 'igc-generation-jobs';
const listeners = new Set<() => void>();
const read = (): GenJob[] => { if (typeof window === 'undefined') return []; try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
const write = (jobs: GenJob[]) => { localStorage.setItem(KEY, JSON.stringify(jobs.filter(j => Date.now() - j.startedAt < 3 * 3600_000))); listeners.forEach(l => l()); };
export const listJobs = read;
export function subscribeJobs(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Estimated percent for a job without real stages: eases toward 95% and keeps creeping, never reaching 100 before done. */
export function estimatePercent(elapsedSec: number, expectedSec: number, real?: number): number {
  const eased = 95 * (1 - Math.exp(-elapsedSec / Math.max(1, expectedSec / 2)));
  const creep = elapsedSec > expectedSec ? Math.min(4, (elapsedSec - expectedSec) / 30) : 0;
  return Math.min(99, Math.max(real ?? 0, Math.round(eased + creep)));
}
export function remainingLabel(elapsedSec: number, expectedSec: number): string {
  const left = expectedSec - elapsedSec;
  if (left <= 5) return 'Almost there…';
  return left >= 90 ? `About ${Math.round(left / 60)} min left` : `About ${Math.max(5, Math.round(left / 5) * 5)}s left`;
}

export function startJob(job: Omit<GenJob, 'startedAt'>) {
  write([...read().filter(j => j.id !== job.id), { ...job, startedAt: Date.now() }]);
  if (job.long && typeof Notification !== 'undefined' && Notification.permission === 'default' && !localStorage.getItem('igc-notify-asked')) {
    localStorage.setItem('igc-notify-asked', '1'); Notification.requestPermission().catch(() => {});
  }
}

/** Success: toast + slide to result when on the same page; persistent "View" toast and optional notification when elsewhere. */
export function finishJob(id: string, ok: boolean, opts: { error?: string; refunded?: boolean; resultSelector?: string; silent?: boolean } = {}) {
  const job = read().find(j => j.id === id); write(read().filter(j => j.id !== id));
  if (!job) return;
  const here = !job.href || job.href === window.location.pathname + window.location.search || job.href.split('?')[0] === window.location.pathname;
  if (!ok) { if (opts.silent && here) return; toast.error(`${job.title} failed`, { description: `${opts.error ?? 'Something went wrong.'}${opts.refunded ? ' Credits refunded.' : ''}` }); return; }
  if (here) { toast.success(job.doneLabel); if (opts.resultSelector) slideTo(opts.resultSelector); }
  else toast.success(job.doneLabel, { duration: Infinity, action: { label: 'View', onClick: () => { window.location.href = job.href!; } } });
  if (job.long && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification(job.doneLabel, { body: 'Open IGCloner to see it.' });
}

export function slideTo(selector: string) {
  requestAnimationFrame(() => setTimeout(() => {
    const el = document.querySelector(selector); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('gen-result-highlight'); setTimeout(() => el.classList.remove('gen-result-highlight'), 2400);
  }, 150));
}

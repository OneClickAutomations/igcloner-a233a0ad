import { useCallback, useRef, useState, type ReactNode } from 'react';
import { GenerationProgress } from './GenerationProgress';
import { finishJob, startJob, type JobItem } from '@/lib/generation-jobs';

export type GenRunOpts = {
  /** Which ring slot to show this job in (lets one component host several actions). */
  slot: string; title: string; stage: string; expectedSeconds: number; doneLabel: string;
  /** Paid actions are attempt-refunded server-side on failure, so the error shows "Credits refunded". */
  paid?: boolean; resultSelector?: string; items?: JobItem[]; long?: boolean; jobId?: string;
};
export type GenCtx = { setStage: (s: string) => void; setItems: (i: JobItem[]) => void; setPercent: (p: number) => void };
type Live = { opts: GenRunOpts; stage: string; startedAt: number; status: 'running' | 'done' | 'error'; items?: JobItem[]; percent?: number; error?: string; retry: () => void };

/**
 * Wraps any AI action with the shared GenerationProgress ring: plain-words stage, time left, per-item
 * status, success toast + slide-to-result, cross-page "View" toast, and error with refund note + Retry.
 * Errors are re-thrown so callers keep their existing handling.
 */
export function useGenJob() {
  const [live, setLive] = useState<Record<string, Live>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const patch = (slot: string, p: Partial<Live>) => setLive(l => (l[slot] ? { ...l, [slot]: { ...l[slot], ...p } } : l));
  const run = useCallback(async <T,>(opts: GenRunOpts, fn: (ctx: GenCtx) => Promise<T>): Promise<T> => {
    const { slot } = opts; clearTimeout(timers.current[slot]);
    const jobId = opts.jobId ?? `${slot}-${Date.now()}`;
    const retry = () => { run(opts, fn).catch(() => {}); };
    setLive(l => ({ ...l, [slot]: { opts, stage: opts.stage, startedAt: Date.now(), status: 'running', items: opts.items, retry } }));
    startJob({ id: jobId, kind: slot, title: opts.title, href: window.location.pathname + window.location.search, expectedSeconds: opts.expectedSeconds, doneLabel: opts.doneLabel, long: opts.long });
    try {
      const r = await fn({ setStage: stage => patch(slot, { stage }), setItems: items => patch(slot, { items }), setPercent: percent => patch(slot, { percent }) });
      patch(slot, { status: 'done' }); finishJob(jobId, true, { resultSelector: opts.resultSelector });
      timers.current[slot] = setTimeout(() => setLive(l => { const n = { ...l }; delete n[slot]; return n; }), 2500);
      return r;
    } catch (e) {
      const error = (e as Error).message;
      patch(slot, { status: 'error', error }); finishJob(jobId, false, { error, refunded: opts.paid, silent: true });
      throw e;
    }
  }, []);
  const ring = (slot: string, compact = true): ReactNode => {
    const j = live[slot]; if (!j) return null;
    return <div className="mt-3" data-gen-slot={slot}><GenerationProgress compact={compact} status={j.status} stage={j.stage} startedAt={j.startedAt} expectedSeconds={j.opts.expectedSeconds} percent={j.percent} items={j.items} error={j.error} refunded={j.opts.paid} onRetry={j.retry}/></div>;
  };
  const isRunning = (slot?: string) => Object.entries(live).some(([k, j]) => j.status === 'running' && (!slot || k === slot));
  const has = (slot: string) => !!live[slot];
  return { run, ring, isRunning, has };
}

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { estimatePercent, remainingLabel, type JobItem } from '@/lib/generation-jobs';

/** Shared progress display for every AI generation: ring, plain-words stage, time left, per-item status, error + retry. */
export function GenerationProgress({ status = 'running', stage, startedAt, expectedSeconds, percent, items, error, refunded, onRetry, compact, note }: {
  status?: 'running' | 'done' | 'error'; stage: string; startedAt: number; expectedSeconds: number; percent?: number;
  items?: JobItem[]; error?: string; refunded?: boolean; onRetry?: () => void; compact?: boolean; note?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (status !== 'running') return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [status]);
  const elapsed = Math.max(0, (now - startedAt) / 1000);
  const itemPct = items?.length ? (items.filter(i => i.state === 'done').length / items.length) * 100 : undefined;
  const real = percent ?? itemPct;
  const pct = status === 'done' ? 100 : status === 'error' ? Math.round(real ?? 0) : estimatePercent(elapsed, expectedSeconds, real);
  const size = compact ? 64 : 120, r = compact ? 26 : 52, c = 2 * Math.PI * r, sw = compact ? 6 : 10;
  return (
    <div className={`gen-progress ${compact ? 'gen-progress-compact' : ''}`} data-status={status} role="status" aria-live="polite">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size} aria-hidden>
          <defs><linearGradient id="gp-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--color-accent-primary)"/><stop offset="100%" stopColor="var(--color-accent-secondary)"/></linearGradient></defs>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={sw}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={status === 'error' ? 'var(--color-status-error)' : status === 'done' ? 'var(--color-status-success)' : 'url(#gp-grad)'} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700"/>
        </svg>
        <span className={`absolute inset-0 grid place-items-center font-bold tabular-nums ${compact ? 'text-sm' : 'text-2xl'}`}>{status === 'error' ? <AlertTriangle className="size-6 text-status-error"/> : status === 'done' ? <Check className="size-7 text-status-success"/> : `${pct}%`}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${compact ? 'text-base' : 'text-lg'} font-semibold`}>{status === 'error' ? 'That didn’t work' : stage}</p>
        {status === 'running' && <p className="text-sm text-muted-foreground">{remainingLabel(elapsed, expectedSeconds)}{note ? ` · ${note}` : ''}</p>}
        {status === 'error' && <><p className="text-sm text-foreground">{error ?? 'Something went wrong.'}</p>{refunded && <p className="flex items-center gap-1 text-sm font-semibold text-foreground"><Check className="size-4 text-status-success"/>Credits refunded</p>}{onRetry && <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}><RotateCcw className="size-4"/> Retry</Button>}</>}
        {items && items.length > 1 && <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{items.map(i => <li key={i.label} className="flex items-center gap-1.5">
          {i.state === 'done' ? <Check className="size-4 text-status-success"/> : i.state === 'running' ? <Loader2 className="size-4 animate-spin text-accent-primary"/> : i.state === 'failed' ? <AlertTriangle className="size-4 text-status-error"/> : <span className="size-4 rounded-full border-2 border-border"/>}
          <span>{i.label}</span><span className="text-muted-foreground">{i.state === 'done' ? '' : i.state === 'running' ? 'working…' : i.state === 'failed' ? 'failed' : 'waiting'}</span></li>)}</ul>}
      </div>
    </div>
  );
}

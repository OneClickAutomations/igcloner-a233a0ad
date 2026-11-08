import { useEffect, useState } from 'react';

/** Circular progress driven by the analysis row's real stage and last_progress_at heartbeat. */
export function AnalysisProgress({ percent, label, lastProgressAt }: { percent: number; label: string; lastProgressAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  const idleSec = lastProgressAt ? Math.max(0, (now - new Date(lastProgressAt).getTime()) / 1000) : 0;
  const slow = idleSec > 120, stalled = idleSec > 600;
  const r = 52, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="glass-surface p-8 text-center" role="status" aria-live="polite">
      <div className="relative mx-auto size-40">
        <svg viewBox="0 0 120 120" className="size-40 -rotate-90">
          <defs><linearGradient id="ap-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--color-accent-primary)"/><stop offset="100%" stopColor="var(--color-accent-secondary)"/></linearGradient></defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="10"/>
          <circle cx="60" cy="60" r={r} fill="none" stroke="url(#ap-grad)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700"/>
        </svg>
        <span className="absolute inset-0 grid place-items-center text-4xl font-bold tabular-nums">{pct}%</span>
      </div>
      <p className="mt-6 text-xl font-semibold">{label || 'Getting started'}</p>
      <p className="mt-2 text-base text-muted-foreground">
        {stalled ? 'This has stopped moving. If nothing changes in a few minutes it will be cancelled and your credits returned.'
          : slow ? 'This part is taking longer than usual. It is still working — please keep this page open.'
          : 'This usually takes about a minute. You can keep this page open and watch it work.'}
      </p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { GenerationProgress } from './GenerationProgress';

/** Analysis uses the shared progress ring with real pipeline stages plus heartbeat-based stall messaging. */
export function AnalysisProgress({ percent, label, lastProgressAt }: { percent: number; label: string; lastProgressAt: string | null }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  const idleSec = lastProgressAt ? Math.max(0, (now - new Date(lastProgressAt).getTime()) / 1000) : 0;
  const slow = idleSec > 120, stalled = idleSec > 600;
  return <div className="space-y-3">
    <GenerationProgress stage={label ? `${label}…`.replace(/……$/, '…') : 'Getting started…'} percent={percent} startedAt={startedAt} expectedSeconds={90} />
    <p className="text-center text-sm text-muted-foreground">
      {stalled ? 'This has stopped moving. If nothing changes in a few minutes it will be cancelled and your credits returned.'
        : slow ? 'This part is taking longer than usual. It is still working — please keep this page open.'
        : 'You can keep this page open and watch it work.'}
    </p>
  </div>;
}

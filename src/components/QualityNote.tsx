import { Info, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import type { QualityReport } from '@/lib/copy-rules';

/** Quiet score note under generated copy. Never an error: the output is always shown. */
export function QualityNote({ report, onRegenerate, regenerateLabel = 'Regenerate', busy }: { report?: QualityReport | null; onRegenerate?: () => void; regenerateLabel?: string; busy?: boolean }) {
  if (!report || report.passed || !report.note) return null;
  const low = report.level === 'low';
  return <div role="note" className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${low ? 'border-status-warning/50 bg-status-warning/10 text-foreground' : 'border-border/60 bg-background/40 text-muted-foreground'}`}>
    <Info className="size-4 shrink-0"/><span className={low ? 'font-medium' : ''}>{report.note}</span>
    {onRegenerate && <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={onRegenerate}><RefreshCw className="size-3.5"/>{regenerateLabel}</Button>}
  </div>;
}

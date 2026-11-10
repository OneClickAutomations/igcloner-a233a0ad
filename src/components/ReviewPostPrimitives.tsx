import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { MetricHelp } from './MetricHelp';

export function ReviewCard({ title, icon: Icon, children, trailing, tone = '' }: { title: string; icon: LucideIcon; children: ReactNode; trailing?: ReactNode; tone?: string }) {
  return <article className={`review-card ${tone}`}><header className="mb-6 flex items-center justify-between gap-3"><h3 className="flex min-w-0 items-center gap-3 text-xl font-bold"><Icon className="size-5 shrink-0 text-review-accent"/>{title}</h3>{trailing}</header>{children}</article>;
}

export function ReviewMetric({ label, value, icon: Icon, help, highlight = false }: { label: string; value: ReactNode; icon: LucideIcon; help: string; highlight?: boolean }) {
  return <div className={`review-metric ${highlight ? 'review-highlight' : ''}`}><div className="flex items-center justify-between gap-1"><Icon className="size-5 text-review-accent"/><MetricHelp label={label}>{help}</MetricHelp></div><p className={`mt-2 break-words font-bold leading-tight ${label === 'Account type' || label === 'Posted' ? 'text-base' : 'text-xl'}`}>{value}</p><p className="mt-2 text-sm text-review-muted">{label}</p></div>;
}

export function ReviewAccordion({ title, description, icon: Icon, children }: { title: string; description: string; icon: LucideIcon; children: ReactNode }) {
  return <details className="review-card group"><summary className="flex cursor-pointer list-none items-center gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-review-tint text-review-accent"><Icon className="size-5"/></span><span className="min-w-0 flex-1"><span className="block text-lg font-bold">{title}</span><span className="mt-1 block text-sm text-review-muted">{description}</span></span><ChevronDown className="size-5 shrink-0 text-review-muted transition-transform group-open:rotate-180"/></summary><div className="mt-6 border-t border-review-border pt-6 text-base leading-relaxed">{children}</div></details>;
}
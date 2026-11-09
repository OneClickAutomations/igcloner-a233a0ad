import type { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Button } from './ui/button';
import { CREATION_STEPS } from '@/lib/creation-draft';

export function CreationWizardShell({ step, instructions, children, onBack, onNext, onClose, disabled, busy, saved, nextHint }: {
  step: number; instructions: string; children: ReactNode; onBack: () => void; onNext: () => void;
  onClose: () => void; disabled?: boolean; busy?: boolean; saved?: string; nextHint?: string;
}) {
  const total = CREATION_STEPS.length;
  return <div className="creation-workspace wizard-backdrop min-h-full">
    <div className="mx-auto max-w-6xl px-4 py-8 text-base sm:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Create a project</h1>
        <div className="flex items-center gap-3"><span role="status" className="text-sm text-muted-foreground">{saved}</span><Button variant="outline" disabled={busy} onClick={onClose}><Save className="size-4"/>Save and close</Button></div>
      </div>

      <nav aria-label="Progress" className="mb-10 border-b border-border px-5 py-5 sm:px-6">
        <p className="text-base font-semibold sm:mb-4">Step {step + 1} of {total}<span className="sm:hidden"> — {CREATION_STEPS[step]}</span></p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted sm:hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${((step + 1) / total) * 100}%` }}/></div>
        <ol aria-label="Creation steps" className="hidden grid-cols-6 gap-3 sm:grid">{CREATION_STEPS.map((name, i) => {
          const done = i < step, cur = i === step;
          return <li key={name} aria-current={cur ? 'step' : undefined} className="flex flex-col items-start gap-2">
            <span className={`grid size-9 place-items-center rounded-full text-sm font-bold ${cur ? 'bg-primary text-primary-foreground' : done ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'}`}>{done ? <Check className="size-4"/> : i + 1}</span>
            <span className={`text-sm leading-snug ${cur ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{name}</span>
          </li>;
        })}</ol>
      </nav>

      <section className="py-2 sm:py-4">
        <header className="mb-8"><h2 className="text-3xl font-semibold sm:text-4xl">{CREATION_STEPS[step]}</h2><p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">{instructions}</p></header>
        <div className="min-h-64">{children}</div>
      </section>

      <footer className="border border-border bg-card report-elevation rounded-lg sticky bottom-3 z-30 mt-6 flex items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <Button variant="outline" size="lg" disabled={step === 0 || busy} onClick={onBack}><ChevronLeft className="size-5"/>Back</Button>
        <div className="flex items-center gap-4">
          {nextHint && <span className="hidden text-sm text-muted-foreground sm:inline">{nextHint}</span>}
          <Button size="lg" className="px-8 text-base" disabled={disabled || busy} onClick={onNext}>{busy ? 'Saving…' : step === total - 1 ? 'Save and finish' : 'Next'}<ChevronRight className="size-5"/></Button>
        </div>
      </footer>
    </div>
  </div>;
}

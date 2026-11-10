import type { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Save, BarChart3, Link2, LayoutGrid, Pencil, Wand2, Send } from 'lucide-react';
import { Button } from './ui/button';
import { CREATION_STEPS } from '@/lib/creation-draft';

export function CreationWizardShell({ step, instructions, children, onBack, onNext, onClose, disabled, busy, saved, nextHint }: {
  step: number; instructions: string; children: ReactNode; onBack: () => void; onNext: () => void;
  onClose: () => void; disabled?: boolean; busy?: boolean; saved?: string; nextHint?: string;
}) {
  const total = CREATION_STEPS.length;
  const StepIcon = [Link2, BarChart3, LayoutGrid, Pencil, Wand2, Send][step] ?? BarChart3;
  return <div className="review-screen creation-wizard min-h-full">
    <div className="mx-auto max-w-6xl px-4 py-8 text-base sm:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Create a project</h1>
        <div className="flex items-center gap-3"><span role="status" className="text-sm text-muted-foreground">{saved}</span><Button variant="outline" disabled={busy} onClick={onClose}><Save className="size-4"/>Save and close</Button></div>
      </div>

      <nav aria-label="Progress" className={`review-card mb-8 px-5 py-5 sm:px-6`}>
        <p className="text-base font-semibold sm:mb-4">Step {step + 1} of {total}<span className="sm:hidden"> — {CREATION_STEPS[step]}</span></p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted sm:hidden"><div className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary" style={{ width: `${((step + 1) / total) * 100}%` }}/></div>
        <ol aria-label="Creation steps" className="hidden grid-cols-6 gap-3 sm:grid">{CREATION_STEPS.map((name, i) => {
          const done = i < step, cur = i === step;
          return <li key={name} aria-current={cur ? 'step' : undefined} className="flex flex-col items-start gap-2">
            <span className={`grid size-9 place-items-center rounded-full text-sm font-bold ${cur ? 'bg-gradient-to-br from-accent-primary to-accent-secondary text-primary-foreground shadow-lg' : done ? 'bg-status-success/15 text-status-success' : 'bg-muted text-muted-foreground'}`}>{done ? <Check className="size-4"/> : i + 1}</span>
            <span className={`text-sm leading-snug ${cur ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{name}</span>
          </li>;
        })}</ol>
      </nav>

      <section>
        <header className="mb-8 flex items-start gap-4 sm:gap-5"><span className="review-gradient grid size-14 shrink-0 place-items-center rounded-2xl sm:size-16"><StepIcon className="size-7"/></span><div className="min-w-0"><h2 className="text-3xl font-bold sm:text-[40px] sm:leading-tight">{CREATION_STEPS[step]}</h2><p className="mt-3 max-w-2xl text-base leading-relaxed text-review-muted sm:text-lg">{step === 1 ? 'See what caught people’s attention and what is worth keeping. Use the evidence below to shape a stronger version of your own.' : instructions}</p></div></header>
        <div className="min-h-64">{children}</div>
      </section>

      <footer className={`review-card sticky bottom-3 z-30 mt-6 flex items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6`}>
        <Button variant="outline" size="lg" disabled={step === 0 || busy} onClick={onBack}><ChevronLeft className="size-5"/>Back</Button>
        <div className="flex items-center gap-4">
          {nextHint && <span className="hidden text-sm text-muted-foreground sm:inline">{nextHint}</span>}
          <Button size="lg" className={`review-gradient px-8 text-base`} disabled={disabled || busy} onClick={onNext}>{busy ? 'Saving…' : step === total - 1 ? 'Save and finish' : 'Next'}<ChevronRight className="size-5"/></Button>
        </div>
      </footer>
    </div>
  </div>;
}

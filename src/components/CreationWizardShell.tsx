import type { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Save, BarChart3, Link2, LayoutGrid, Pencil, Wand2, Send } from 'lucide-react';
import { Button } from './ui/button';
import { CREATION_STEPS } from '@/lib/creation-draft';

export function CreationWizardShell({ step, instructions, children, onBack, onNext, onClose, disabled, busy, saved, nextHint,filmReview,publishing }: {
  step: number; instructions: string; children: ReactNode; onBack: () => void; onNext: () => void;
  onClose: () => void; disabled?: boolean; busy?: boolean; saved?: string; nextHint?: string;filmReview?:boolean;publishing?:boolean;
}) {
  const total = CREATION_STEPS.length;
  const StepIcon = [Link2, BarChart3, LayoutGrid, Pencil, Wand2, Send][step] ?? BarChart3;
  return <div className="review-screen creation-wizard min-h-full">
    <div className="wizard-container mx-auto max-w-6xl px-4 py-6 text-base sm:px-8">
      <div className="wizard-heading mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0"><p className="mb-2 text-sm font-medium text-review-muted">Create a project <span aria-hidden="true">/</span> Step {step + 1} of {total}</p><div className="flex min-w-0 items-center gap-3"><span className="review-gradient grid size-11 shrink-0 place-items-center rounded-xl"><StepIcon className="size-6"/></span><h1 className="text-3xl font-bold sm:text-[40px] sm:leading-tight">{publishing?'Publish':filmReview?'Review your video':CREATION_STEPS[step]}</h1></div></div>
        <div className="flex flex-wrap justify-end gap-2">{filmReview&&!publishing&&<Button variant="outline" disabled={busy} onClick={onBack}><ChevronLeft className="size-4"/>Back to making</Button>}<Button variant="outline" aria-label="Save and close" title="Save and close" disabled={busy} onClick={onClose}><Save className="size-4"/><span className="hidden sm:inline">Save and close</span></Button></div>
      </div>

      <nav aria-label="Progress" className="review-card wizard-progress mb-6">
        <div className="mb-3 flex items-center justify-between text-sm sm:hidden"><span className="font-semibold">{CREATION_STEPS[step]}</span><span className="text-review-muted">{step + 1} / {total}</span></div>
        <div className="wizard-progress-track sm:hidden" role="progressbar" aria-label="Project progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + 1}><div className="wizard-progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }}/></div>
        <ol aria-label="Creation steps" className="hidden grid-cols-6 gap-3 sm:grid">{CREATION_STEPS.map((name, i) => {
          const done = i < step, cur = i === step;
          return <li key={name} aria-current={cur ? 'step' : undefined} className="flex flex-col items-start gap-2">
            <span className={`grid size-9 place-items-center rounded-full text-sm font-bold ${cur ? 'bg-gradient-to-br from-accent-primary to-accent-secondary text-primary-foreground shadow-lg' : done ? 'bg-status-success/15 text-status-success' : 'bg-muted text-muted-foreground'}`}>{done ? <Check className="size-4"/> : i + 1}</span>
            <span className={`text-sm leading-snug ${cur ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{name}</span>
          </li>;
        })}</ol>
      </nav>

      <section>
        <header className="wizard-step-heading mb-5"><p className="max-w-3xl text-base leading-relaxed text-review-muted">{step === 0 ? 'Start with a post you like. Paste its Instagram or Facebook link, or choose an analysis you have already saved.' : step === 1 ? 'Explore the subject, execution and results. Use the evidence to decide what to adapt, improve or leave behind.' : instructions}</p></header>
        <div className="min-h-64">{children}</div>
      </section>

      <footer className={`review-card ${publishing?'':'sticky bottom-3 z-30'} mt-6 flex items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6`}>
        <Button variant="outline" size="lg" disabled={step === 0 || busy} onClick={filmReview&&!publishing?onClose:onBack}>{filmReview&&!publishing?<Save className="size-5"/>:<ChevronLeft className="size-5"/>}{filmReview&&!publishing?'Save as draft':'Back'}</Button>
        <div className="flex items-center gap-4">
          {nextHint && <span className="max-w-[14rem] text-right text-sm font-medium text-muted-foreground">{nextHint}</span>}
          <Button size="lg" disabled={disabled || busy} onClick={onNext}>{busy ? 'Saving…' : filmReview&&!publishing?'Publish':publishing?'Save as draft':step === total - 1 ? 'Save and finish' : 'Next'}<ChevronRight className="size-5"/></Button>
        </div>
      </footer>
      <p role="status" className="mt-3 text-right text-sm text-review-muted">{saved}</p>
    </div>
  </div>;
}

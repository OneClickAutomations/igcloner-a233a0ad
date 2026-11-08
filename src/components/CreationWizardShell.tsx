import type { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Button } from './ui/button';
import { CREATION_STEPS } from '@/lib/creation-draft';

export function CreationWizardShell({ step, instructions, children, onBack, onNext, onClose, disabled, busy, saved }: {
  step: number; instructions: string; children: ReactNode; onBack: () => void; onNext: () => void;
  onClose: () => void; disabled?: boolean; busy?: boolean; saved?: string;
}) {
  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <h1 className="text-xl font-semibold">Create a project</h1>
      <div className="flex items-center gap-3"><span role="status" className="text-xs text-muted-foreground">{saved}</span><Button variant="outline" size="sm" disabled={busy} onClick={onClose}><Save className="size-4"/>Save and close</Button></div>
    </div>
    <p className="mb-4 text-sm font-medium">Step {step + 1} of {CREATION_STEPS.length}<span className="sm:hidden"> — {CREATION_STEPS[step]}</span></p>
    <ol aria-label="Creation steps" className="mb-8 hidden grid-cols-6 gap-3 sm:grid">{CREATION_STEPS.map((name,i) => <li key={name} aria-current={i===step?'step':undefined} className={`border-t-2 pt-3 ${i===step?'border-primary text-foreground':i<step?'border-status-success text-muted-foreground':'border-border text-muted-foreground'}`}><span className="mb-2 flex items-center gap-2 text-xs">{i<step?<Check className="size-4 text-status-success"/>:i+1}{i<step?'Done':i===step?'Current':'To come'}</span><span className="text-sm font-medium">{name}</span></li>)}</ol>
    <header className="mb-6"><h2 className="text-2xl font-semibold">{CREATION_STEPS[step]}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{instructions}</p></header>
    <div className="min-h-64 pb-6">{children}</div>
    <footer className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button variant="outline" disabled={step===0||busy} onClick={onBack}><ChevronLeft className="size-4"/>Back</Button>
      <Button disabled={disabled||busy} onClick={onNext}>{busy?'Saving…':step===5?'Save and finish':'Next'}<ChevronRight className="size-4"/></Button>
    </footer>
  </div>;
}
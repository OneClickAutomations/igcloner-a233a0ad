import { CircleHelp } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export function MetricHelp({ label, children }: { label: string; children: React.ReactNode }) {
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" aria-label={`About ${label}`}><CircleHelp className="size-4"/></Button></PopoverTrigger><PopoverContent className="max-w-72 text-sm leading-relaxed">{children}</PopoverContent></Popover>;
}
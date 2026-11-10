import { Settings2 } from 'lucide-react';
import { ReviewCard } from './ReviewPostPrimitives';
import { Input } from './ui/input';
import { observedVideoChanges } from '@/lib/video-changes';
export function VideoChangeList({source,values={},onChange}:{source:any;values?:Record<string,string>;onChange:(values:Record<string,string>)=>void}) {
  const rows=observedVideoChanges(source);
  return <ReviewCard title="What would you like to change?" icon={Settings2}><div className="space-y-5">{rows.map(row=><div key={row.key} className="grid gap-3 border-b border-border pb-5 sm:grid-cols-2"><div><h3 className="font-semibold">{row.label}</h3><p className="mt-1 text-sm text-review-muted">Source: {row.source}</p></div><label className="space-y-2 text-sm font-medium">Your version<Input aria-label={`Change ${row.label}`} list={`change-options-${row.key}`} value={values[row.key]??row.recommended} onChange={e=>onChange({...values,[row.key]:e.target.value})}/><datalist id={`change-options-${row.key}`}>{[...new Set(row.options)].map(option=><option key={option} value={option}/>)}</datalist></label></div>)}</div></ReviewCard>;
}
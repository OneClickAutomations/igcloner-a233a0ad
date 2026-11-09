import { Button } from './ui/button';
import { ProvenanceBadge } from './AnalysisEvidencePanel';

export function SourceWritingGuide({ analysis, onUse }: { analysis: any; onUse: (text: string) => void }) {
  const dna = analysis?.dna ?? analysis?.dna_analysis ?? {};
  const hook = dna.hookBreakdown ?? {};
  const cap = dna.captionDNA ?? {};
  const audience = dna.targetAudience ?? {};
  const original = analysis?.transcript || analysis?.blueprint?.audio?.transcriptFull;
  const suggestions = [
    { title: 'Keep the tension, change the subject', text: hook.whyItWorks || hook.whatWorks, brief: `Use the source’s ${hook.mechanism || hook.type || 'opening'} to address ${audience.desire || 'one specific audience problem'}. Start with a concrete situation, then show the payoff.` },
    { title: 'Answer the audience’s real question', text: audience.desire, brief: `Show ${audience.who || 'my audience'} how to approach ${audience.desire || 'the problem in the source'}. Use one visible example, not a broad promise.` },
    { title: 'Make the original clearer', text: hook.improvement || hook.scoreReasoning || cap.bodyPattern, brief: `Keep the source’s ${cap.bodyPattern || 'hook, explanation and payoff'} structure. ${hook.improvement || 'Make the opening specific and demonstrate the main point.'} Finish with ${cap.ctaType || 'one clear next step'}.` },
  ].filter(s => s.text);
  return <section className="space-y-6">
    <div><h3 className="text-xl font-semibold">Start with what worked</h3><p className="mt-2 text-sm text-muted-foreground">Use the post’s strongest idea, then make the message yours.</p></div>
    <dl className="grid gap-5 border-y border-border py-5 sm:grid-cols-2">{[['Opening mechanism',hook.mechanism || hook.type],['Source angle',dna.contentSummary],['Structure',cap.bodyPattern],['Emotional driver',audience.trigger || audience.desire]].filter(([,v])=>v).map(([label,value])=><div key={label}><dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt><dd className="mt-2 text-sm leading-relaxed">{value}</dd></div>)}</dl>
    {hook.exactText && <div><p className="mb-2 flex items-center gap-2 text-sm font-medium">The original opening <ProvenanceBadge p="observed"/></p><blockquote className="border-l-2 border-border pl-4 text-lg">{hook.exactText}</blockquote></div>}
    {original && <details><summary className="text-sm font-medium">Read the original spoken words</summary><p className="mt-3 max-h-48 overflow-auto whitespace-pre-line text-sm leading-relaxed">{original}</p></details>}
    {suggestions.length>0 && <div><p className="mb-4 flex items-center gap-2 font-medium">Directions you can adapt <ProvenanceBadge p="inferred"/></p><div className="grid gap-4 sm:grid-cols-3">{suggestions.map(s=><article key={s.title} className="flex flex-col rounded-lg border border-border bg-card p-5"><h4 className="font-semibold">{s.title}</h4><p className="my-3 flex-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p><Button variant="outline" onClick={()=>onUse(s.brief)}>Use this direction</Button></article>)}</div></div>}
  </section>;
}
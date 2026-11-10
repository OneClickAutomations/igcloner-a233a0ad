import { VOICE_CATALOG } from '@/lib/voice-catalog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function AdvancedVoiceSettings({ voiceId, recommendation, onChange }: {
  voiceId: string;
  recommendation: { voice: { id: string; name: string }; reason: string };
  onChange: (id: string) => void;
}) {
  const selected = VOICE_CATALOG.find(v => v.id === voiceId);
  return <div className="mt-4 space-y-3">
    <p className="text-sm font-medium">Voice: {selected?.name ?? recommendation.voice.name} · ElevenLabs{voiceId === recommendation.voice.id ? ' · Auto-matched' : ' · Your choice'}</p>
    <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
    <details>
      <summary className="cursor-pointer text-sm font-medium">Advanced audio settings</summary>
      <div className="mt-3 space-y-3">
        <label className="block text-sm font-medium" htmlFor="advanced-voice">Narration voice</label>
        <Select value={voiceId} onValueChange={onChange}>
          <SelectTrigger id="advanced-voice" aria-label="Narration voice"><SelectValue /></SelectTrigger>
          <SelectContent>{VOICE_CATALOG.map(v => <SelectItem key={v.id} value={v.id}>{v.name} — {v.gender}, {v.accent} · {v.description}</SelectItem>)}</SelectContent>
        </Select>
        {voiceId !== recommendation.voice.id && <Button variant="ghost" size="sm" onClick={() => onChange(recommendation.voice.id)}>Use source-matched voice</Button>}
      </div>
    </details>
  </div>;
}
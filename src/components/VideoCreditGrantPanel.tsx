import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { adminGrantVideoCredits } from '@/lib/video-credits.functions';
import { VIDEO_BALANCE_KEY } from '@/lib/studio-pricing';

export function VideoCreditGrantPanel() {
  const grant = useServerFn(adminGrantVideoCredits); const qc = useQueryClient();
  const [email, setEmail] = useState(''), [amount, setAmount] = useState(40), [busy, setBusy] = useState(false);
  return <section className="mx-auto max-w-7xl border-b border-border px-4 py-6 lg:px-8">
    <h2 className="text-lg font-semibold">Grant video credits</h2>
    <p className="mb-3 text-sm text-muted-foreground">Adds to any account's separate video balance. 1 video credit ≈ 1 second of Veo Fast (~$0.12 real cost).</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Account email<Input aria-label="Account email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-72"/></label>
      <label className="text-sm">Video credits<Input aria-label="Video credits to grant" type="number" min={1} max={2000} value={amount} onChange={e => setAmount(Number(e.target.value))} className="mt-1 w-32"/></label>
      <Button disabled={busy || !email} onClick={async () => { setBusy(true); try { const r = await grant({ data: { email, amount } }); toast.success(`Granted. New balance: ${r.balance} video credits.`); qc.invalidateQueries({ queryKey: VIDEO_BALANCE_KEY }); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>Grant</Button>
    </div>
  </section>;
}

import { describe, it, expect } from 'vitest';
import { ensureTrialGrant, validateAdminGrant, trialGrantKey } from './video-grants';
import { STUDIO_PRICING } from './studio-pricing';
// Mirrors the ledger's unique (user_id, idempotency_key) + ON CONFLICT DO NOTHING.
function ledger() { const rows = new Map<string, number>(); return { rows, grant: async (u: string, a: number, _r: string, k: string) => { const id = `${u}|${k}`; if (rows.has(id)) return false; rows.set(id, a); return true; }, balance: (u: string) => [...rows].filter(([k]) => k.startsWith(u + '|')).reduce((n, [, v]) => n + v, 0) }; }
describe('video credit grants', () => {
  it('grants the 20-credit trial once to a new account', async () => {
    const l = ledger();
    expect(await ensureTrialGrant('u1', '2026-11-09T00:00:00Z', l.grant)).toBe(true);
    expect(l.balance('u1')).toBe(20);
    expect(STUDIO_PRICING.video.trialCredits).toBe(20);
  });
  it('never grants the trial twice', async () => {
    const l = ledger();
    await ensureTrialGrant('u1', '2026-11-09T00:00:00Z', l.grant);
    expect(await ensureTrialGrant('u1', '2026-11-09T00:00:00Z', l.grant)).toBe(false);
    await Promise.all([ensureTrialGrant('u1', '2026-11-09T00:00:00Z', l.grant), ensureTrialGrant('u1', '2026-11-09T00:00:00Z', l.grant)]);
    expect(l.balance('u1')).toBe(20);
    expect(trialGrantKey('u1')).toBe(trialGrantKey('u1'));
  });
  it('rejects grants from non-admins', () => {
    expect(() => validateAdminGrant(false, 150)).toThrow('Only admins');
    expect(validateAdminGrant(true, 150)).toBe(150);
  });
});

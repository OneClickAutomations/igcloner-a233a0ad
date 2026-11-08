import { STUDIO_PRICING } from './studio-pricing';
/** Stable per-account key: the ledger's unique (user, key) makes the trial grant once-only. */
export const trialGrantKey = (userId: string) => `trial:${userId}`;
export function trialEligible(createdAt: string | null | undefined) {
  return Boolean(createdAt) && new Date(createdAt as string).getTime() >= new Date(STUDIO_PRICING.video.trialStartsAt).getTime();
}
export function validateAdminGrant(isAdmin: boolean, amount: number) {
  if (!isAdmin) throw new Error('Only admins can grant video credits.');
  if (!Number.isInteger(amount) || amount < 1 || amount > 2000) throw new Error('Grant between 1 and 2000 video credits.');
  return amount;
}
type Grant = (userId: string, amount: number, reason: string, key: string) => Promise<boolean>;
export async function ensureTrialGrant(userId: string, createdAt: string | null | undefined, grant: Grant) {
  if (!trialEligible(createdAt)) return false;
  return grant(userId, STUDIO_PRICING.video.trialCredits, 'trial_grant', trialGrantKey(userId));
}

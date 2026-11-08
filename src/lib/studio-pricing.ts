/** Verified source: owner-confirmed purchase receipts, 2026-11-08:
 * $15 / 50 workspace credits and $30 / 100 workspace credits = $0.30 each.
 * Pricing policy is centralized; existing ACTION_COSTS and plans are unchanged.
 */
export const STUDIO_PRICING = {
  workspaceCreditUsd: 0.30,
  customerCreditUsd: 0.145,
  costCeiling: 0.35,
  source: 'Owner-confirmed purchase prices: $15/50 credits and $30/100 credits, 2026-11-08',
  stillWorkspaceCredits: null as number | null,
  video: {
    approved: true as boolean,
    purchasesEnabled: false as boolean,
    unitCostUsd: 0.12,
    voiceoverUsdPerCharacter: null as number | null,
    packs: [
      { id: 'trial', name: 'Trial', credits: 40, usd: 15 },
      { id: 'standard', name: 'Standard', credits: 160, usd: 49 },
      { id: 'bulk', name: 'Bulk', credits: 400, usd: 109 },
    ],
  },
  rates: { 'google/veo-3.1-fast':0.4, 'google/veo-3.1-lite':0.2, 'google/gemini-omni-1.1-flash':null },
  renderUsdPerMinute: 0.20,
} as const;
export const VIDEO_BALANCE_KEY = ['video-credit-balance'] as const;
export function videoCreditsForUsd(usd: number) {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('Invalid video cost.');
  return Math.max(0, Math.ceil(usd / STUDIO_PRICING.video.unitCostUsd - 1e-9));
}
export function videoCreditsForWorkspace(workspace: number) {
  return videoCreditsForUsd(workspace * STUDIO_PRICING.workspaceCreditUsd);
}
export function videoBalanceQuote(credits: number, balance: number, seconds: number) {
  return { credits, balance, remaining: Math.max(0, balance - credits), sufficient: balance >= credits,
    equivalent: `This ${seconds}-second video will use ${credits} of your ${balance} video credits.`,
    afterwards: balance >= credits ? `${balance - credits} video credits will remain afterwards.` : `You need ${credits - balance} more video credits. Nothing will be charged; your storyboard and approved stills are saved.` };
}
export function videoPackMargin(pack: {credits:number;usd:number}) {
  return {cost: pack.credits * STUDIO_PRICING.video.unitCostUsd, usdPerCredit: pack.usd / pack.credits,
    grossMargin: 1 - pack.credits * STUDIO_PRICING.video.unitCostUsd / pack.usd};
}
export function priceUsd(cost: number, ceiling: number = STUDIO_PRICING.costCeiling) {
  if(!Number.isFinite(cost)||cost<0||ceiling<=0||ceiling>1)throw new Error('Invalid cost or ceiling.');
  const customerCredits=Math.ceil(cost/(STUDIO_PRICING.customerCreditUsd*ceiling));
  const revenue=customerCredits*STUDIO_PRICING.customerCreditUsd;
  return { usd:cost,customerCredits,revenue,grossMargin:revenue===0?null:1-cost/revenue };
}
export function priceWorkspace(workspaceCredits: number, ceiling: number = STUDIO_PRICING.costCeiling) {
  return {workspaceCredits,...priceUsd(workspaceCredits*STUDIO_PRICING.workspaceCreditUsd,ceiling)};
}
export function monthlyCreditEquivalent(credits:number,allowance:number|null,subject='This action') {
  return allowance ? `${subject} will use ${credits} of your ${allowance} monthly credits.` : `${subject} will use ${credits} customer credits.`;
}
export function videoCostSummary(model:'google/veo-3.1-fast'|'google/veo-3.1-lite',durations:number[],stillCost:number|null=STUDIO_PRICING.stillWorkspaceCredits) {
  const clips=durations.map(seconds=>priceWorkspace(seconds*STUDIO_PRICING.rates[model]));
  const render=priceUsd(durations.reduce((n,s)=>n+s,0)/60*STUDIO_PRICING.renderUsdPerMinute);
  const stills=stillCost===null?null:priceWorkspace(stillCost*durations.length);
  const knownUsd=clips.reduce((n,c)=>n+c.usd,0)+render.usd+(stills?.usd??0);
  return {clips,render,stills,knownSubtotal:priceUsd(knownUsd),perActionCredits:clips.reduce((n,c)=>n+c.customerCredits,0)+render.customerCredits+(stills?durations.length*priceWorkspace(stillCost as number).customerCredits:0),complete:false as const};
}
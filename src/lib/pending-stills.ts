// Browser-safe record of stills being drawn, so the progress ring re-attaches after a refresh.
export type PendingStill = { requestKey: string; sceneId: string; label: string; startedAt: number };
const key = (projectId: string) => `igc-pending-stills-${projectId}`;
export function readPending(projectId: string): PendingStill[] {
  if (typeof window === 'undefined') return [];
  try { return (JSON.parse(localStorage.getItem(key(projectId)) ?? '[]') as PendingStill[]).filter(p => Date.now() - p.startedAt < 20 * 60_000); } catch { return []; }
}
export function savePending(projectId: string, p: PendingStill) { localStorage.setItem(key(projectId), JSON.stringify([...readPending(projectId).filter(x => x.requestKey !== p.requestKey), p])); }
export function clearPending(projectId: string, requestKey: string) { const left = readPending(projectId).filter(x => x.requestKey !== requestKey); if (left.length) localStorage.setItem(key(projectId), JSON.stringify(left)); else localStorage.removeItem(key(projectId)); }

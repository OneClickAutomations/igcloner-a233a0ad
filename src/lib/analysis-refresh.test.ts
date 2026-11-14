import { describe, expect, it, vi } from 'vitest';
import { startFreshAnalysis } from './analysis-refresh';

describe('fresh metrics refresh', () => {
  it('bypasses the 12-hour cache and starts a new scrape-first analysis', async () => {
    const start = vi.fn().mockResolvedValue({ ok: true, status: 'processing', analysisId: 'fresh-job', stage: 'fetching_post' });
    expect(await startFreshAnalysis(start, 'https://www.instagram.com/reel/DfNangbBYRX/')).toBe('fresh-job');
    expect(start).toHaveBeenCalledExactlyOnceWith({ data: { url: 'https://www.instagram.com/reel/DfNangbBYRX/', forceRefresh: true } });
  });
  it('surfaces a pre-charge provider error instead of treating it as a successful refresh', async () => {
    const start = vi.fn().mockResolvedValue({ ok: false, status: 'failed', error: 'No credits were taken.' });
    await expect(startFreshAnalysis(start, 'https://www.instagram.com/reel/DfNangbBYRX/')).rejects.toThrow('No credits were taken.');
  });
});
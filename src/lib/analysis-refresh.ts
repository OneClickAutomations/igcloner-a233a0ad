/** Refresh must bypass saved results and enter the ordinary scrape-first pipeline. */
export async function startFreshAnalysis(
  start: (input: { data: { url: string; forceRefresh: true } }) => Promise<any>,
  url: string,
): Promise<string> {
  const result = await start({ data: { url, forceRefresh: true } });
  if (!result.ok) throw new Error(result.error || 'Could not refresh this post.');
  if (result.status !== 'processing' || !result.analysisId) {
    throw new Error('A fresh analysis was not started. Please try again.');
  }
  return result.analysisId;
}
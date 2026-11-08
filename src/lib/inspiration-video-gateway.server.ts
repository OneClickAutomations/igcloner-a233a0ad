export type VideoJob = { id: string; status: 'queued' | 'in_progress' | 'completed' | 'failed'; progress?: number; error?: { code: string; message: string } };
export type VideoConfig = { baseURL: string; apiKey: string; model: string };
export class VideoGatewayError extends Error { constructor(public status: number, message: string) { super(message); } }
async function jobResponse(response: Response): Promise<VideoJob> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as any;
    throw new VideoGatewayError(response.status, body?.message ?? body?.error?.message ?? `Video request failed: ${response.status}`);
  }
  return response.json();
}
export async function createVideo(config: VideoConfig, request: Record<string, unknown>) {
  return jobResponse(await fetch(`${config.baseURL}/v1/videos`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' }, body: JSON.stringify({ ...request, model: config.model }) }));
}
export async function pollVideo(config: VideoConfig, id: string) {
  return jobResponse(await fetch(`${config.baseURL}/v1/videos/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${config.apiKey}` } }));
}
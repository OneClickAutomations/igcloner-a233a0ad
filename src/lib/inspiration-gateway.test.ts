import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVideo, pollVideo } from './inspiration-video-gateway.server';
const config = { baseURL:'https://ai.gateway.lovable.dev',apiKey:'test-only',model:'google/veo-3.1-lite' };
afterEach(() => vi.unstubAllGlobals());
describe('durable inspiration gateway requests', () => {
  it('creates exactly one job on a terminal provider denial without retry or model change', async () => {
    const fetcher=vi.fn().mockResolvedValue(Response.json({ message:'Provider denied access' },{status:403})); vi.stubGlobal('fetch',fetcher);
    await expect(createVideo(config,{instances:[{prompt:'one action'}],parameters:{durationSeconds:4,resolution:'720p',sampleCount:1,generateAudio:true}})).rejects.toMatchObject({status:403});
    expect(fetcher).toHaveBeenCalledTimes(1); expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe('google/veo-3.1-lite');
  });
  it('recovers an existing job by ID without another paid create after a lost tab', async () => {
    const fetcher=vi.fn().mockResolvedValue(Response.json({id:'video_saved',status:'completed'})); vi.stubGlobal('fetch',fetcher);
    expect((await pollVideo(config,'video_saved')).status).toBe('completed');
    expect(fetcher.mock.calls[0][0]).toBe('https://ai.gateway.lovable.dev/v1/videos/video_saved'); expect(fetcher.mock.calls[0][1].method).toBeUndefined();
  });
});
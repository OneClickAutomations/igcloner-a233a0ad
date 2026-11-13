import { describe, expect, it } from 'vitest';
import { cardLimit, fitCard, failureFix, deliveryStatus, videoWarnings } from './film-publish';
describe('publish copy and delivery rules',()=>{
  it('auto-trims a shared caption to X’s 280 character limit',()=>expect(fitCard('x','caption','a'.repeat(350))).toHaveLength(280));
  it('uses the 100 character YouTube title limit',()=>expect(cardLimit('youtube','title')).toBe(100));
  it('uses the 1024 character Telegram media caption',()=>expect(cardLimit('telegram','caption')).toBe(1024));
  it('uses Pinterest’s 500 character description limit',()=>expect(fitCard('pinterest','description','x'.repeat(700))).toHaveLength(500));
  it('limits shared hashtags to Threads’ one tag',()=>expect(fitCard('threads','hashtags','#one #two')).toBe('#one'));
  it('routes expired connections to reconnect',()=>expect(failureFix('TOKEN_EXPIRED','').label).toBe('Reconnect'));
  it('routes rejected content to editing',()=>expect(failureFix('MEDIA_TOO_LARGE','').label).toBe('Edit'));
  it('shows provider success as posted',()=>expect(deliveryStatus('published')).toBe('Posted'));
  it('warns with the stated Instagram duration guideline',()=>expect(videoWarnings('instagram',{duration:200,width:720,height:1280})[0]).toContain('180 seconds'));
});
import { describe, it, expect } from "vitest";
import {
  classifySourceUrl,
  stripTrackingParams,
  resolveCanonicalUrl,
  normalizeInstagramPost,
  normalizeFacebookReel,
  normalizeFacebookPost,
  verifyPostMatch,
  extractPostId,
  finalKindFromData,
  scrapeFailure,
  srtToText,
  type ClassifiedUrl,
} from "@/lib/source-ingest";

const IG_IMAGE: ClassifiedUrl = { platform: "instagram", kind: "Image", provisional: true, shareLink: false };
const IG_REEL: ClassifiedUrl = { platform: "instagram", kind: "Reel", provisional: false, shareLink: false };
const FB_POST: ClassifiedUrl = { platform: "facebook", kind: "Post", provisional: false, shareLink: false };

describe("classifySourceUrl", () => {
  it("classifies Instagram URL shapes", () => {
    expect(classifySourceUrl("https://www.instagram.com/reel/ABC123/")).toMatchObject({ platform: "instagram", kind: "Reel", provisional: false });
    expect(classifySourceUrl("https://www.instagram.com/reels/ABC123/")).toMatchObject({ kind: "Reel" });
    expect(classifySourceUrl("https://www.instagram.com/tv/ABC123/")).toMatchObject({ kind: "Reel" });
    // /p/ is a single image OR a carousel — provisional until scraped.
    expect(classifySourceUrl("https://www.instagram.com/p/ABC123/")).toMatchObject({ kind: "Image", provisional: true });
  });

  it("does not honor the fake /carousel/ path", () => {
    const c = classifySourceUrl("https://www.instagram.com/carousel/ABC123/");
    expect(c).not.toBeNull();
    expect(c!.kind).not.toBe("Carousel");
  });

  it("classifies Facebook URL shapes", () => {
    expect(classifySourceUrl("https://www.facebook.com/reel/1625323641519890/")).toMatchObject({ platform: "facebook", kind: "Reel" });
    expect(classifySourceUrl("https://www.facebook.com/watch/?v=123456")).toMatchObject({ kind: "Video" });
    expect(classifySourceUrl("https://www.facebook.com/NASA/videos/707658861091491/")).toMatchObject({ kind: "Video" });
    expect(classifySourceUrl("https://www.facebook.com/NASAOrion/posts/some-slug-707559398081561/")).toMatchObject({ kind: "Post" });
    expect(classifySourceUrl("https://www.facebook.com/permalink.php?story_fbid=123&id=456")).toMatchObject({ kind: "Post" });
    expect(classifySourceUrl("https://www.facebook.com/photo?fbid=123456")).toMatchObject({ kind: "Post" });
    expect(classifySourceUrl("https://www.facebook.com/story.php?story_fbid=123&id=456")).toMatchObject({ kind: "Post" });
  });

  it("flags share and short links for resolution", () => {
    expect(classifySourceUrl("https://www.facebook.com/share/r/AbCdEf/")).toMatchObject({ shareLink: true, platform: "facebook" });
    expect(classifySourceUrl("https://www.facebook.com/share/p/AbCdEf/")).toMatchObject({ shareLink: true });
    expect(classifySourceUrl("https://www.instagram.com/share/ABC123/")).toMatchObject({ shareLink: true, platform: "instagram" });
    expect(classifySourceUrl("https://fb.watch/AbCdEf/")).toMatchObject({ shareLink: true, kind: "Video" });
  });

  it("rejects unsupported hosts and garbage", () => {
    expect(classifySourceUrl("https://twitter.com/x")).toBeNull();
    expect(classifySourceUrl("not a url")).toBeNull();
  });
});

describe("stripTrackingParams", () => {
  it("canonicalizes the exact reported Instagram reel", () => {
    expect(stripTrackingParams("https://www.instagram.com/reel/DfNangbBYRX/?srtk=M2gzdDdkcml2NWRh")).toBe("https://www.instagram.com/reel/DfNangbBYRX/");
  });
  it.each(["reel", "reels", "tv", "p"])("normalizes %s with every tracking variant", (path) => {
    expect(stripTrackingParams(`https://instagram.com/${path}/DfNangbBYRX?igsh=a&srtk=b&utm_source=c&img_index=2#x`)).toBe(`https://www.instagram.com/${path === "p" ? "p" : "reel"}/DfNangbBYRX/`);
  });
  it("normalizes Facebook hosts and retains post identifiers", () => {
    expect(stripTrackingParams("https://m.facebook.com/watch?v=123&srtk=x")).toBe("https://www.facebook.com/watch/?v=123");
    expect(stripTrackingParams("https://m.facebook.com/story.php?story_fbid=123&id=456&fbclid=x")).toBe("https://www.facebook.com/story.php?story_fbid=123&id=456");
  });
  it("removes tracking params but keeps identifying ones", () => {
    const out = stripTrackingParams(
      "https://www.facebook.com/watch/?v=123&utm_source=share&fbclid=abc&igsh=xyz&mibextid=q1",
    );
    expect(out).toContain("v=123");
    expect(out).not.toMatch(/utm_|fbclid|igsh|mibextid/);
  });
});

describe("resolveCanonicalUrl", () => {
  const redirect = (location: string) => async () => ({ status: 302, headers: { get: (n: string) => (n === "location" ? location : null) } });
  const ok = async () => ({ status: 200, headers: { get: () => null } });

  it("follows a short link to the canonical URL and strips tracking", async () => {
    const fetchImpl = async (url: string) => {
      if (url === "https://fb.watch/AbCdEf/") {
        return { status: 302, headers: { get: (n: string) => (n === "location" ? "https://www.facebook.com/reel/1625323641519890/?mibextid=zz&fbclid=q" : null) } };
      }
      return { status: 200, headers: { get: () => null } };
    };
    const res = await resolveCanonicalUrl("https://fb.watch/AbCdEf/", fetchImpl as any);
    expect(res.hops).toBe(1);
    expect(res.canonicalUrl).toBe("https://www.facebook.com/reel/1625323641519890/");
    expect(res.originalUrl).toBe("https://fb.watch/AbCdEf/");
  });

  it("stops at max hops and keeps the best URL", async () => {
    const loop = async (url: string) => ({ status: 301, headers: { get: (n: string) => (n === "location" ? url + "x" : null) } });
    const res = await resolveCanonicalUrl("https://fb.watch/a", loop as any, 5);
    expect(res.hops).toBe(5);
  });

  it("returns the input when there is no redirect", async () => {
    const res = await resolveCanonicalUrl("https://www.instagram.com/p/ABC/", ok as any);
    expect(res.hops).toBe(0);
    expect(res.canonicalUrl).toBe("https://www.instagram.com/p/ABC/");
  });
  it("never fetches a direct post or follows its login redirect", async () => {
    let calls = 0;
    const res = await resolveCanonicalUrl("https://www.instagram.com/reel/DfNangbBYRX/?srtk=x", async () => { calls++; return { status: 302, headers: { get: () => "https://www.instagram.com/accounts/login/" } }; });
    expect(calls).toBe(0);
    expect(res.canonicalUrl).toBe("https://www.instagram.com/reel/DfNangbBYRX/");
  });

  it("survives fetch failures and keeps the current URL", async () => {
    const failing = async () => { throw new Error("network down"); };
    const res = await resolveCanonicalUrl("https://fb.watch/AbCdEf/", failing as any);
    expect(res.canonicalUrl).toBe("https://fb.watch/AbCdEf/");
  });
});

describe("normalizeInstagramPost", () => {
  it("normalizes a single image post", () => {
    const post = normalizeInstagramPost({
      type: "Image",
      shortCode: "IMG1",
      displayUrl: "https://cdn.example.com/img.jpg",
      caption: "Hello #space @nasa",
      ownerUsername: "nasa",
      likesCount: 100,
      commentsCount: 5,
      dimensionsWidth: 1080,
      dimensionsHeight: 1350,
    }, "https://www.instagram.com/p/IMG1/", IG_IMAGE);
    expect(post.type).toBe("Image");
    expect(post.mediaItems).toHaveLength(1);
    expect(post.mediaItems[0]).toMatchObject({ kind: "image", width: 1080, height: 1350 });
    expect(post.hashtags).toEqual(["space"]);
    expect(post.mentions).toEqual(["nasa"]);
    expect(post.scrapeCoverage.slidesExpected).toBe(1);
    expect(post.scrapeCoverage.videoCaptured).toBe(false);
  });

  it("captures every carousel slide and upgrades the type to Carousel", () => {
    const childPosts = Array.from({ length: 7 }, (_, i) => ({
      type: "Image",
      displayUrl: `https://cdn.example.com/slide${i}.jpg`,
    }));
    const post = normalizeInstagramPost({
      type: "Sidecar",
      shortCode: "CAR1",
      childPosts,
      caption: "Swipe",
      ownerUsername: "nasa",
    }, "https://www.instagram.com/p/CAR1/", IG_IMAGE);
    expect(post.type).toBe("Carousel");
    expect(post.mediaItems).toHaveLength(7);
    expect(post.scrapeCoverage.slidesExpected).toBe(7);
    expect(post.scrapeCoverage.slidesCaptured).toBe(7);
  });

  it("caps carousels at 20 slides with a note", () => {
    const childPosts = Array.from({ length: 25 }, (_, i) => ({ type: "Image", displayUrl: `https://cdn.example.com/s${i}.jpg` }));
    const post = normalizeInstagramPost({ type: "Sidecar", childPosts, caption: "", ownerUsername: "x" }, "https://www.instagram.com/p/BIG1/", IG_IMAGE);
    expect(post.mediaItems).toHaveLength(20);
    expect(post.scrapeCoverage.slidesExpected).toBe(25);
    expect(post.scrapeCoverage.notes[0]).toMatch(/25 slides/);
  });

  it("normalizes a reel with video, duration, and audio info", () => {
    const post = normalizeInstagramPost({
      type: "Video",
      productType: "clips",
      shortCode: "REEL1",
      videoUrl: "https://cdn.example.com/vid.mp4",
      displayUrl: "https://cdn.example.com/thumb.jpg",
      videoDuration: 32.5,
      musicInfo: { song_name: "Trans-Lunar Coast", artist_name: "Everyday Astronaut", uses_original_audio: true },
      caption: "Watch this",
      ownerUsername: "nasa",
    }, "https://www.instagram.com/reel/REEL1/", IG_REEL);
    expect(post.type).toBe("Reel");
    expect(post.primaryVideoUrl).toBe("https://cdn.example.com/vid.mp4");
    expect(post.durationSec).toBe(32.5);
    expect(post.audio).toEqual({ title: "Trans-Lunar Coast", artist: "Everyday Astronaut", original: true });
    expect(post.scrapeCoverage.videoCaptured).toBe(true);
    expect(post.scrapeCoverage.thumbnailOnly).toBe(false);
  });

  it("flags thumbnail-only reels honestly", () => {
    const post = normalizeInstagramPost({
      type: "Video",
      productType: "clips",
      shortCode: "REEL2",
      displayUrl: "https://cdn.example.com/thumb.jpg",
      caption: "",
      ownerUsername: "nasa",
    }, "https://www.instagram.com/reel/REEL2/", IG_REEL);
    expect(post.scrapeCoverage.thumbnailOnly).toBe(true);
    expect(post.scrapeCoverage.notes[0]).toMatch(/thumbnail only/i);
  });
});

// Trimmed from the real live run of apify~facebook-reels-scraper build 0.0.323.
const FB_REEL_FIXTURE = {
  facebookUrl: "https://www.facebook.com/reel/1625323641519890/",
  text: "Did NASA really lose the original tapes? #moonlanding #NASA",
  time: "2025-04-18T21:03:00.000Z",
  play_count: 7924,
  video: { id: "1625323641519890", first_frame_thumbnail: "https://fbcdn.example.com/frame.jpg" },
  playback_video: {
    width: 1080,
    height: 1920,
    length_in_second: 170.88,
    captions_url: "https://fbcdn.example.com/captions.srt",
    videoDeliveryLegacyFields: {
      browser_native_sd_url: "https://video.example.com/sd.mp4",
      browser_native_hd_url: "https://video.example.com/hd.mp4",
    },
  },
  video_owner: { name: "Everyday Astronaut", is_verified: true, url: "https://www.facebook.com/everydayastronaut" },
  track_title: "Everyday Astronaut · Trans-Lunar Coast",
  is_original_audio_on_facebook: true,
};

describe("normalizeFacebookReel", () => {
  it("maps the verified live payload into the source package", () => {
    const post = normalizeFacebookReel(FB_REEL_FIXTURE, "https://www.facebook.com/reel/1625323641519890/");
    expect(post.type).toBe("Reel");
    expect(post.primaryVideoUrl).toBe("https://video.example.com/hd.mp4");
    expect(post.durationSec).toBe(170.88);
    expect(post.videoPlayCount).toBe(7924);
    expect(post.audio).toEqual({ title: "Everyday Astronaut · Trans-Lunar Coast", original: true });
    expect(post.scrapeCoverage.videoCaptured).toBe(true);
    expect(post.scrapeCoverage.transcriptCaptured).toBe(true);
    expect(post.hashtags).toEqual(["moonlanding", "NASA"]);
    expect(post.owner?.username).toBe("Everyday Astronaut");
  });

  it("falls back to thumbnail with an honest note when no video URL exists", () => {
    const noVideo = { ...FB_REEL_FIXTURE, playback_video: { thumbnailImage: { uri: "https://fbcdn.example.com/t.jpg" } } };
    const post = normalizeFacebookReel(noVideo, "https://www.facebook.com/reel/1625323641519890/");
    expect(post.scrapeCoverage.thumbnailOnly).toBe(true);
    expect(post.mediaItems[0].kind).toBe("image");
  });
});

describe("normalizeFacebookPost", () => {
  it("captures every media item and the transcript", () => {
    const post = normalizeFacebookPost({
      text: "Propulsion tubing produced by the team #nasa",
      media: [
        { photo_image: { uri: "https://fbcdn.example.com/p1.jpg" } },
        { photo_image: { uri: "https://fbcdn.example.com/p2.jpg" } },
        { video_url: "https://video.example.com/clip.mp4" },
      ],
      user: { name: "NASA's Orion Spacecraft" },
      likes: 1200,
      comments: 45,
      captionText: "spoken words here",
    }, "https://www.facebook.com/NASAOrion/posts/x-707559398081561/", FB_POST);
    expect(post.mediaItems).toHaveLength(3);
    expect(post.mediaItems[2].kind).toBe("video");
    expect(post.transcript).toBe("spoken words here");
    expect(post.scrapeCoverage.transcriptCaptured).toBe(true);
    expect(post.type).toBe("Carousel");
  });

  it("handles a text-only post", () => {
    const post = normalizeFacebookPost({ text: "Just words", user: { name: "Page" } }, "https://www.facebook.com/x/posts/123/", FB_POST);
    expect(post.mediaItems).toHaveLength(0);
    expect(post.type).toBe("Post");
  });
});

describe("verifyPostMatch", () => {
  it("accepts when the scraped id matches the requested URL", () => {
    expect(verifyPostMatch({ shortCode: "ABC123" }, "https://www.instagram.com/p/ABC123/")).toBe(true);
    expect(verifyPostMatch(FB_REEL_FIXTURE, "https://www.facebook.com/reel/1625323641519890/")).toBe(true);
  });

  it("rejects a wrong post", () => {
    expect(verifyPostMatch({ shortCode: "DIFFERENT" }, "https://www.instagram.com/p/ABC123/")).toBe(false);
    expect(verifyPostMatch({ video: { id: "999" }, facebookUrl: "https://www.facebook.com/reel/999/" }, "https://www.facebook.com/reel/1625323641519890/")).toBe(false);
  });

  it("accepts when the URL carries no extractable id", () => {
    expect(verifyPostMatch({ shortCode: "X" }, "https://www.instagram.com/explore/")).toBe(true);
  });
});

describe("extractPostId", () => {
  it("extracts ids from every supported shape", () => {
    expect(extractPostId("https://www.instagram.com/p/ABC_123/")).toBe("ABC_123");
    expect(extractPostId("https://www.instagram.com/reel/ABC123/")).toBe("ABC123");
    expect(extractPostId("https://www.facebook.com/reel/1625323641519890/")).toBe("1625323641519890");
    expect(extractPostId("https://www.facebook.com/NASA/videos/nasa-trailer/707658861091491/")).toBe("707658861091491");
    expect(extractPostId("https://www.facebook.com/watch/?v=626235779706881")).toBe("626235779706881");
    expect(extractPostId("https://www.facebook.com/permalink.php?story_fbid=123&id=456")).toBe("123");
    expect(extractPostId("https://www.facebook.com/NASAOrion/posts/slug-707559398081561/")).toBe("707559398081561");
  });
});

describe("finalKindFromData", () => {
  it("decides image vs carousel from scraped data, not the URL", () => {
    expect(finalKindFromData(IG_IMAGE, { mediaItems: [{ index: 0, kind: "image", url: "x" }] })).toBe("Image");
    expect(finalKindFromData(IG_IMAGE, { mediaItems: [
      { index: 0, kind: "image", url: "x" },
      { index: 1, kind: "image", url: "y" },
    ] })).toBe("Carousel");
    expect(finalKindFromData(IG_IMAGE, { mediaItems: [{ index: 0, kind: "video", url: "x" }] })).toBe("Reel");
  });
});

describe("scrapeFailure", () => {
  it("identifies invalid credentials and provides recovery", () => {
    const error = scrapeFailure({ status: 401, platform: "instagram" });
    expect(error.code).toBe("credentials");
    expect(error.message).toContain("Settings → API Keys");
  });
  it("maps failures to specific human messages", () => {
    expect(scrapeFailure({ status: 504, platform: "instagram" }).code).toBe("timeout");
    expect(scrapeFailure({ itemError: "private_content", platform: "instagram" }).code).toBe("private");
    expect(scrapeFailure({ itemError: "no_items", itemErrorDescription: "Empty or private data", platform: "facebook" }).code).toBe("deleted");
    expect(scrapeFailure({ itemErrorDescription: "region blocked", platform: "facebook" }).code).toBe("region_blocked");
    expect(scrapeFailure({ status: 500, platform: "instagram" }).code).toBe("upstream");
    expect(scrapeFailure({ platform: "instagram" }).code).toBe("empty");
    // No generic "No data returned" anywhere.
    for (const f of [
      scrapeFailure({ platform: "instagram" }),
      scrapeFailure({ status: 500, platform: "facebook" }),
    ]) {
      expect(f.message).not.toBe("No data returned");
    }
  });
});

describe("srtToText", () => {
  it("strips cue numbers, timestamps, and tags", () => {
    const srt = `1\n00:00:01,000 --> 00:00:03,000\nDid NASA really lose\n\n2\n00:00:03,500 --> 00:00:05,000\n<i>the original tapes?</i>\n`;
    expect(srtToText(srt)).toBe("Did NASA really lose the original tapes?");
  });
});

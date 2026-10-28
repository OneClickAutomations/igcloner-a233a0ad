import { z } from "zod";

export const IDEA_CATEGORIES = ["Steal the Frame", "Exploit the Gaps", "Amplify What Works", "Original Authority", "Viral Formats"] as const;
const metric = (v: unknown): number | null => v == null || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v);
const round = (n: number) => Math.round(n * 100) / 100;
export function normalizeIntelPost(p: any) {
  return {
    type: p.type ?? p.productType ?? "Unknown", timestamp: p.timestamp ?? null,
    caption: String(p.caption ?? p.text ?? ""), likesCount: metric(p.likesCount), commentsCount: metric(p.commentsCount),
    videoViewCount: metric(p.videoViewCount), videoPlayCount: metric(p.videoPlayCount),
    hashtags: Array.isArray(p.hashtags) ? p.hashtags : [], mentions: Array.isArray(p.mentions) ? p.mentions : [],
    isSponsored: p.isSponsored ?? null, locationName: p.locationName ?? null,
    musicInfo: p.musicInfo ? { songName: p.musicInfo.songName ?? p.musicInfo.song_name, artistName: p.musicInfo.artistName ?? p.musicInfo.artist_name, isTrending: p.musicInfo.isTrending ?? null } : null,
    carouselSlides: p.type === "Sidecar" ? p.images?.length ?? null : null,
    url: p.url ?? null, shortCode: p.shortCode ?? null,
    displayUrl: p.displayUrl ?? p.thumbnailUrl ?? null,
  };
}
export function calculateIntelMetrics(posts: any[], followers: unknown) {
  const n = posts.length;
  const likes = posts.map(p => metric(p.likesCount));
  const comments = posts.map(p => metric(p.commentsCount));
  const complete = n > 0 && likes.every(v => v != null) && comments.every(v => v != null);
  const totalLikes = n && likes.every(v => v != null) ? likes.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
  const totalComments = n && comments.every(v => v != null) ? comments.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
  const followerCount = metric(followers);
  const ranked = posts.map((p, index) => ({ ...p, postIndex: index, engagement: metric(p.likesCount) != null && metric(p.commentsCount) != null ? Number(p.likesCount) + Number(p.commentsCount) : null }))
    .filter(p => p.engagement != null).sort((a, b) => Number(b.engagement) - Number(a.engagement));
  const avg = complete ? ((totalLikes ?? 0) + (totalComments ?? 0)) / n : null;
  const reels = posts.filter(p => /video|reel/i.test(p.type));
  const views = reels.map(p => metric(p.videoViewCount ?? p.videoPlayCount)).filter((v): v is number => v != null);
  const highest = (field: string) => {
    const p = [...posts].filter(p => metric(p[field]) != null).sort((a,b) => Number(b[field]) - Number(a[field]))[0];
    return p ? { likes: metric(p.likesCount), comments: metric(p.commentsCount), captionExcerpt: p.caption, postType: p.type, url: p.url } : null;
  };
  const topTimes = ranked.slice(0, 5).filter(p => p.timestamp && Number.isFinite(new Date(p.timestamp).getTime())).map(p => {
    const d = new Date(p.timestamp);
    return { url: p.url, engagement: p.engagement, timestamp: d.toISOString(), day: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }), time: `${d.toISOString().slice(11,16)} UTC` };
  });
  const image = posts.filter(p => /^image$/i.test(p.type)).length;
  const carousel = posts.filter(p => /sidecar|carousel/i.test(p.type)).length;
  const formats = [{ name: "Image", count: image }, { name: "Reel", count: reels.length }, { name: "Carousel", count: carousel }].sort((a,b) => b.count-a.count);
  return {
    performanceMetrics: {
      postsAnalyzed: n, engagementRate: complete && followerCount && avg != null ? `${(avg / followerCount * 100).toFixed(2)}%` : "Not available",
      engagementRateFormula: "((totalLikes + totalComments) / postsAnalyzed) / followerCount * 100",
      engagementRateInputs: { totalLikes, totalComments, postsAnalyzed: n, followerCount },
      avgLikesPerPost: totalLikes == null ? null : round(totalLikes/n), avgCommentsPerPost: totalComments == null ? null : round(totalComments/n),
      avgViewsPerReel: views.length ? round(views.reduce((s,v) => s+v,0)/views.length) : null,
      totalLikesAnalyzed: totalLikes, totalCommentsAnalyzed: totalComments,
      highestLikedPost: highest("likesCount"), highestCommentedPost: highest("commentsCount"),
      viralPostCount: avg == null ? null : avg > 0 ? ranked.filter(p => Number(p.engagement) >= 3*avg).length : 0,
      viralThreshold: "posts with 3x or more avg engagement", engagementBenchmark: "Not available — no verified niche benchmark supplied",
    },
    contentFormatDistribution: { imagePercent: n ? round(image/n*100) : null, reelPercent: n ? round(reels.length/n*100) : null, carouselPercent: n ? round(carousel/n*100) : null, unknownPercent: n ? round((n-image-reels.length-carousel)/n*100) : null, dominantFormat: n ? formats[0]?.name : "Not available" },
    topPosts: ranked.slice(0,3), topPostTimestamps: topTimes,
    rawDataSummary: { postsWithZeroLikes: n ? likes.filter(v => v === 0).length : null, postsWithZeroComments: n ? comments.filter(v => v === 0).length : null, dataQualityNote: !n ? "No posts scraped" : !complete ? "Some likes or comments are unavailable; aggregate engagement cannot be calculated." : "Likes and comments available for all analyzed posts. Views, saves, shares, visual evidence, and niche benchmarks may be unavailable." },
  };
}

export function groundIntelReport(dna: any, signals: any) {
  const posts: any[] = signals.posts ?? [];
  const metrics = calculateIntelMetrics(posts, signals.profile?.followersCount);
  const used = new Set<number>();
  const pillars = (Array.isArray(dna.contentPillars) ? dna.contentPillars : []).map((p: any) => {
    const indices: number[] = (Array.isArray(p.postIndices) ? p.postIndices : []).filter((i: number) => Number.isInteger(i) && i >= 0 && i < posts.length && !used.has(i));
    indices.forEach(i => used.add(i));
    const best = indices.map(i => posts[i]).sort((a,b) => (Number(b.likesCount)+Number(b.commentsCount))-(Number(a.likesCount)+Number(a.commentsCount)))[0];
    return { ...p, name: p.name ?? p.pillarName, postIndices: indices, postCount: indices.length, share: posts.length ? round(indices.length/posts.length*100) : 0, percentage: posts.length ? round(indices.length/posts.length*100) : 0, topPerformingExample: best?.caption ?? "Not available" };
  }).filter((p: any) => p.postCount > 0);
  const unclassified = posts.map((_,i) => i).filter(i => !used.has(i));
  if (unclassified.length) pillars.push({ name: "Unclassified caption themes", description: "Posts not assigned a supported theme by the analyst.", postIndices: unclassified, postCount: unclassified.length, share: round(unclassified.length/posts.length*100), percentage: round(unclassified.length/posts.length*100), topPerformingExample: posts[unclassified[0] ?? 0]?.caption ?? "Not available" });
  const provenHooks = (dna.hookAnalysis?.provenHooks ?? []).flatMap((h: any) => {
    const p = posts[h.postIndex];
    const actual = String(p?.caption ?? "").split(/\n/).find(line => line.trim())?.trim();
    return actual ? [{ ...h, actualOpeningLine: actual, engagementOnThisPost: metric(p.likesCount) != null && metric(p.commentsCount) != null ? Number(p.likesCount)+Number(p.commentsCount) : null, sourceUrl: p.url }] : [];
  });
  const dates = posts.map(p => new Date(p.timestamp).getTime()).filter(Number.isFinite).sort((a,b)=>a-b);
  const frequency = dates.length > 1 && dates[dates.length-1] !== dates[0] ? `${round((dates.length-1)/((Number(dates[dates.length-1])-Number(dates[0]))/86400000)*7)} posts per week` : "Not available";
  return { ...dna, ...metrics, profileSummary: { ...dna.profileSummary, ...signals.profile, username: signals.profile?.username ?? signals.subject, displayName: signals.profile?.fullName ?? "Not available", bio: signals.profile?.biography ?? "Not available", followerCount: metric(signals.profile?.followersCount), followingCount: metric(signals.profile?.followingCount ?? signals.profile?.followsCount), totalPosts: metric(signals.profile?.postsCount), postsAnalyzed: posts.length },
    contentPillars: posts.length ? pillars : [], hookAnalysis: { ...dna.hookAnalysis, provenHooks }, commonHooks: provenHooks.map((h:any) => ({ pattern:h.hookType, example:h.actualOpeningLine })),
    postingStrategy: { ...dna.postingStrategy, frequency, bestPerformingDays: [...new Set(metrics.topPostTimestamps.map(t => t.day))], bestPerformingTimes: metrics.topPostTimestamps.map(t => `${t.day} ${t.time}`), evidence: metrics.topPostTimestamps },
    postingFrequency: frequency, postingTimes: metrics.topPostTimestamps.map(t => `${t.day} ${t.time}`).join(" · ") || "Not available", mostSaved: "Not available", mostShared: "Not available",
    reportFlags: { limitedData: posts.length === 0, limitedDataReason: posts.length ? null : "This account's posts could not be scraped. Profile intelligence is based on bio and public profile data only." },
  };
}

const IdeaSchema = z.object({
  idea_number: z.number().int().min(1).max(50), category: z.enum(IDEA_CATEGORIES), title: z.string().min(5), format: z.enum(["Reel","Carousel","Image"]),
  hook: z.string().min(15), description: z.string().min(20), why_it_works: z.string().min(30), caption_opener: z.string().min(20), cta: z.string().min(5),
  viral_mechanism: z.enum(["save-worthy","share-worthy","comment-triggering","scroll-stopping"]), production_difficulty: z.enum(["easy (30 min)","medium (2 hours)","hard (half day)"]),
  virality_score: z.number().min(0).max(100), source_post_index: z.number().int().nullable(), hashtags: z.array(z.string()).default([]),
}).passthrough();
export function validateIntelIdeas(raw: unknown, posts: any[]) {
  const ideas = z.array(IdeaSchema).length(50).parse(raw);
  if (new Set(ideas.map(i => i.idea_number)).size !== 50) throw new Error("Ideas must have unique numbers 1–50.");
  if (new Set(ideas.map(i => i.hook.toLowerCase().trim())).size !== 50) throw new Error("Duplicate hooks were returned. Existing ideas have been preserved.");
  for (const [index, category] of IDEA_CATEGORIES.entries()) {
    if (ideas.filter(i => i.category === category).length !== 10) throw new Error(`Expected ten ${category} ideas.`);
    if (ideas.some(i => i.category === category && (i.idea_number <= index*10 || i.idea_number > (index+1)*10))) throw new Error("Idea numbering does not match strategy categories.");
  }
  for (const i of ideas) {
    if (posts.length && (i.category === "Steal the Frame" || i.category === "Amplify What Works") && (i.source_post_index == null || !posts[i.source_post_index])) throw new Error("Proven-format ideas must reference a real source post.");
    if (!posts.length && i.source_post_index != null) throw new Error("Profile-only ideas cannot claim scraped post evidence.");
  }
  return ideas.sort((a,b) => a.idea_number-b.idea_number);
}
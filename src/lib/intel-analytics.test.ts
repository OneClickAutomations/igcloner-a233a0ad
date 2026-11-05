import { describe, it, expect } from "vitest";
import { calculateIntelMetrics, groundIntelReport, validateIntelIdeas, IDEA_CATEGORIES, sampleConfidence, shareFor, deriveHashtagQueries, dedupePostsByShortCode, isWithinReuseWindow, computeIdeaConfidence, CONFIDENCE_WEIGHTS, UNEVIDENCED_CONFIDENCE_CAP, toPromptPost, IDEAS_PER_BATCH, IDEAS_PER_CATEGORY, MAX_IDEA_BATCHES, MAX_IDEAS_PER_REPORT } from "./intel-analytics";
const posts = Array.from({ length: 12 }, (_,i) => ({ type: i < 6 ? "Image" : i < 9 ? "Video" : "Sidecar", caption: `Actual caption ${i}\nDetails`, likesCount: i+1, commentsCount: 1, timestamp: `2026-10-${String(i+1).padStart(2,"0")}T12:00:00Z`, url: `https://www.instagram.com/p/post${i}/` }));
describe("Intel evidence rules", () => {
  it("calculates engagement using all 12 scraped posts and follower count", () => {
    const m = calculateIntelMetrics(posts, 1000).performanceMetrics;
    expect(m.engagementRate).toBe("0.75%");
    expect(m.engagementRateInputs).toEqual({ totalLikes:78,totalComments:12,postsAnalyzed:12,followerCount:1000 });
    expect(m.avgLikesPerPost).toBe(6.5);
  });
  it("calculates pillar shares from post assignments rather than model zeros", () => {
    const report = groundIntelReport({ contentPillars:[{ name:"A",share:0,postIndices:[0,1,2,3,4,5] },{ name:"B",share:0,postIndices:[6,7,8] },{ name:"C",share:0,postIndices:[9,10,11] }] },{ posts,profile:{followersCount:1000} });
    expect(report.contentPillars.map((p:any)=>p.share)).toEqual([50,25,25]);
  });
  it("counts format percentages from actual post types", () => {
    expect(calculateIntelMetrics(posts,1000).contentFormatDistribution).toMatchObject({ imagePercent:50,reelPercent:25,carouselPercent:25 });
  });
  it("ranks the real top three posts by likes plus comments", () => {
    expect(calculateIntelMetrics(posts,1000).topPosts.map(p=>p.postIndex)).toEqual([11,10,9]);
  });
  it("derives actual UTC times from the top five posts", () => {
    const times=calculateIntelMetrics(posts,1000).topPostTimestamps;
    expect(times).toHaveLength(5);expect(times[0]).toMatchObject({ timestamp:"2026-10-12T12:00:00.000Z",day:"Monday",time:"12:00 UTC" });
  });
  it("replaces invented hooks with the referenced caption opening", () => {
    const report=groundIntelReport({ hookAnalysis:{provenHooks:[{postIndex:11,actualOpeningLine:"Invented"}]} },{posts,profile:{followersCount:1000}});
    expect(report.hookAnalysis.provenHooks[0].actualOpeningLine).toBe("Actual caption 11");
  });
  it("zero posts means limited data, no pillars, and unavailable metrics", () => {
    const r=groundIntelReport({contentPillars:[{name:"Fake",share:0}],hookAnalysis:{provenHooks:[]}}, {posts:[],profile:{}});
    expect(r.reportFlags.limitedData).toBe(true);expect(r.contentPillars).toEqual([]);expect(r.performanceMetrics.engagementRate).toBe("Not available");expect(r.performanceMetrics.avgLikesPerPost).toBeNull();
  });
  it("does not convert missing or hidden likes into genuine zeros", () => {
    expect(calculateIntelMetrics([{...posts[0],likesCount:-1}],1000).performanceMetrics.engagementRate).toBe("Not available");
    expect(calculateIntelMetrics([{...posts[0],likesCount:0,commentsCount:0}],1000).performanceMetrics.engagementRate).toBe("0.00%");
  });
  it("preserves pillars and hooks of reports stored before evidence-grounding", () => {
    const legacy = groundIntelReport({
      contentPillars:[{name:"Tutorials",share:40},{name:"Behind the scenes",share:60}],
      hookAnalysis:{provenHooks:[{hookType:"Question",actualOpeningLine:"Want more reach?"}]},
      commonHooks:[{pattern:"Question",example:"Want more reach?"}],
    },{posts,profile:{followersCount:1000}});
    expect(legacy.contentPillars.map((p:any)=>p.name)).toEqual(["Tutorials","Behind the scenes"]);
    expect(legacy.contentPillars.some((p:any)=>p.name==="Unclassified caption themes")).toBe(false);
    expect(legacy.hookAnalysis.provenHooks).toHaveLength(1);
    expect(legacy.commonHooks).toEqual([{pattern:"Question",example:"Want more reach?"}]);
  });
});
const makeIdeas = (offset = 0) => Array.from({length:IDEAS_PER_BATCH},(_,i)=>({idea_number:offset+i+1,category:IDEA_CATEGORIES[Math.floor(i/IDEAS_PER_CATEGORY)], title:`Specific idea ${offset+i}`,format:"Reel",hook:`A completely unique ready-to-post hook ${offset+i}`,description:"A specific concept grounded in this audience.",why_it_works:"Uses the actual caption and observed source engagement.",caption_opener:"Specific caption opening the creator can use.",cta:"Save this example",viral_mechanism:"save-worthy",production_difficulty:"easy (30 min)",virality_score:87,source_post_index:i%12}));
const ideas = makeIdeas();
it("requires exactly 25 unique ideas, five per category",()=>{
  expect(validateIntelIdeas(ideas,posts)).toHaveLength(25);
  expect(()=>validateIntelIdeas(ideas.slice(0,24),posts)).toThrow();
  expect(()=>validateIntelIdeas(ideas.map((v,i)=>i===5?{...v,category:"Steal the Frame"}:v),posts)).toThrow();
});
it("enforces category numbering ranges 1-5 … 21-25",()=>{
  expect(()=>validateIntelIdeas(ideas.map((v,i)=>i===0?{...v,idea_number:6}:v),posts)).toThrow();
  expect(()=>validateIntelIdeas(ideas.map((v,i)=>i===24?{...v,idea_number:25}:v),posts)).not.toThrow();
});
it("rejects duplicate hooks within a batch, case-insensitive trimmed",()=>{
  expect(()=>validateIntelIdeas(ideas.map((v,i)=>i===1?{...v,hook:`  ${ideas[0].hook.toUpperCase()} `}:v),posts)).toThrow();
});
it("append mode numbers from the offset and applies category ranges relative to it",()=>{
  const batch2 = makeIdeas(25);
  expect(validateIntelIdeas(batch2,posts,{offset:25,existingHooks:ideas.map(i=>i.hook)})).toHaveLength(25);
  expect(()=>validateIntelIdeas(makeIdeas(0),posts,{offset:25})).toThrow();
});
it("rejects a hook that duplicates one already on the report",()=>{
  const batch2 = makeIdeas(25).map((v,i)=>i===0?{...v,hook:ideas[3].hook}:v);
  expect(()=>validateIntelIdeas(batch2,posts,{offset:25,existingHooks:ideas.map(i=>i.hook)})).toThrow();
});
it("caps a report at 4 batches (100 ideas)",()=>{
  expect(MAX_IDEAS_PER_REPORT).toBe(IDEAS_PER_BATCH*MAX_IDEA_BATCHES);
  expect(()=>validateIntelIdeas(makeIdeas(100),posts,{offset:100})).toThrow(/maximum of 100/);
  expect(()=>validateIntelIdeas(makeIdeas(75),posts,{offset:75})).not.toThrow();
});
it("requires real source evidence for cloned and amplified formulas",()=>{
  expect(()=>validateIntelIdeas(ideas.map((v,i)=>i===0?{...v,source_post_index:99}:v),posts)).toThrow();
});

describe("sampleConfidence thresholds", () => {
  it("maps every boundary to the right word", () => {
    expect(sampleConfidence(0)).toBe("none");
    expect(sampleConfidence(1)).toBe("very low");
    expect(sampleConfidence(7)).toBe("very low");
    expect(sampleConfidence(8)).toBe("low");
    expect(sampleConfidence(19)).toBe("low");
    expect(sampleConfidence(20)).toBe("moderate");
    expect(sampleConfidence(39)).toBe("moderate");
    expect(sampleConfidence(40)).toBe("high");
    expect(sampleConfidence(120)).toBe("high");
  });
});

describe("shareFor precision by sample size", () => {
  it("returns null shares below 8 posts — a 1-in-5 post is not 20.00% of a strategy", () => {
    expect(shareFor(1, 5)).toBeNull();
    expect(shareFor(4, 5)).toBeNull();
  });
  it("rounds to whole integers for n of 12 and 29", () => {
    expect(shareFor(1, 12)).toBe(8);      // 8.33… → 8, not 8.33
    expect(shareFor(7, 29)).toBe(24);     // 24.13… → 24
  });
  it("keeps two decimals at n of 30 and above", () => {
    expect(shareFor(1, 30)).toBe(3.33);
    expect(shareFor(7, 60)).toBe(11.67);
  });
  it("flows into format distribution and pillar shares", () => {
    const five = posts.slice(0, 5);
    const m5 = calculateIntelMetrics(five, 1000).contentFormatDistribution;
    expect(m5.imagePercent).toBeNull();
    const twelve = calculateIntelMetrics(posts, 1000).contentFormatDistribution;
    expect(twelve.imagePercent).toBe(50);
    const grounded = groundIntelReport({ contentPillars: [{ name: "A", postIndices: [0] }] }, { posts, profile: {} });
    expect(grounded.contentPillars[0].share).toBe(8);
  });
});

describe("deriveHashtagQueries", () => {
  it("keeps the full de-spaced term plus meaningful words, capped at 3", () => {
    expect(deriveHashtagQueries("fitness coaching")).toEqual(["fitnesscoaching", "fitness", "coaching"]);
  });
  it("drops stopwords and short words", () => {
    expect(deriveHashtagQueries("the best home workouts")).toEqual(["thebesthomeworkouts", "home", "workouts"]);
  });
  it("returns a single tag for one-word subjects and dedupes repeated words", () => {
    expect(deriveHashtagQueries("SaaS")).toEqual(["saas"]);
    expect(deriveHashtagQueries("home workout home")).toEqual(["homeworkouthome", "home", "workout"]);
  });
});

describe("dedupePostsByShortCode", () => {
  it("removes overlap by shortCode and falls back to url", () => {
    const a = { shortCode: "ABC", caption: "one" };
    const b = { shortCode: "ABC", caption: "one duplicate" };
    const c = { url: "https://x/p/1", caption: "two" };
    const d = { url: "https://x/p/1", caption: "two duplicate" };
    const e = { caption: "three", timestamp: "2026-01-01" };
    expect(dedupePostsByShortCode([a, b, c, d, e])).toEqual([a, c, e]);
  });
});

describe("isWithinReuseWindow", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  it("accepts scrapes younger than 12 hours and rejects older ones", () => {
    expect(isWithinReuseWindow("2026-11-05T00:00:01Z", now)).toBe(true);
    expect(isWithinReuseWindow("2026-11-05T00:00:00Z", now)).toBe(false); // exactly 12h is stale
    expect(isWithinReuseWindow("2026-11-04T23:59:59Z", now)).toBe(false);
  });
  it("rejects invalid or future timestamps", () => {
    expect(isWithinReuseWindow("not-a-date", now)).toBe(false);
    expect(isWithinReuseWindow("2026-11-05T13:00:00Z", now)).toBe(false);
  });
});

describe("computeIdeaConfidence", () => {
  // 20 posts averaging 100 engagement; post 0 is viral (3x+), post 1 is average.
  const samplePosts = [
    { caption: "Stop doing this one thing\nMore detail", likesCount: 400, commentsCount: 50 },
    { caption: "A normal post", likesCount: 90, commentsCount: 10 },
    ...Array.from({ length: 18 }, () => ({ caption: " filler", likesCount: 60, commentsCount: 10 })),
  ];
  it("floors when there is no evidence and the sample is tiny", () => {
    const score = computeIdeaConfidence({ idea: { source_post_index: null, hook: "A brand new invented hook line" }, posts: [], sample: "very low" });
    expect(score).toBe(CONFIDENCE_WEIGHTS.base + CONFIDENCE_WEIGHTS.sampleVeryLow);
    expect(score).toBeLessThanOrEqual(UNEVIDENCED_CONFIDENCE_CAP);
  });
  it("keeps unevidenced ideas low even with a high-confidence sample", () => {
    const score = computeIdeaConfidence({ idea: { source_post_index: null, hook: "A brand new invented hook line" }, posts: samplePosts, sample: "high" });
    expect(score).toBe(CONFIDENCE_WEIGHTS.base + CONFIDENCE_WEIGHTS.sampleHigh);
    expect(score).toBeLessThanOrEqual(UNEVIDENCED_CONFIDENCE_CAP);
  });
  it("reaches the ceiling with a 3x-viral source, caption-derived hook and high sample confidence", () => {
    const score = computeIdeaConfidence({ idea: { source_post_index: 0, hook: "Stop doing this one thing" }, posts: samplePosts, sample: "high" });
    expect(score).toBe(100);
  });
  it("scores a below-average source lower than a viral one", () => {
    const viral = computeIdeaConfidence({ idea: { source_post_index: 0, hook: "invented hook here" }, posts: samplePosts, sample: "moderate" });
    const weak = computeIdeaConfidence({ idea: { source_post_index: 1, hook: "invented hook here" }, posts: samplePosts, sample: "moderate" });
    expect(viral).toBeGreaterThan(weak);
  });
  it("clamps into 0–100", () => {
    const score = computeIdeaConfidence({ idea: { source_post_index: 0, hook: "Stop doing this one thing" }, posts: samplePosts, sample: "high" });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
describe("toPromptPost lean serialization", () => {
  // Fixture shaped like a real stored normalized post.
  const full = {
    type: "Video", timestamp: "2026-09-01T10:00:00Z", caption: "Real caption line\nMore detail",
    likesCount: 120, commentsCount: 14, videoViewCount: 9000, videoPlayCount: 9100,
    hashtags: ["fitness"], mentions: [], isSponsored: null, locationName: null, musicInfo: null,
    carouselSlides: null, url: "https://www.instagram.com/p/ABC/", shortCode: "ABC",
    displayUrl: "https://cdn.example.com/img.jpg",
  };
  it("omits displayUrl, url, shortCode and null/empty fields, keeps postIndex", () => {
    const lean = toPromptPost(full, 3) as any;
    expect(lean.postIndex).toBe(3);
    expect(lean.displayUrl).toBeUndefined();
    expect(lean.url).toBeUndefined();
    expect(lean.shortCode).toBeUndefined();
    expect(lean.isSponsored).toBeUndefined();
    expect(lean.locationName).toBeUndefined();
    expect(lean.musicInfo).toBeUndefined();
    expect(lean.mentions).toBeUndefined();
    expect(lean.caption).toBe("Real caption line\nMore detail");
    expect(lean.likesCount).toBe(120);
  });
  it("is at least 15% shorter than the full post on a real-shaped fixture", () => {
    const posts = Array.from({ length: 20 }, (_, i) => ({
      ...full,
      caption: `Caption ${i} with a realistic amount of text, hashtags and a call to action that creators actually write.`,
      likesCount: 100 + i, shortCode: `SC${i}`, url: `https://www.instagram.com/p/SC${i}/`,
    }));
    const fullLen = JSON.stringify(posts.map((p, postIndex) => ({ postIndex, ...p }))).length;
    const leanLen = JSON.stringify(posts.map(toPromptPost)).length;
    expect(leanLen).toBeLessThanOrEqual(fullLen * 0.85);
  });
  it("grounding still resolves sourceUrl and highest-post url from stored posts, not prompt posts", () => {
    const stored = posts.map((p, i) => ({ ...p, url: `https://www.instagram.com/p/post${i}/` }));
    const report = groundIntelReport({ hookAnalysis: { provenHooks: [{ postIndex: 11, actualOpeningLine: "Invented" }] } }, { posts: stored, profile: { followersCount: 1000 } });
    expect(report.hookAnalysis.provenHooks[0].sourceUrl).toBe("https://www.instagram.com/p/post11/");
    const metrics = calculateIntelMetrics(stored, 1000).performanceMetrics;
    expect(metrics.highestLikedPost?.url).toBe("https://www.instagram.com/p/post11/");
  });
});

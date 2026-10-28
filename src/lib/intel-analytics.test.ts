import { describe, it, expect } from "bun:test";
import { calculateIntelMetrics, groundIntelReport, validateIntelIdeas, IDEA_CATEGORIES } from "./intel-analytics";
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
});
const ideas = Array.from({length:50},(_,i)=>({idea_number:i+1,category:IDEA_CATEGORIES[Math.floor(i/10)], title:`Specific idea ${i}`,format:"Reel",hook:`A completely unique ready-to-post hook ${i}`,description:"A specific concept grounded in this audience.",why_it_works:"Uses the actual caption and observed source engagement.",caption_opener:"Specific caption opening the creator can use.",cta:"Save this example",viral_mechanism:"save-worthy",production_difficulty:"easy (30 min)",virality_score:87,source_post_index:i%12}));
it("requires exactly 50 unique ideas, ten per category",()=>{
  expect(validateIntelIdeas(ideas,posts)).toHaveLength(50);
  expect(()=>validateIntelIdeas(ideas.slice(0,49),posts)).toThrow();
  expect(()=>validateIntelIdeas(ideas.map((v,i)=>i===10?{...v,category:"Steal the Frame"}:v),posts)).toThrow();
});
it("requires real source evidence for cloned and amplified formulas",()=>{
  expect(()=>validateIntelIdeas(ideas.map((v,i)=>i===0?{...v,source_post_index:99}:v),posts)).toThrow();
});
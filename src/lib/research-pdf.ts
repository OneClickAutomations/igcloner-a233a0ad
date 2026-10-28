import jsPDF from "jspdf";

// Export-specific brand tokens; deliberately independent of the app's selected theme.
export const INTEL_PDF_DESIGN = {
  pageBg: "#0D0D1A", cardBg: "#13131F", cardBorder: "#1E1E32", darkCardBg: "#0A0A14",
  primary: "#FFFFFF", secondary: "#9B9BB8", muted: "#5C5C7A",
  gradient: ["#F58529", "#DD2A7B", "#8134AF", "#515BD4"], success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#06B6D4",
};
const D = INTEL_PDF_DESIGN; const W = 595, H = 842, M = 42, CW = W-M*2;
const arr = (v: unknown): any[] => Array.isArray(v) ? v : [];
const val = (v: unknown) => v == null || v === "" ? "Not available" : String(v);
const ascii = (v: unknown) => val(v).replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,"-").replace(/[^\x20-\x7E\n]/g, "");

export function buildResearchPdf(report: any, ideas: any[] = []) {
  const doc = new jsPDF({ unit: "pt", format: [W,H] });
  const dna = report.dna_report ?? {}, perf = dna.performanceMetrics ?? {}, comp = dna.competitivePosition ?? {}, audience = dna.audienceIntelligence ?? {};
  const limited = report.limited_data || dna.reportFlags?.limitedData;
  const subject = report.mode === "competitor" ? `@${String(report.subject).replace(/^@/,"")}` : report.subject;
  const text = (v: unknown, x: number, y: number, size = 9, color = D.secondary, bold = false) => { doc.setFont("helvetica",bold ? "bold":"normal"); doc.setFontSize(size); doc.setTextColor(color); doc.text(ascii(v),x,y); };
  const lines = (v: unknown, x: number, y: number, width: number, size = 9, color = D.secondary, maxHeight = 120, bold = false) => {
    doc.setFont("helvetica",bold ? "bold":"normal"); doc.setFontSize(size);
    let wrapped = doc.splitTextToSize(ascii(v),width) as string[];
    while (wrapped.length*size*1.4 > maxHeight && size > 6.5) { size-=0.25; doc.setFontSize(size); wrapped=doc.splitTextToSize(ascii(v),width); }
    const count = Math.max(1,Math.floor(maxHeight/(size*1.4)));
    if (wrapped.length>count) { wrapped=wrapped.slice(0,count); wrapped[count-1]=(wrapped[count-1]??"")+"..."; }
    doc.setTextColor(color); doc.text(wrapped,x,y,{ lineHeightFactor:1.4 }); return wrapped.length*size*1.4;
  };
  const gradient = (x:number,y:number,w:number,h:number) => {
    const stops = D.gradient.map(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]);
    for(let i=0;i<100;i++){ const t=i/99*3,k=Math.min(2,Math.floor(t)),f=t-k,a=stops[k]??[],b=stops[k+1]??[]; doc.setFillColor(Math.round((a[0]??0)*(1-f)+(b[0]??0)*f),Math.round((a[1]??0)*(1-f)+(b[1]??0)*f),Math.round((a[2]??0)*(1-f)+(b[2]??0)*f));doc.rect(x+i*w/100,y,w/100+0.1,h,"F"); }
  };
  const card = (x:number,y:number,w:number,h:number,accent?:string) => { doc.setFillColor(D.cardBg);doc.setDrawColor(D.cardBorder);doc.setLineWidth(0.7);doc.roundedRect(x,y,w,h,4,4,"FD");if(accent){doc.setFillColor(accent);doc.rect(x,y,3,h,"F");} };
  const page = (number:number,label:string,title:string) => {
    if(number>1)doc.addPage();doc.setFillColor(D.pageBg);doc.rect(0,0,W,H,"F");gradient(0,0,W,4);
    text("IGCloner",M,29,11,D.primary,true);text("CONTENT INTELLIGENCE REPORT",M+80,29,7,D.muted);
    if(number>1){text(`${String(number-1).padStart(2,"0")} / ${label}`,M,67,7,D.muted,true);text(title,M,94,16,D.primary,true);gradient(M,107,CW,1);}
    text(`IGCloner - igcloner.lovable.app - Confidential - ${number} / 9`,M,817,7,D.muted);
  };
  const sectionCard = (title:string,body:unknown,y:number,h:number,color:string=D.gradient[1]??D.info) => { card(M,y,CW,h,color);text(title,M+14,y+19,10,D.primary,true);lines(body,M+14,y+37,CW-28,9,D.secondary,h-45); };
  // 1: cover
  page(1,"","Cover");text("Deep-Dive",M,157,44,D.primary,true);text(report.mode === "competitor" ? "Competitor":"Content",M,208,44,D.gradient[1],true);text("Intelligence",M,259,44,D.primary,true);
  doc.setDrawColor(D.cardBorder);doc.line(M,285,W-M,285);
  const date = new Date(report.created_at ?? Date.now()).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  [["ACCOUNT",subject],["REPORT DATE",date],["ANALYSIS TYPE",report.mode],["NICHE",audience.primaryAudience ?? dna.audienceProfile?.who]].forEach(([k,v],i)=>{text(k,M+i*CW/4,312,7,D.muted,true);lines(v,M+i*CW/4,331,CW/4-10,9,D.primary,42,true);});
  card(M,387,CW,126);const score=Math.max(0,Math.min(100,Number(report.opportunity_score??dna.opportunityScore??0)));const cx=M+61,cy=450,r=38;
  doc.setDrawColor(D.cardBorder);doc.setLineWidth(6);doc.circle(cx,cy,r,"S");for(let i=0;i<score;i++){const a=(i/100*2*Math.PI)-Math.PI/2,b=((i+1)/100*2*Math.PI)-Math.PI/2;doc.setDrawColor(D.gradient[Math.min(3,Math.floor(i/25))]??D.info);doc.line(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(b)*r,cy+Math.sin(b)*r);}text(score,cx-14,453,25,D.primary,true);text("/100",cx-10,469,7,D.muted);
  text("OPPORTUNITY SCORE",M+125,413,7,D.muted,true);text(`${score} / 100`,M+125,442,24,D.gradient[0],true);lines(comp.opportunityReasoning??dna.executiveSummary,M+125,463,CW-143,9,D.secondary,38);
  [["COMPETITION",comp.competitionLevel,D.danger],["POSTING CADENCE",dna.postingStrategy?.frequency,D.warning],["AVG ENGAGEMENT",perf.engagementRate,D.info],["CONTENT GAPS",`${arr(comp.contentGaps).length} FOUND`,D.success]].forEach(([k,v,c],i)=>{card(M+i*(CW/4+2),537,CW/4-6,85);text(k,M+i*(CW/4+2)+8,556,7,D.muted,true);lines(v,M+i*(CW/4+2)+8,578,CW/4-22,12,c,32,true);});
  if(limited)sectionCard("LIMITED DATA MODE","Posts could not be scraped. Metrics and proven hook evidence are unavailable; ideas use profile intelligence and labelled niche inferences.",653,85,D.warning);
  // 2: summary
  page(2,"OVERVIEW","Executive Summary");lines(dna.executiveSummary,M,139,CW,9,D.secondary,135);
  const findings=[["Evidence quality",dna.rawDataSummary?.dataQualityNote,D.info],["Biggest opportunity",arr(dna.growthOpportunities)[0]??comp.differentiationPotential,D.warning],["Content gap",arr(comp.contentGaps)[0],D.gradient[1]],["Competitive advantage",arr(comp.nicheStrengths)[0]??arr(dna.competitiveAdvantages)[0],D.success]];
  findings.forEach(([title,body,color],i)=>sectionCard(String(title),body,296+i*111,96,String(color)));
  // 3: performance
  page(3,"METRICS","Performance Intelligence");if(limited)text("LIMITED DATA - Post-level metrics are not available",M,134,9,D.warning,true);
  const metrics=[["Engagement rate",perf.engagementRate],["Avg likes",perf.avgLikesPerPost],["Avg comments",perf.avgCommentsPerPost],["Avg reel views",perf.avgViewsPerReel],["Viral posts",perf.viralPostCount],["Best post interactions",dna.topPosts?.[0]?.engagement]];
  metrics.forEach(([k,v],i)=>{const x=M+(i%2)*(CW/2+6),y=155+Math.floor(i/2)*87;card(x,y,CW/2-6,75);gradient(x,y,CW/2-6,2);text(k,x+12,y+22,8,D.secondary);lines(limited?"Not available":v,x+12,y+49,CW/2-30,21,D.primary,30,true);});
  text("CONTENT FORMAT DISTRIBUTION",M,451,8,D.muted,true);
  if(!limited){[["Image",dna.contentFormatDistribution?.imagePercent],["Reel",dna.contentFormatDistribution?.reelPercent],["Carousel",dna.contentFormatDistribution?.carouselPercent]].forEach(([label,v],i)=>{const y=479+i*34;text(`${label}: ${val(v)}%`,M,y,9,D.primary);gradient(M+110,y-8,(CW-110)*Number(v??0)/100,7);});
    text("CONTENT PILLARS",M,597,8,D.muted,true);arr(dna.contentPillars).slice(0,5).forEach((p,i)=>{text(`${p.name}: ${p.share}% (${p.postCount} posts)`,M,619+i*20,9,D.secondary);});
  }else lines("No distribution or pillar charts are shown because no posts were available.",M,479,CW);
  lines(`${perf.engagementRateFormula??"Not available"}\nInputs: ${JSON.stringify(perf.engagementRateInputs??{})}\nBenchmark: ${val(perf.engagementBenchmark)}`,M,733,CW,7,D.muted,51);
  // 4: audience
  page(4,"AUDIENCE","Audience Intelligence");card(M,134,CW/2-6,209);card(M+CW/2+6,134,CW/2-6,209);text("WHO THEY ARE",M+12,158,8,D.gradient[0],true);lines(audience.primaryAudience??dna.audienceProfile?.who,M+12,178,CW/2-30,9,D.secondary,149);text("CORE DESIRES",M+CW/2+18,158,8,D.gradient[1],true);lines(arr(audience.desiresAddressed).map(v=>`- ${v}`).join("\n"),M+CW/2+18,178,CW/2-30,9,D.secondary,149);
  text("PAIN POINTS",M,381,8,D.muted,true);arr(audience.painPointsAddressed).slice(0,4).forEach((p,i)=>{const x=M+(i%2)*(CW/2+6),y=402+Math.floor(i/2)*131;card(x,y,CW/2-6,118,D.gradient[0]);lines(p,x+12,y+25,CW/2-30,10,D.secondary,83);});lines(audience.psychographics,M,708,CW,9,D.secondary,76);
  // 5: DNA
  page(5,"CONTENT DNA","Hook & Caption Analysis");const hooks=arr(dna.hookAnalysis?.provenHooks).slice(0,4);if(!hooks.length)sectionCard("No scraped hook evidence",limited?"Limited data: suggested hooks are niche-informed, not proven by this account's posts.":"Captions did not provide usable hook evidence.",136,83,D.warning);
  hooks.forEach((h,i)=>{card(M,134+i*114,CW,103,D.gradient[1]);text(h.hookType,M+13,154+i*114,8,D.gradient[1],true);lines(`"${h.actualOpeningLine}"`,M+13,176+i*114,CW-26,10,D.primary,43);lines(`${h.engagementOnThisPost??"Unknown"} interactions - ${val(h.whyItWorked)}`,M+13,214+i*114,CW-26,7,D.secondary,16);});
  const anatomy=[["Opening style",dna.hookAnalysis?.dominantHookTypes?.join(", ")],["Body structure",dna.hookAnalysis?.captionStructure],["Brand voice",dna.brandVoice],["CTA pattern",arr(dna.hookAnalysis?.ctaPatterns).join(" | ")],["Length",dna.hookAnalysis?.captionLengthPattern]];
  anatomy.forEach(([k,v],i)=>{card(M,612+i*33,CW,31);text(k,M+10,631+i*33,8,D.primary,true);lines(v,M+120,626+i*33,CW-133,7,D.secondary,22);});
  // 6: gaps
  page(6,"OPPORTUNITY","Content Gap Analysis");const gaps=arr(dna.opportunityActions);for(let i=0;i<4;i++){const g=gaps[i];card(M,134+i*160,CW,146,D.gradient[i]);text(`${String(i+1).padStart(2,"0")}  ${val(g?.title)}`,M+13,156+i*160,11,D.primary,true);text("THE PROBLEM",M+13,178+i*160,7,D.muted,true);lines(g?.problem,M+13,195+i*160,CW-26,9,D.secondary,32);text("YOUR ACTION STEP",M+13,235+i*160,7,D.gradient[i],true);lines(g?.action,M+13,251+i*160,CW-26,9,D.secondary,23);}
  // 7: plan
  page(7,"STRATEGY","30-Day Outperform Plan");const weeks=arr(dna.thirtyDayPlan);for(let i=0;i<4;i++){const w=weeks[i];card(M,134+i*160,CW,146);gradient(M,134+i*160,CW,2);text(`WEEK ${i+1}`,M+13,157+i*160,8,D.gradient[i],true);text(w?.title??"Plan not available",M+13,177+i*160,11,D.primary,true);lines(arr(w?.actions).map(a=>`- ${a}`).join("\n"),M+13,199+i*160,CW-26,9,D.secondary,70);}
  // 8: hashtags
  page(8,"DISTRIBUTION","Hashtag Strategy");const tiers=dna.hashtagTiers??{};[["Broad",tiers.broad],["Niche",tiers.niche],["Community",tiers.community]].forEach(([name,tags],i)=>{card(M,136+i*164,CW,145,D.gradient[i]);text(`TIER ${i+1} - ${name}`,M+13,160+i*164,10,D.gradient[i],true);text("Post volumes: Not available (not scraped)",M+13,180+i*164,7,D.muted);lines(arr(tags).filter(t=>/^#?[\w]+$/.test(String(t))).map(t=>`#${String(t).replace(/^#/,"")}`).join("  "),M+13,204+i*164,CW-26,11,D.primary,58);});sectionCard("RECOMMENDED MIX",tiers.recommendation??"Test a relevant combination of observed niche and community tags. Compare reach on your own posts; hashtag performance is not guaranteed.",654,116,D.info);
  // 9: top ideas; ten complete excerpts on the promised page.
  page(9,"IDEAS","Top 10 Content Ideas");text(`${ideas.length} full ideas available as Studio drafts from this report`,M,124,8,D.muted);
  const top=[...ideas].sort((a,b)=>Number(b.virality_score)-Number(a.virality_score)).slice(0,10);
  if(!top.length)sectionCard("Ideas not generated yet","Generate 50 content ideas in the report, then export again to include the top ten.",145,86,D.warning);
  top.forEach((idea,i)=>{const y=139+i*64;card(M,y,CW,59);text(`${i+1} / ${idea.format} / Predicted score ${idea.virality_score}`,M+9,y+12,7,D.gradient[i%4],true);lines(idea.hook,M+9,y+25,CW-18,8,D.primary,17,true);lines(idea.description,M+9,y+44,CW-18,7,D.secondary,12);});
  doc.setProperties({title:`IGCloner Intel - ${subject}`,subject:"Content Intelligence Report",author:"IGCloner"});
  return doc;
}
export function exportResearchPdf(report: any, ideas: any[] = []) {
  const slug = String(report.subject??"report").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
  buildResearchPdf(report,ideas).save(`igcloner-intel-${slug||"report"}.pdf`);
}

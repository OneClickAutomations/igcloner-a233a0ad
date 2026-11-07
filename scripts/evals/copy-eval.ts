/** Repeatable paid eval. Run explicitly: bun scripts/evals/copy-eval.ts [kind] [fixture-index] [niche-index]. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {z} from 'zod';
import {compactCopyContext,selectCopyExemplars} from '../../src/lib/copy-rules';
import {hookLab,nativeCaptionPack,qualityCopyJson,judgeCopy,contextPrompt,CopyQualityError} from '../../src/lib/copy-engine.server';
const fixtures=JSON.parse(readFileSync(new URL('./copy-fixtures.json',import.meta.url),'utf8'));
const kind=process.argv[2]??'captions',idx=Number(process.argv[3]??0),ni=Number(process.argv[4]??0);
const fixture=fixtures.analyses[idx];if(!fixture)throw new Error('Unknown fixture');
const ctx={...compactCopyContext(fixture.source,{}, {niche:fixtures.niches[ni],toneOfVoice:'direct, warm, practical',targetAudience:ni?'curious adults learning space science':'solo creators who procrastinate'}),exemplars:selectCopyExemplars(fixtures.analyses.map((a:any)=>a.source),fixtures.niches[ni])};
let output:any;
try {
if(kind==='hooks')output=await hookLab(ctx);
else if(kind==='captions')output=await nativeCaptionPack(ctx,['instagram','tiktok','x','linkedin']);
else if(kind==='carousel')output=await qualityCopyJson(z.object({title:z.string(),slides:z.array(z.object({index:z.number(),role:z.string(),headline:z.string(),body:z.string(),visualNote:z.string()})),caption:z.string(),hashtags:z.array(z.string())}),`Write exactly 4 complete carousel slides (hook, context, payoff, CTA) for the creator niche. Use source slide roles and relative text length, genuinely specific new words. Headline <=8 words, body <=25 words. ${contextPrompt(ctx)} Return {title,slides:[{index,role,headline,body,visualNote}],caption,hashtags}`,ctx,kind);
else if(kind==='reel')output=await qualityCopyJson(z.object({hook:z.string(),scenes:z.array(z.object({durationSec:z.number(),onScreenText:z.string(),voiceover:z.string(),visualNote:z.string()})),caption:z.string()}),`Write a complete new reel script for creator niche from actual blueprint pacing and transcript. Scene duration proportions, text timing and words/second must fit source; disclose limits if no video evidence. ${contextPrompt(ctx)} Return {hook,scenes:[{durationSec,onScreenText,voiceover,visualNote}],caption}`,ctx,kind);
else if(kind==='sharpen')output=await qualityCopyJson(z.object({before:z.string(),after:z.string(),changes:z.array(z.string())}),`Sharpen the supplied caption in the creator niche; retain source mechanism, replace generic copy with concrete creator-native words. ${contextPrompt(ctx)} Return {before,after,changes}`,ctx,kind);
else throw new Error('Unknown kind');
const content=output.value??output.platforms??output.hooks;
const judge=await judgeCopy(ctx,content,kind);
mkdirSync('/tmp/copy-eval/results',{recursive:true});
writeFileSync(`/tmp/copy-eval/results/${kind}-${idx}-${ni}.json`,JSON.stringify({fixture:fixture.label,niche:fixtures.niches[ni],kind,output,judge},null,2));
console.log(JSON.stringify({fixture:fixture.label,kind,niche:fixtures.niches[ni],usage:output.usage,score:judge.average,minimum:judge.minimum,pass:judge.pass}));
}catch(error){
  mkdirSync('/tmp/copy-eval/results',{recursive:true});
  const evidence=error instanceof CopyQualityError?error.evidence:null;
  writeFileSync(`/tmp/copy-eval/results/${kind}-${idx}-${ni}.json`,JSON.stringify({fixture:fixture.label,niche:fixtures.niches[ni],kind,pass:false,error:error instanceof Error?error.message:String(error),evidence},null,2));
  console.log(JSON.stringify({fixture:fixture.label,kind,niche:fixtures.niches[ni],pass:false,error:error instanceof Error?error.message:String(error),usage:evidence?.usage,rounds:evidence?.rounds.map(r=>({round:r.round,average:r.items.reduce((n:number,i:any)=>n+Object.values(i.scores).reduce((a:number,b:any)=>a+b,0)/7,0)/r.items.length,minimum:Math.min(...r.items.flatMap((i:any)=>Object.values(i.scores)))}))}));
}

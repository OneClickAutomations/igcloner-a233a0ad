import { createFileRoute } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { GenerationProgress } from '@/components/GenerationProgress';
import { finishJob, startJob } from '@/lib/generation-jobs';
// TEMPORARY visual harness for mocked job states (deleted after verification).
export const Route = createFileRoute('/progress-demo')({ component: () => {
  const t = Date.now();
  return <div className="mx-auto max-w-2xl space-y-4 bg-background p-6 text-foreground">
    <GenerationProgress stage="Watching your reel…" percent={55} startedAt={t - 40000} expectedSeconds={90}/>
    <GenerationProgress stage="Drawing scene 2 of 3…" startedAt={t - 50000} expectedSeconds={120} items={[{label:'Scene 1',state:'done'},{label:'Scene 2',state:'running'},{label:'Scene 3',state:'waiting'}]}/>
    <GenerationProgress stage="Animating scene 1…" startedAt={t - 30000} expectedSeconds={120} items={[{label:'Scene 1',state:'running'},{label:'Scene 2',state:'running'}]} note="You can leave this page — we’ll tell you when it’s done"/>
    <GenerationProgress status="error" stage="" startedAt={t} expectedSeconds={60} error="The image service is busy right now." refunded onRetry={() => {}}/>
    <GenerationProgress status="done" stage="Done" startedAt={t} expectedSeconds={60}/>
    <div id="result" className="review-card h-40">Finished content</div>
    <button id="ok" onClick={() => { startJob({id:'d',kind:'stills',title:'Your stills',href:'/progress-demo',expectedSeconds:5,doneLabel:'Your stills are ready'}); finishJob('d', true, { resultSelector: '#result' }); }}>ok</button>
    <button id="away" onClick={() => { startJob({id:'e',kind:'assembly',title:'Your video',href:'/studio/inspiration',expectedSeconds:5,doneLabel:'Your video is ready'}); finishJob('e', true); }}>away</button>
    <Toaster/>
  </div>;
} });

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { getOnboardingStatus, saveOnboarding } from "@/lib/onboarding.functions";
import { CREDIT_BALANCE_KEY } from "@/lib/credits";

const GOALS = ["Grow followers", "Sell products", "Build my brand", "Get leads or clients", "Promote my business", "Save time creating", "Go viral", "Monetize my content"];
export const ONBOARDING_PLATFORMS = ["Instagram", "Facebook", "TikTok", "YouTube", "X", "Threads", "LinkedIn", "Pinterest", "Reddit", "Bluesky", "Discord", "Telegram"];
const display = { fontFamily: '"Archivo Black", sans-serif', fontWeight: 400 } as const;

function MultiChips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${on ? "border-transparent text-primary-foreground shadow-md" : "border-border bg-background text-foreground hover:border-primary"}`}
            style={on ? { background: "var(--action-gradient)" } : undefined}>
            {on && <Check className="h-3.5 w-3.5" />}{o}
          </button>
        );
      })}
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8" : "w-3 bg-muted"}`} style={i <= step ? { background: "var(--action-gradient)" } : undefined} />)}</div>;
}

function GradientButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={`rounded-full px-6 font-semibold text-primary-foreground hover:opacity-95 ${props.className ?? ""}`} style={{ background: "var(--action-gradient)" }} />;
}

export function OnboardingDialog() {
  const fetchStatus = useServerFn(getOnboardingStatus);
  const save = useServerFn(saveOnboarding);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["onboarding-status"], queryFn: () => fetchStatus(), staleTime: 5 * 60_000 });
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);
  const [niche, setNiche] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(["Instagram"]);
  const [busy, setBusy] = useState(false);
  const open = Boolean(data && !data.completed && !dismissed);
  const firstName = data?.name?.split(" ")[0];

  async function finish() {
    setBusy(true);
    try {
      await save({ data: { niche, goals, platforms } });
      qc.setQueryData(["onboarding-status"], { ...data, completed: true });
      qc.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY });
      setDismissed(true);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) void finish(); }}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-3xl border-border p-0">
        <div className="relative overflow-hidden px-6 pb-6 pt-7 sm:px-8">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl" style={{ background: "var(--action-gradient)" }} />
          <div className="relative mb-5 flex items-center justify-between"><StepDots step={step} /><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step {step + 1} of 3</span></div>

          {step === 0 && (<div className="relative space-y-5">
            <div className="text-6xl leading-none" role="img" aria-label="Waving hand">👋</div>
            <div className="space-y-2">
              <DialogTitle className="text-3xl leading-tight sm:text-4xl" style={display}>
                <span className="block text-foreground">Welcome{firstName ? `, ${firstName}` : ""}!</span>
                <span className="block text-primary">Let's set you up.</span>
              </DialogTitle>
              <DialogDescription className="text-base">Tell us about your content so hooks, captions and ideas fit you.</DialogDescription>
            </div>
            <label className="block space-y-2 text-sm font-semibold">Your niche
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. fitness, skincare, real estate" maxLength={80} className="h-12 rounded-full bg-background px-5 shadow-sm" />
            </label>
            <div className="space-y-2"><p className="text-sm font-semibold">What do you want? <span className="font-normal text-muted-foreground">Pick all that apply</span></p><MultiChips options={GOALS} value={goals} onChange={setGoals} /></div>
            <div className="space-y-2"><p className="text-sm font-semibold">Where do you post? <span className="font-normal text-muted-foreground">Pick all that apply</span></p><MultiChips options={ONBOARDING_PLATFORMS} value={platforms} onChange={setPlatforms} /></div>
            <div className="flex justify-end pt-1"><GradientButton size="lg" onClick={() => setStep(1)}>Next</GradientButton></div>
          </div>)}

          {step === 1 && (<div className="relative space-y-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground" style={{ background: "var(--action-gradient)" }}><Send className="h-7 w-7" /></div>
            <div className="space-y-2">
              <DialogTitle className="text-3xl leading-tight" style={display}>
                <span className="block text-foreground">Post everywhere</span><span className="block text-primary">in one click.</span>
              </DialogTitle>
              <DialogDescription className="text-base">Connect Upload-Post so IGCloner can publish and schedule to your accounts. It's optional. You can still create and download everything without it.</DialogDescription>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-3 text-sm font-semibold">How to get your Upload-Post key</p>
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                {["Go to upload-post.com and create a free account.", "Connect the social accounts you want to post to.", "Open API Keys in your Upload-Post dashboard and create a key.", "Copy the key, then paste it in IGCloner under Settings → API keys."].map((t, i) => (
                  <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span><span className="text-foreground">{t}</span></li>
                ))}
              </ol>
              <a href="https://www.upload-post.com" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Open upload-post.com <ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" className="rounded-full" onClick={() => setStep(0)}>Back</Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="rounded-full" onClick={() => setStep(2)}>Skip for now</Button>
                <GradientButton asChild><Link to="/settings" search={{ section: "api-keys" }} onClick={() => void finish()}>Add my key</Link></GradientButton>
              </div>
            </div>
          </div>)}

          {step === 2 && (<div className="relative space-y-5">
            <div className="text-6xl leading-none" role="img" aria-label="Party popper">🎉</div>
            <div className="space-y-2">
              <DialogTitle className="text-3xl leading-tight" style={display}>
                <span className="block text-foreground">Your free trial</span><span className="block text-primary">is ready.</span>
              </DialogTitle>
              <DialogDescription className="text-base">No card needed.</DialogDescription>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Plan credits</p><p className="mt-1 text-3xl font-bold">40</p><p className="text-xs text-muted-foreground">Analyses, hooks, captions, images</p></div>
              <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Video credits</p><p className="mt-1 text-3xl font-bold">20</p><p className="text-xs text-muted-foreground">Video clips</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Paste an Instagram or Facebook post link on your dashboard to start. An analysis costs 3 plan credits.</p>
            <div className="flex justify-between"><Button variant="ghost" className="rounded-full" onClick={() => setStep(1)}>Back</Button><GradientButton size="lg" disabled={busy} onClick={finish}>Analyze my first post</GradientButton></div>
          </div>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

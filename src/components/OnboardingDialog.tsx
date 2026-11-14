import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Key, Rocket } from "lucide-react";
import { toast } from "sonner";
import { getOnboardingStatus, saveOnboarding } from "@/lib/onboarding.functions";
import { CREDIT_BALANCE_KEY } from "@/lib/credits";

const GOALS = ["Grow followers", "Get more sales", "Build my brand", "Save time creating"];
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "YouTube"];

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} aria-pressed={value === o}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${value === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function OnboardingDialog() {
  const fetchStatus = useServerFn(getOnboardingStatus);
  const save = useServerFn(saveOnboarding);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["onboarding-status"], queryFn: () => fetchStatus(), staleTime: 5 * 60_000 });
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [busy, setBusy] = useState(false);
  const open = Boolean(data && !data.completed && !dismissed);

  async function finish() {
    setBusy(true);
    try {
      await save({ data: { niche, goal, platform } });
      qc.setQueryData(["onboarding-status"], { ...data, completed: true });
      qc.invalidateQueries({ queryKey: CREDIT_BALANCE_KEY });
      setDismissed(true);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) void finish(); }}>
      <DialogContent className="max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step {step + 1} of 3</p>
        {step === 0 && (<>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Tell us about your content</DialogTitle>
            <DialogDescription>We use this to tailor hooks, captions and ideas to you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">Your niche
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. fitness, skincare, real estate" maxLength={80} />
            </label>
            <div className="space-y-1.5 text-sm font-medium">Main goal<Chips options={GOALS} value={goal} onChange={setGoal} /></div>
            <div className="space-y-1.5 text-sm font-medium">Main platform<Chips options={PLATFORMS} value={platform} onChange={setPlatform} /></div>
          </div>
          <div className="flex justify-end"><Button onClick={() => setStep(1)}>Next</Button></div>
        </>)}
        {step === 1 && (<>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-primary" /> Connect your own keys (optional)</DialogTitle>
            <DialogDescription>Everything works without them. Add your own Apify, ElevenLabs or Upload-Post keys anytime to use your own accounts.</DialogDescription>
          </DialogHeader>
          <Button variant="outline" asChild><Link to="/settings" search={{ section: "api-keys" }} onClick={() => void finish()}>Add API keys now</Link></Button>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(0)}>Back</Button><Button onClick={() => setStep(2)}>Skip for now</Button></div>
        </>)}
        {step === 2 && (<>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /> Your free trial is ready</DialogTitle>
            <DialogDescription>You have 40 free plan credits for analyses, hooks, captions and images, plus 20 free video credits for clips. No card needed.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Start by pasting an Instagram or Facebook post link into the box on your dashboard. An analysis costs 3 plan credits.</p>
          <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep(1)}>Back</Button><Button disabled={busy} onClick={finish}>Analyze my first post</Button></div>
        </>)}
      </DialogContent>
    </Dialog>
  );
}

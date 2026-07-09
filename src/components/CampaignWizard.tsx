import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Target, Briefcase, Users, Share2, PieChart, Microscope, Loader2, Check, ArrowRight, ArrowLeft, Sparkles,
} from "lucide-react";
import { createCampaign } from "@/lib/campaigns.functions";
import { listResearchReports } from "@/lib/research.functions";
import { useQuery } from "@tanstack/react-query";

const GOALS = [
  "Grow followers",
  "Drive DMs / leads",
  "Sell a product or service",
  "Launch a new offer",
  "Build authority in a niche",
  "Community engagement",
];
const BUSINESS_TYPES = [
  "Coach / Consultant", "Creator / Influencer", "Ecommerce brand", "Local business",
  "SaaS / Tech", "Agency", "Course / Info-product", "Real estate", "Fitness", "Other",
];
const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X / Twitter" },
  { id: "facebook", label: "Facebook" },
  { id: "pinterest", label: "Pinterest" },
  { id: "threads", label: "Threads" },
];

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const STEPS = [
  { key: "goal", label: "Goal", icon: Target },
  { key: "business", label: "Business", icon: Briefcase },
  { key: "audience", label: "Audience", icon: Users },
  { key: "platforms", label: "Platforms", icon: Share2 },
  { key: "mix", label: "Content Mix", icon: PieChart },
  { key: "research", label: "Research", icon: Microscope },
] as const;

export function CampaignWizard({
  open, onOpenChange, onCreated, defaultResearchId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
  defaultResearchId?: string | null;
}) {
  const createFn = useServerFn(createCampaign);
  const listResearch = useServerFn(listResearchReports);

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<string>(GOALS[0]);
  const [businessType, setBusinessType] = useState<string>(BUSINESS_TYPES[0]);
  const [audience, setAudience] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["instagram"]);
  const [mix, setMix] = useState({ reels: 50, carousels: 30, posts: 15, stories: 5 });
  const [researchId, setResearchId] = useState<string | null>(defaultResearchId ?? null);
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const research = useQuery({
    queryKey: ["research-reports-wizard"],
    queryFn: () => listResearch(),
    enabled: open,
  });

  const canNext = (() => {
    if (step === 0) return name.trim().length >= 2 && goal.length > 0;
    if (step === 1) return businessType.length > 0;
    if (step === 2) return audience.trim().length >= 3;
    if (step === 3) return platforms.length > 0;
    return true;
  })();

  const setMixPart = (k: keyof typeof mix, v: number) => {
    setMix((prev) => ({ ...prev, [k]: v }));
  };
  const mixTotal = mix.reels + mix.carousels + mix.posts + mix.stories;

  const submit = async () => {
    setSubmitting(true);
    try {
      const { campaign_id } = await createFn({
        data: {
          name: name.trim(),
          goal,
          business_type: businessType,
          audience: audience.trim(),
          platforms,
          content_mix: mix,
          research_report_id: researchId ?? undefined,
          duration_days: duration,
        },
      });
      toast.success(`Campaign "${name}" built — ${duration} days ready to edit.`);
      onCreated(campaign_id);
      onOpenChange(false);
      // reset
      setStep(0);
      setName("");
      setAudience("");
    } catch (e: any) {
      toast.error(e?.message || "Campaign generation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const StepIcon = STEPS[step].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-accent">
              <StepIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle>New Campaign · Step {step + 1} of 6</DialogTitle>
              <DialogDescription>
                {step === 0 && "Name it and lock in the goal."}
                {step === 1 && "What kind of business is this for?"}
                {step === 2 && "Who exactly are we talking to?"}
                {step === 3 && "Where will this content go live?"}
                {step === 4 && "Set the content mix — the AI will match it."}
                {step === 5 && "Ground the plan in a Content DNA (optional)."}
              </DialogDescription>
            </div>
          </div>
          <Progress value={((step + 1) / 6) * 100} className="mt-4 h-1.5" />
          <div className="mt-3 flex justify-between text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {STEPS.map((s, i) => (
              <span key={s.key} className={i === step ? "text-foreground" : ""}>{s.label}</span>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-[280px] py-2">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Campaign name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 authority push" className="mt-1" />
              </div>
              <div>
                <Label>Primary goal</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOALS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (days)</Label>
                <div className="mt-3 flex items-center gap-4">
                  <Slider min={7} max={60} step={1} value={[duration]} onValueChange={(v) => setDuration(v[0])} className="flex-1" />
                  <span className="w-14 text-right font-mono text-sm">{duration}</span>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUSINESS_TYPES.map((b) => (
                <button
                  key={b}
                  onClick={() => setBusinessType(b)}
                  className={`rounded-lg border px-3 py-3 text-left text-sm transition-all ${
                    businessType === b
                      ? "border-accent-primary bg-accent-primary/10 font-semibold"
                      : "border-border hover:border-border-strong"
                  }`}
                >{b}</button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <Label>Describe your ideal audience</Label>
              <Textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. New moms 28-40 who want to lose baby weight without gym time. Time-poor, budget-aware, spend a lot of time on Reels late at night."
                className="mt-1 min-h-[160px]"
              />
              <p className="mt-2 text-xs text-muted-foreground">Be specific — this drives every hook, caption, and CTA the AI writes.</p>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatforms((prev) => on ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                    className={`rounded-lg border px-3 py-3 text-sm transition-all ${
                      on ? "border-accent-primary bg-accent-primary/10 font-semibold" : "border-border hover:border-border-strong"
                    }`}
                  >
                    {p.label}
                    {on && <Check className="ml-1.5 inline h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              {(["reels", "carousels", "posts", "stories"] as const).map((k) => (
                <div key={k}>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="capitalize">{k}</Label>
                    <span className="text-sm font-mono">{mix[k]}%</span>
                  </div>
                  <Slider min={0} max={100} step={5} value={[mix[k]]} onValueChange={(v) => setMixPart(k, v[0])} />
                </div>
              ))}
              <div className={`rounded-md border px-3 py-2 text-xs ${
                mixTotal === 100 ? "border-status-success/30 bg-status-success/5 text-status-success" : "border-status-warning/30 bg-status-warning/5 text-status-warning"
              }`}>
                Total: {mixTotal}% {mixTotal !== 100 && "— we'll normalize to 100."}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Link a Content DNA report so every day is grounded in real audience signal. Skip to work purely from your inputs above.
              </p>
              <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border divide-y divide-border">
                <button
                  onClick={() => setResearchId(null)}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${researchId === null ? "bg-accent-primary/10 font-semibold" : "hover:bg-muted/50"}`}
                >
                  <span>No research — use my inputs only</span>
                  {researchId === null && <Check className="h-4 w-4 text-accent-primary" />}
                </button>
                {(research.data?.reports ?? []).filter((r: any) => r.status === "ready").map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => setResearchId(r.id)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${researchId === r.id ? "bg-accent-primary/10 font-semibold" : "hover:bg-muted/50"}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{r.mode}</Badge>
                        <span className="truncate">{r.subject}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.opportunity_score ? <span className="font-mono text-xs text-muted-foreground">{r.opportunity_score}/100</span> : null}
                      {researchId === r.id && <Check className="h-4 w-4 text-accent-primary" />}
                    </div>
                  </button>
                ))}
                {research.data && (research.data.reports ?? []).filter((r: any) => r.status === "ready").length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No completed research yet. Run one from the Research page for stronger grounding.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
            disabled={step === 0 || submitting}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          {step < 5 ? (
            <Button onClick={() => setStep((s) => Math.min(5, s + 1) as Step)} disabled={!canNext}>
              Next <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate {duration}-day campaign
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
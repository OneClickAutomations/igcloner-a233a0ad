import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link, Sparkles, Copy, Check, Save, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PLACEHOLDERS = [
  "instagram.com/reel/...",
  "instagram.com/p/...",
  "instagram.com/carousel/...",
];

function detectPostType(url: string): string | null {
  if (!url.includes("instagram.com")) return null;
  if (url.includes("/reel/")) return "Reel";
  if (url.includes("/p/")) return "Post";
  if (url.includes("/carousel/")) return "Carousel";
  return "Post";
}

export function AppPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [postType, setPostType] = useState<string | null>(null);
  const [phase, setPhase] = useState<"input" | "analyzing" | "results">("input");
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [dna, setDna] = useState<any>(null);
  const [clones, setClones] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [credits, setCredits] = useState(12);
  const [user, setUser] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const type = detectPostType(url);
    setPostType(type);
  }, [url]);

  const handleAnalyze = async () => {
    if (!url.includes("instagram.com")) {
      toast.error("Please enter a valid Instagram URL");
      return;
    }
    if (credits <= 0) {
      toast.error("No credits remaining. Upgrade to continue.");
      return;
    }

    setPhase("analyzing");
    setProgress(0);
    setStepLabel("Detecting post type...");

    // Simulate analysis steps
    const steps = [
      { pct: 15, label: "Detecting post type..." },
      { pct: 35, label: "Extracting caption..." },
      { pct: 55, label: "Analyzing hook structure..." },
      { pct: 75, label: "Deconstructing content DNA..." },
      { pct: 90, label: "Generating clone versions..." },
      { pct: 100, label: "Complete" },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 1200));
      setProgress(step.pct);
      setStepLabel(step.label);
    }

    // Mock DNA result
    const mockDna = {
      contentSummary: "A fitness coach breaks down the exact morning routine that helped them gain 50K followers in 3 months. Combines quick cuts, text overlays, and personal storytelling.",
      contentCategory: "Educational",
      performanceScore: 87,
      whyItWorks: [
        "Opens with a specific, credible claim that creates immediate curiosity",
        "Uses fast-paced editing to maintain attention in the first 3 seconds",
        "Provides actionable steps the viewer can replicate immediately",
        "Personal narrative makes the advice feel authentic, not generic",
        "CTA is low-friction (save) rather than high-friction (follow)",
      ],
      targetAudience: {
        who: "Aspiring fitness creators aged 22-34",
        desire: "Grow their audience without expensive equipment",
        trigger: "Feeling stuck after posting consistently with no growth",
      },
      hookBreakdown: {
        type: "Bold Claim",
        score: 9,
        whatWorks: "The number '50K' is specific and credible. The timeframe '3 months' makes it feel achievable.",
        improvement: "Could add 'without paid ads' to differentiate from common advice.",
      },
      emotionalArchitecture: {
        curiosity: 85,
        fomo: 60,
        trust: 70,
        relatability: 90,
        urgency: 40,
        inspiration: 75,
      },
      storyStructure: [
        { section: "Hook", timing: "0-3s", purpose: "Grab attention with bold claim" },
        { section: "Problem", timing: "3-12s", purpose: "Establish relatability - 'I was stuck too'" },
        { section: "Solution", timing: "12-35s", purpose: "Reveal the 3-step routine" },
        { section: "CTA", timing: "35-45s", purpose: "Low-friction save prompt" },
      ],
      captionDNA: {
        structure: "Standard",
        tone: "Conversational",
        persuasionStyle: "Story",
        ctaType: "Engagement",
        score: 8,
      },
      visualStyle: {
        colorMood: "Warm",
        composition: "Centered",
        textOverlay: "Subtle",
        editStyle: "Fast-cut",
        score: 7,
      },
      engagementDrivers: [
        "Saves: actionable checklist in caption + visual summary",
        "Shares: relatable 'I was stuck too' opening triggers tag-friends",
        "Comments: open-ended question in CTA invites debate on morning routines",
      ],
      monetizationPotential: "This structure is ideal for affiliate fitness products, a paid morning routine guide, or a coaching program. The trust built through personal story converts better than direct pitching.",
    };

    const mockClones = [
      {
        versionNumber: 1,
        angleType: "direct",
        angleLabel: "Direct Improvement",
        hook: "The morning routine that got me 50K followers in 90 days (no ads, no team)",
        angle: "Same core idea, but sharpen the hook with specificity and remove ambiguity",
        storyStructure: "Hook (specific claim) → Relatability (I was at 200 followers) → 3-step breakdown → Quick win CTA",
        caption: "3 months ago I had 200 followers and zero engagement.\n\nToday? 50K.\n\nNot because I'm special. Because I changed ONE thing: my morning routine.\n\nHere's the exact 3-step process I use every single day:\n\n1. 10 min content planning (not scrolling)\n2. Film 3 pieces of content back-to-back\n3. Post at 7:30 AM (when YOUR audience is awake)\n\nThat's it. No fancy gear. No team.\n\nSave this. Try it for 7 days. Then come back and tell me what changed.\n\n#contentcreator #growthtips #morningroutine",
        visualDirection: "Film yourself in natural morning light. Use quick jump cuts between each step. Add text overlay with the 3 steps. Keep it under 45 seconds.",
        cta: "Save this for your morning routine — then tell me what changed after 7 days",
      },
      {
        versionNumber: 2,
        angleType: "contrarian",
        angleLabel: "Contrarian Angle",
        hook: "Stop copying morning routines. Here's why most 'productivity' advice is destroying your growth.",
        angle: "Challenge the premise that morning routines are the answer — offer a different path",
        storyStructure: "Pattern interrupt (reject common advice) → Build tension (show the real problem) → Reveal counter-intuitive solution → Strong CTA",
        caption: "Everyone's telling you to wake up at 5 AM.\n\nI've tried it. It made me tired, anxious, and my content got WORSE.\n\nThe real secret isn't WHEN you create. It's HOW you protect your creative energy.\n\nHere's what actually moved the needle for me:\n\n→ Batch filming (2 hrs, 2x per week)\n→ No phone before noon on creation days\n→ One 'deep work' block — no multitasking\n\nI grew from 200 to 50K in 3 months with LESS 'hustle', not more.\n\nWhat's one 'productivity rule' you've tried that actually backfired?\n\n#contentcreator #creativity #growthmindset",
        visualDirection: "Start with you looking tired/caffeinated (relatable). Cut to you working focused at a clean desk. End with your actual follower count screenshot. Use darker, moodier tones.",
        cta: "Drop a productivity myth you've busted in the comments",
      },
      {
        versionNumber: 3,
        angleType: "story",
        angleLabel: "Storytelling Angle",
        hook: "I was about to quit. Then I changed one thing about my mornings.",
        angle: "Frame the advice as a personal redemption story with emotional stakes",
        storyStructure: "Emotional setup (lowest point) → Inciting incident (the change) → Rising action (first small wins) → Climax (the result) → Resolution (share the method)",
        caption: "March 2024. I sat in my car after another video flopped.\n\n3 likes. 0 saves. 200 followers after 6 months of trying.\n\nI was done. Ready to delete everything.\n\nBut that night, my mentor sent me one voice note.\n\nIt changed everything.\n\nShe said: 'You're not failing at content. You're failing at showing up for yourself first.'\n\nSo I rebuilt my mornings. Not for productivity. For creative clarity.\n\n3 months later: 50K followers. Brand deals. A community.\n\nThe routine that saved my creator career — save it.\n\n#creatorstory #nevergiveup #contentcreation",
        visualDirection: "Start with a quiet, reflective shot (car, coffee, sunrise). Use soft music. Gradually increase energy. Show follower growth as a visual line graph. End with a bright, confident clip.",
        cta: "If you've ever wanted to quit, comment 'me' — you're not alone",
      },
      {
        versionNumber: 4,
        angleType: "authority",
        angleLabel: "Authority Angle",
        hook: "I analyzed 1,000 viral fitness Reels. Here's the 3-part framework they all share.",
        angle: "Position as research-backed expert insight, not personal opinion",
        storyStructure: "Credibility establish (data point) → Framework reveal → Evidence → Application → CTA",
        caption: "I spent 40 hours analyzing 1,000 viral fitness Reels.\n\nNot for fun. For patterns.\n\nAnd I found one framework that appeared in 73% of posts with 100K+ views:\n\nThe 'Hook-Heal-Hustle' structure:\n\n🔥 HOKE (0-3s): Specific, bold claim with numbers\n💊 HEAL (3-20s): Address the pain point with empathy\n🏃 HUSTLE (20-45s): Actionable steps with clear outcomes\n\nI applied this to my own content.\n\nResult: 200 → 50K in 3 months.\n\nThe full breakdown + 10 examples is in my bio.\n\n#contentstrategy #viralcontent #fitnesscreator",
        visualDirection: "Clean, professional setup. Use data visualization graphics (charts, percentages). Wear something sharp. Background should be minimal. Use crisp, bright lighting.",
        cta: "The full framework + 10 examples — link in bio",
      },
      {
        versionNumber: 5,
        angleType: "curiosity",
        angleLabel: "Curiosity Gap",
        hook: "There's a reason your morning routine isn't working. And it's not what you think.",
        angle: "Create an information gap that demands to be closed — reveal only at the end",
        storyStructure: "Tease the secret → Build curiosity with partial clues → Delayed reveal → Payoff → CTA",
        caption: "You've tried every morning routine on the internet.\n\n5 AM wake-ups. Cold showers. Journaling.\n\nAnd still... crickets on your content.\n\nHere's what nobody's telling you:\n\nIt's not about the routine.\n\nIt's about the INTENTION behind it.\n\nMy routine is simple. Boring, even.\n\nBut it works because every action answers one question:\n\n'What does my AUDIENCE need from me today?'\n\nThat's the shift that took me from 200 to 50K.\n\nNot the routine. The intention.\n\nWhat's ONE thing your audience actually needs from you this week?\n\n#contentcreation #audiencefirst #growthtips",
        visualDirection: "Film yourself walking through a morning but keep cutting away before revealing the 'full' routine. Use text overlays that tease ('Not this...' 'Not that either...'). Build suspense. Final reveal is simple and anticlimactic — that's the point.",
        cta: "What's the ONE thing your audience needs this week? Comment below",
      },
    ];

    setDna(mockDna);
    setClones(mockClones);
    setPhase("results");
    setCredits((c) => c - 1);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = async () => {
    toast.success("Analysis saved!");
  };

  const emotionColor = (key: string) => {
    const map: Record<string, string> = {
      curiosity: "bg-accent-primary",
      fomo: "bg-accent-secondary",
      trust: "bg-status-success",
      relatability: "bg-chart-4",
      urgency: "bg-status-warning",
      inspiration: "bg-chart-2",
    };
    return map[key] || "bg-primary";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">IGCloner</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground sm:flex">
            {credits} analyses left
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/settings" })}>
            Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { supabase.auth.signOut(); navigate({ to: "/" }); }}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
        {phase === "input" && (
          <div className="flex flex-col items-center justify-center py-20">
            <h1 className="mb-2 text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Paste any Instagram URL
            </h1>
            <p className="mb-8 text-center text-muted-foreground">
              We'll deconstruct why it works and generate original versions for you.
            </p>

            <div className="relative w-full max-w-xl">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm transition-all focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                <Link2 className="ml-3 h-5 w-5 text-muted-foreground shrink-0" />
                <Input
                  ref={inputRef}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder={PLACEHOLDERS[placeholderIndex]}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button onClick={handleAnalyze} className="shrink-0 gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </Button>
              </div>
              {postType && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-accent-secondary animate-in fade-in slide-in-from-top-1">
                  <span className="h-2 w-2 rounded-full bg-accent-secondary" />
                  Detected: {postType}
                </div>
              )}
              {!postType && url && !url.includes("instagram.com") && (
                <div className="mt-2 text-sm text-status-error animate-in fade-in">
                  Please enter a valid Instagram URL
                </div>
              )}
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              You have <span className="font-medium text-foreground">{credits}</span> analyses remaining
            </p>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="mx-auto max-w-xl py-20">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-accent-primary animate-spin" />
                </div>
                <div>
                  <p className="font-medium">Analyzing content</p>
                  <p className="text-sm text-muted-foreground">{stepLabel}</p>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Usually done in 8–12 seconds</p>
            </div>
          </div>
        )}

        {phase === "results" && dna && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* LEFT: DNA Panel */}
            <div className="space-y-4">
              {/* Post Header Card */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary/10">
                      <Sparkles className="h-5 w-5 text-accent-primary" />
                    </div>
                    <div>
                      <p className="font-medium">@{dna.sourceAccount || "source_account"}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="rounded-md bg-accent-secondary/10 px-1.5 py-0.5 text-xs font-medium text-accent-secondary">
                          {dna.contentCategory}
                        </span>
                        <span>{dna.postType || "Reel"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold font-mono text-accent-primary">{dna.performanceScore}</div>
                    <div className="text-xs text-muted-foreground">Performance Score</div>
                  </div>
                </div>
              </div>

              {/* Content Summary */}
              <DNA_card title="Content Summary">
                <p className="text-sm leading-relaxed text-secondary-foreground">{dna.contentSummary}</p>
              </DNA_card>

              {/* Why This Works */}
              <DNA_card title="Why This Works">
                <ul className="space-y-2">
                  {dna.whyItWorks.map((point: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-secondary-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </DNA_card>

              {/* Target Audience */}
              <DNA_card title="Target Audience">
                <div className="grid gap-3 sm:grid-cols-3">
                  <AudiencePill label="WHO" value={dna.targetAudience.who} />
                  <AudiencePill label="DESIRE" value={dna.targetAudience.desire} />
                  <AudiencePill label="TRIGGER" value={dna.targetAudience.trigger} />
                </div>
              </DNA_card>

              {/* Hook Breakdown */}
              <DNA_card title="Hook Breakdown">
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded-md bg-accent-primary/10 px-2 py-0.5 text-xs font-medium text-accent-primary">
                    {dna.hookBreakdown.type}
                  </span>
                  <span className="font-mono text-sm font-bold text-accent-primary">{dna.hookBreakdown.score}/10</span>
                </div>
                <p className="mb-2 text-sm text-secondary-foreground"><strong>What works:</strong> {dna.hookBreakdown.whatWorks}</p>
                <p className="text-sm text-muted-foreground"><strong>Could improve:</strong> {dna.hookBreakdown.improvement}</p>
              </DNA_card>

              {/* Emotional Architecture */}
              <DNA_card title="Emotional Architecture">
                <div className="space-y-3">
                  {Object.entries(dna.emotionalArchitecture).map(([key, value], i) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-20 text-xs font-medium uppercase tracking-wide text-muted-foreground">{key}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${emotionColor(key)} transition-all duration-700`}
                          style={{ width: `${value}%`, transitionDelay: `${i * 80}ms` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </DNA_card>

              {/* Story Structure */}
              <DNA_card title="Story Structure">
                <div className="space-y-2">
                  {dna.storyStructure.map((section: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-primary/10 text-xs font-bold text-accent-primary">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{section.section}</p>
                        <p className="text-xs text-muted-foreground">{section.timing} — {section.purpose}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </DNA_card>

              {/* Caption DNA */}
              <DNA_card title="Caption DNA">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Structure</span><span className="font-medium">{dna.captionDNA.structure}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tone</span><span className="font-medium">{dna.captionDNA.tone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Persuasion</span><span className="font-medium">{dna.captionDNA.persuasionStyle}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CTA Type</span><span className="font-medium">{dna.captionDNA.ctaType}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Score</span><span className="font-mono font-bold text-accent-primary">{dna.captionDNA.score}/10</span></div>
                </div>
              </DNA_card>

              {/* Visual Style */}
              <DNA_card title="Visual Style">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Color Mood</span><span className="font-medium">{dna.visualStyle.colorMood}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Composition</span><span className="font-medium">{dna.visualStyle.composition}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Text Overlay</span><span className="font-medium">{dna.visualStyle.textOverlay}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Edit Style</span><span className="font-medium">{dna.visualStyle.editStyle}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Score</span><span className="font-mono font-bold text-accent-primary">{dna.visualStyle.score}/10</span></div>
                </div>
              </DNA_card>

              {/* Engagement Drivers */}
              <DNA_card title="Engagement Drivers">
                <ul className="space-y-2">
                  {dna.engagementDrivers.map((driver: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-secondary-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-status-success" />
                      {driver}
                    </li>
                  ))}
                </ul>
              </DNA_card>

              {/* Monetization */}
              <DNA_card title="Monetization Potential">
                <p className="text-sm leading-relaxed text-secondary-foreground">{dna.monetizationPotential}</p>
              </DNA_card>
            </div>

            {/* RIGHT: Clone Engine Panel */}
            <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-lg font-bold">Your Content Clones</h2>
                <p className="text-sm text-muted-foreground">5 original versions. Same strategy. Your voice.</p>

                <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
                  {clones.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveVersion(i)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        activeVersion === i
                          ? "bg-accent-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      V{c.versionNumber}
                    </button>
                  ))}
                </div>

                {clones[activeVersion] && (
                  <div className="mt-4 space-y-4 animate-in fade-in duration-150">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-accent-primary">{clones[activeVersion].angleLabel}</p>
                    </div>

                    <CloneField icon="🪝" label="HOOK" text={clones[activeVersion].hook} />
                    <CloneField icon="📐" label="ANGLE" text={clones[activeVersion].angle} />
                    <CloneField icon="📖" label="STORY STRUCTURE" text={clones[activeVersion].storyStructure} />
                    <CloneField icon="💬" label="CAPTION" text={clones[activeVersion].caption} />
                    <CloneField icon="👁" label="VISUAL DIRECTION" text={clones[activeVersion].visualDirection} />
                    <CloneField icon="📣" label="CTA" text={clones[activeVersion].cta} />

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleCopy(clones[activeVersion].caption)}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy All
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave}>
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DNA_card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-all hover:border-border-strong">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function AudiencePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm text-secondary-foreground">{value}</p>
    </div>
  );
}

function CloneField({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{icon} {label}</p>
      <p className="text-sm leading-relaxed text-secondary-foreground whitespace-pre-line">{text}</p>
    </div>
  );
}

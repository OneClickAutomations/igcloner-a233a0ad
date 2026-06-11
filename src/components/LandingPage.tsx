import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Check, Zap, Target, Copy, Star, Users } from "lucide-react";

const PLACEHOLDERS = [
  "instagram.com/reel/...",
  "instagram.com/p/...",
  "instagram.com/carousel/...",
];

export function LandingPage() {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex h-16 items-center justify-between border-b border-border px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">IGCloner</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#how-it-works" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
            How It Works
          </a>
          <a href="#pricing" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
            Pricing
          </a>
          <Link to="/auth">
            <Button variant="ghost" size="sm">Log In</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Try For Free
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="absolute inset-0 gradient-glow pointer-events-none" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Steal The Strategy.
            <br />
            <span className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
              Not The Content.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Paste any Instagram Reel, Carousel, or Post. Discover exactly why it works. Generate better versions in seconds.
          </p>

          {/* Hero Input */}
          <div className="mx-auto mt-10 max-w-xl">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
              <Sparkles className="ml-3 h-5 w-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                readOnly
                placeholder={PLACEHOLDERS[placeholderIndex]}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <Link to="/auth">
                <Button className="shrink-0 gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </Button>
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              No account needed to preview · 3 free analyses
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-border px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-center text-2xl font-bold mb-12">How It Works</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Link, title: "Paste URL", desc: "Drop any Instagram Reel, Post, or Carousel link" },
              { icon: Zap, title: "AI Reads The DNA", desc: "We deconstruct the hook, structure, and psychology" },
              { icon: Target, title: "See Why It Works", desc: "Understand the emotional and strategic mechanics" },
              { icon: Copy, title: "Get Better Versions", desc: "Generate 5 original clones with the same energy" },
            ].map((step, i) => (
              <div key={i} className="relative text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
                {i < 3 && (
                  <ArrowRight className="hidden lg:block absolute top-6 -right-4 h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-t border-border px-4 py-10">
        <div className="mx-auto max-w-[1100px] flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-muted" />
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Join 8,400+ creators</span> already cloning smarter
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-status-warning text-status-warning" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-center text-2xl font-bold mb-12">What You Get</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { title: "Content DNA", desc: "Understand the hook, structure, psychology, and engagement mechanics behind any post", icon: Target },
              { title: "Clone Engine", desc: "Get 5 original content variations inspired by the source — different angle, same energy", icon: Copy },
              { title: "Content Multiplier", desc: "Repurpose one post into Reels, Carousels, Captions, Threads, and more", icon: Zap },
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl border border-border bg-card p-6 transition-all hover:border-border-default hover:-translate-y-0.5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-center text-2xl font-bold mb-12">Pricing</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { name: "Free", price: "$0", desc: "Get started", features: ["3 total analyses", "1 clone version", "Basic DNA breakdown"], cta: "Get Started", popular: false },
              { name: "Creator", price: "$19", desc: "/month", features: ["50 analyses/month", "5 clone versions", "Content Multiplier", "Save projects", "Export PDF"], cta: "Start Creating", popular: true },
              { name: "Pro", price: "$49", desc: "/month", features: ["Unlimited analyses", "5 + Multiplier", "All formats", "Save projects", "Export PDF", "Priority AI"], cta: "Go Pro", popular: false },
            ].map((plan) => (
              <div key={plan.name} className={`relative rounded-xl border p-6 ${plan.popular ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </span>
                )}
                <h3 className="font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.desc}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-status-success shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="mt-6 block">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to clone smarter?</h2>
          <p className="text-muted-foreground mb-8">Start with 3 free analyses. No credit card required.</p>
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Try IGCloner Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto max-w-[1100px] flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">IGCloner</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 IGCloner. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Home, FileText, Mail, ShieldCheck, Cookie, Sparkles } from "lucide-react";

type LegalKind = "terms" | "privacy" | "cookies";

const KIND_META: Record<LegalKind, { icon: typeof FileText; label: string; blurb: string }> = {
  terms: {
    icon: FileText,
    label: "Terms of Service",
    blurb: "The rules of the road for using IG-Cloner — plain-spoken, but binding.",
  },
  privacy: {
    icon: ShieldCheck,
    label: "Privacy Policy",
    blurb: "What we collect, why we collect it, and the controls you have over it.",
  },
  cookies: {
    icon: Cookie,
    label: "Cookie Policy",
    blurb: "The small files that keep you signed in and the Service humming.",
  },
};

export function LegalLayout({
  title,
  updated,
  kind,
  children,
}: {
  title: string;
  updated: string;
  kind: LegalKind;
  children: ReactNode;
}) {
  const meta = KIND_META[kind];
  const KindIcon = meta.icon;
  const contentRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<{ id: string; text: string }[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // Build a TOC from h2s in the rendered content
  useEffect(() => {
    if (!contentRef.current) return;
    const h2s = Array.from(contentRef.current.querySelectorAll("h2")) as HTMLHeadingElement[];
    const entries = h2s.map((el) => {
      const text = el.textContent?.trim() ?? "";
      const id = slugify(text);
      el.id = id;
      return { id, text };
    });
    setToc(entries);

    const observer = new IntersectionObserver(
      (list) => {
        const visible = list
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: [0, 1] },
    );
    h2s.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [children]);

  const related = useMemo(
    () =>
      (["terms", "privacy", "cookies"] as LegalKind[])
        .filter((k) => k !== kind)
        .map((k) => ({ kind: k, ...KIND_META[k] })),
    [kind],
  );

  return (
    <div className="legal-root min-h-screen">
      {/* Ambient gradient blobs, matching landing page */}
      <div className="legal-bg" aria-hidden="true">
        <span className="legal-blueprint" />
        <span className="legal-blueprint legal-blueprint-accent" />
        <span className="legal-blob legal-blob-1" />
        <span className="legal-blob legal-blob-2" />
        <span className="legal-blob legal-blob-3" />
      </div>

      {/* Nav */}
      <header className="legal-nav">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-6">
          <Link to="/" className="legal-logo">IG<span className="legal-logo-grad">Cloner</span></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {(Object.keys(KIND_META) as LegalKind[]).map((k) => {
              const Icon = KIND_META[k].icon;
              const active = k === kind;
              return (
                <Link
                  key={k}
                  to={k === "terms" ? "/terms" : k === "privacy" ? "/privacy" : "/cookies"}
                  className={`legal-nav-link ${active ? "is-active" : ""}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {KIND_META[k].label.replace(" Policy", "").replace(" of Service", "")}
                </Link>
              );
            })}
          </nav>
          <Link to="/" className="legal-nav-cta">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to app
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-[1] pt-32 pb-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="legal-eyebrow">
            <Sparkles className="h-3 w-3" /> Legal
          </div>
          <div className="mt-4 flex items-start gap-5">
            <div className="legal-hero-icon">
              <KindIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="legal-hero-title">
                {title.split(" ").slice(0, -1).join(" ")}{" "}
                <span className="legal-grad-text">{title.split(" ").slice(-1)}</span>
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[color:var(--legal-text2)] sm:text-base">
                {meta.blurb}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="legal-chip">
                  <span className="legal-dot" /> Last updated {updated}
                </span>
                <a href="mailto:legal@igcloner.com" className="legal-chip legal-chip-link">
                  <Mail className="h-3 w-3" /> legal@igcloner.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <main className="relative z-[1] pb-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[240px_1fr]">
          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="legal-toc-title">On this page</p>
              <ul className="mt-3 space-y-0.5">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={`legal-toc-link ${activeId === item.id ? "is-active" : ""}`}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
              <Link to="/" className="legal-toc-top">
                <Home className="h-3 w-3" /> Back Home
              </Link>
            </div>
          </aside>

          {/* Content card */}
          <article className="legal-card">
            <div ref={contentRef} className="legal-prose">
              {children}
            </div>
          </article>
        </div>

        {/* Related */}
        <div className="mx-auto mt-14 max-w-6xl px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((r) => {
              const Icon = r.icon;
              return (
                <Link
                  key={r.kind}
                  to={r.kind === "terms" ? "/terms" : r.kind === "privacy" ? "/privacy" : "/cookies"}
                  className="legal-related"
                >
                  <div className="legal-related-icon">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[color:var(--legal-text)]">{r.label}</p>
                    <p className="mt-0.5 text-[13px] text-[color:var(--legal-text2)]">{r.blurb}</p>
                  </div>
                  <span className="legal-related-arrow">→</span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer — mirrors the landing page */}
      <footer className="legal-footer relative z-[1]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="legal-footer-grid">
            <div className="legal-footer-brand">
              <Link to="/" className="legal-logo">
                IG<span className="legal-logo-grad">Cloner</span>
              </Link>
              <p>
                The AI content intelligence platform for Instagram creators who want to grow smarter,
                not harder.
              </p>
            </div>
            <div className="legal-footer-col">
              <h4>Product</h4>
              <a href="/#features">Content DNA</a>
              <a href="/#features">Clone Engine</a>
              <a href="/#features">30-Day Calendar</a>
              <a href="/#pricing">Pricing</a>
            </div>
            <div className="legal-footer-col">
              <h4>Company</h4>
              <a href="/#about">About</a>
              <a href="/#blog">Blog</a>
              <a href="mailto:hello@igcloner.com">Contact</a>
            </div>
            <div className="legal-footer-col">
              <h4>Legal</h4>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/cookies">Cookie Policy</Link>
            </div>
          </div>
          <div className="legal-footer-bottom">
            <p>© {new Date().getFullYear()} IG-Cloner. All rights reserved.</p>
            <p className="legal-footer-tag">Steal the strategy. Not the content. ✦</p>
          </div>
        </div>
      </footer>

      <style>{legalStyles}</style>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const legalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');

  .legal-root {
    --legal-ig1:#F58529; --legal-ig2:#DD2A7B; --legal-ig3:#8134AF; --legal-ig4:#515BD4;
    --legal-grad: linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4);
    --legal-bg:#0a0a1a; --legal-bg2:#111128;
    --legal-card:#111128; --legal-border: rgba(255,255,255,0.08);
    --legal-text:#e8e8f0; --legal-text2:#b0b0c8; --legal-text3:#9090a8;
    --legal-accent:#F9A8D4;
    --legal-bp-line: rgba(255,255,255,0.04);
    --legal-bp-line-strong: rgba(255,255,255,0.06);
    --legal-bp-fade: linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%);
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #0a0a1a;
    color: var(--legal-text);
    position: relative;
    overflow-x: hidden;
  }

  .legal-bg { position: absolute; top: 0; left: 0; right: 0; height: 640px; pointer-events: none; overflow: hidden; z-index: 0; }
  .legal-blueprint {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, var(--legal-bp-line) 1px, transparent 1px),
      linear-gradient(to bottom, var(--legal-bp-line) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: var(--legal-bp-fade);
    opacity: 1;
  }
  .legal-blueprint-accent {
    background-image:
      linear-gradient(to right, var(--legal-bp-line-strong) 1px, transparent 1px),
      linear-gradient(to bottom, var(--legal-bp-line-strong) 1px, transparent 1px);
    background-size: 220px 220px;
    opacity: .9;
  }
  .legal-blob { position: absolute; border-radius: 50%; filter: blur(120px); opacity: .18; }
  .legal-blob-1 { width: 520px; height: 520px; background: var(--legal-ig1); top: -180px; right: -120px; }
  .legal-blob-2 { width: 460px; height: 460px; background: var(--legal-ig2); top: 20%; left: -160px; }
  .legal-blob-3 { width: 380px; height: 380px; background: var(--legal-ig4); bottom: -120px; right: 20%; opacity: .14; }

  .legal-nav {
    position: sticky; top: 0; z-index: 40;
    background: rgba(10,10,26,0.88);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--legal-border);
  }
  .legal-logo { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: -.04em; color: var(--legal-text); }
  .legal-logo-grad { background: var(--legal-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

  .legal-nav-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 999px;
    font-size: 13px; font-weight: 500; color: var(--legal-text2);
    transition: color .15s ease, background .15s ease;
  }
  .legal-nav-link:hover { color: var(--legal-accent); }
  .legal-nav-link.is-active {
    color: var(--legal-accent);
    background: linear-gradient(135deg, rgba(245,133,41,.14), rgba(221,42,123,.18));
  }

  .legal-nav-cta {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 10px;
    font-size: 13px; font-weight: 600; color: var(--legal-text);
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.05);
    transition: all .18s ease;
  }
  .legal-nav-cta:hover { border-color: rgba(244,114,182,0.45); color: var(--legal-accent); }

  .legal-eyebrow {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 999px;
    font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--legal-accent);
    background: linear-gradient(135deg, rgba(245,133,41,.16), rgba(221,42,123,.20));
    border: 1px solid rgba(244,114,182,.32);
  }

  .legal-hero-icon {
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    width: 56px; height: 56px; border-radius: 16px;
    background: var(--legal-grad); color: #fff;
    box-shadow: 0 10px 30px rgba(221,42,123,.28);
  }
  .legal-hero-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(30px, 4.6vw, 48px);
    font-weight: 900; letter-spacing: -.03em; line-height: 1.05;
    color: var(--legal-text);
  }
  .legal-grad-text {
    background: var(--legal-grad);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }

  .legal-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 11px; border-radius: 999px;
    font-size: 12px; font-weight: 500; color: var(--legal-text2);
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
  }
  .legal-chip-link { transition: color .15s ease, border-color .15s ease; }
  .legal-chip-link:hover { color: var(--legal-accent); border-color: rgba(244,114,182,0.45); }
  .legal-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.15);
  }

  .legal-toc-title {
    font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--legal-text3);
  }
  .legal-toc-link {
    display: block; padding: 7px 12px;
    border-left: 2px solid transparent;
    font-size: 13px; color: var(--legal-text2);
    transition: all .15s ease;
    border-radius: 0 8px 8px 0;
  }
  .legal-toc-link:hover { color: var(--legal-text); background: rgba(255,255,255,.05); }
  .legal-toc-link.is-active {
    color: var(--legal-accent); font-weight: 600;
    border-left-color: var(--legal-accent);
    background: linear-gradient(90deg, rgba(244,114,182,.12), transparent);
  }
  .legal-toc-top {
    margin-top: 16px;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; font-size: 12px; font-weight: 500;
    color: var(--legal-text2); border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.10); background: transparent;
    cursor: pointer; transition: all .15s ease;
  }
  .legal-toc-top:hover { color: var(--legal-accent); border-color: rgba(244,114,182,.4); }

  .legal-card {
    background: #111128;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: clamp(28px, 4vw, 48px);
    box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 80px rgba(0,0,0,.55);
  }

  .legal-prose { color: var(--legal-text); font-size: 15.5px; line-height: 1.72; }
  .legal-prose > p:first-child {
    font-size: 17px; color: var(--legal-text);
    padding-bottom: 22px; margin-bottom: 26px;
    border-bottom: 1px solid var(--legal-border);
  }
  .legal-prose h2 {
    font-family: 'Syne', sans-serif;
    font-size: 22px; font-weight: 800; letter-spacing: -.02em;
    color: var(--legal-text);
    margin: 40px 0 12px;
    scroll-margin-top: 96px;
    display: flex; align-items: baseline; gap: 12px;
  }
  .legal-prose h2::before {
    content: ""; display: inline-block; flex-shrink: 0;
    width: 4px; height: 20px; border-radius: 2px;
    background: var(--legal-grad);
    transform: translateY(2px);
  }
  .legal-prose h3 {
    font-family: 'Syne', sans-serif;
    font-size: 15px; font-weight: 700; color: var(--legal-text);
    margin: 22px 0 6px; letter-spacing: -.005em;
  }
  .legal-prose p { margin: 10px 0; color: var(--legal-text2); }
  .legal-prose p strong, .legal-prose li strong { color: var(--legal-text); font-weight: 600; }
  .legal-prose ul { list-style: none; padding: 0; margin: 12px 0; }
  .legal-prose li {
    position: relative; padding: 6px 0 6px 22px;
    color: var(--legal-text2);
  }
  .legal-prose li::before {
    content: ""; position: absolute; left: 4px; top: 15px;
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--legal-grad);
  }
  .legal-prose a {
    color: var(--legal-accent); font-weight: 500;
    text-decoration: none; border-bottom: 1px solid rgba(244,114,182,.45);
    transition: border-color .15s ease;
  }
  .legal-prose a:hover { border-bottom-color: var(--legal-accent); }

  .legal-related {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 20px;
    background: #111128;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    transition: all .18s ease;
  }
  .legal-related:hover {
    transform: translateY(-2px);
    border-color: rgba(244,114,182,.35);
    box-shadow: 0 12px 30px rgba(0,0,0,.5);
  }
  .legal-related-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; border-radius: 12px;
    background: linear-gradient(135deg, rgba(245,133,41,.16), rgba(221,42,123,.20));
    color: var(--legal-accent);
    flex-shrink: 0;
  }
  .legal-related-arrow {
    color: var(--legal-text3); font-size: 18px; transition: all .18s ease;
  }
  .legal-related:hover .legal-related-arrow {
    color: var(--legal-accent); transform: translateX(3px);
  }

  /* Footer — mirrors landing page grid */
  .legal-footer {
    background: rgba(10,10,26,0.75);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255,255,255,0.08);
    margin-top: 20px;
  }
  .legal-footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 48px;
  }
  .legal-footer-brand p {
    font-size: 14px; color: var(--legal-text3);
    margin-top: 12px; line-height: 1.6; max-width: 260px;
  }
  .legal-footer-col h4 {
    font-size: 13px; font-weight: 700; color: var(--legal-text);
    margin-bottom: 16px; letter-spacing: -0.005em;
  }
  .legal-footer-col a {
    display: block; font-size: 13px; color: var(--legal-text3);
    margin-bottom: 10px; transition: color .15s ease;
    text-decoration: none;
  }
  .legal-footer-col a:hover { color: var(--legal-accent); }
  .legal-footer-bottom {
    margin-top: 48px; padding-top: 24px;
    border-top: 1px solid var(--legal-border);
    display: flex; justify-content: space-between; align-items: center;
    gap: 16px; flex-wrap: wrap;
  }
  .legal-footer-bottom p { font-size: 13px; color: var(--legal-text3); margin: 0; }
  .legal-footer-tag { color: var(--legal-accent) !important; font-weight: 600; }

  @media (max-width: 820px) {
    .legal-footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
    .legal-footer-brand { grid-column: 1 / -1; }
  }

  @media (max-width: 768px) {
    .legal-nav-cta { display: none; }
    .legal-hero-icon { width: 44px; height: 44px; border-radius: 12px; }
  }
`;
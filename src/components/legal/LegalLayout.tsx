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
  .legal-root {
    --legal-ig1:#F58529; --legal-ig2:#DD2A7B; --legal-ig3:#8134AF; --legal-ig4:#515BD4;
    --legal-grad: linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4);
    --legal-bg:#FFFFFF; --legal-bg2:#F9F7FF;
    --legal-card:#FFFFFF; --legal-border: rgba(129,52,175,0.14);
    --legal-text:#0F0A1E; --legal-text2:#4A4060; --legal-text3:#8A7FA0;
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(180deg,#FFFFFF 0%,#F9F7FF 40%,#F3F0FF 100%);
    color: var(--legal-text);
    position: relative;
    overflow-x: hidden;
  }
  .legal-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
  .legal-blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .16; }
  .legal-blob-1 { width: 520px; height: 520px; background: var(--legal-ig1); top: -180px; right: -120px; }
  .legal-blob-2 { width: 460px; height: 460px; background: var(--legal-ig2); top: 20%; left: -160px; }
  .legal-blob-3 { width: 380px; height: 380px; background: var(--legal-ig4); bottom: -120px; right: 20%; opacity: .12; }

  .legal-nav {
    position: sticky; top: 0; z-index: 40;
    background: rgba(255,255,255,0.75);
    backdrop-filter: saturate(180%) blur(14px);
    -webkit-backdrop-filter: saturate(180%) blur(14px);
    border-bottom: 1px solid var(--legal-border);
  }
  .legal-logo { font-size: 20px; font-weight: 900; letter-spacing: -.04em; color: var(--legal-text); }
  .legal-logo-grad { background: var(--legal-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

  .legal-nav-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 999px;
    font-size: 13px; font-weight: 500; color: var(--legal-text2);
    transition: color .15s ease, background .15s ease;
  }
  .legal-nav-link:hover { color: var(--legal-ig2); }
  .legal-nav-link.is-active {
    color: var(--legal-ig2);
    background: linear-gradient(135deg, rgba(245,133,41,.08), rgba(221,42,123,.08));
  }

  .legal-nav-cta {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 10px;
    font-size: 13px; font-weight: 600; color: var(--legal-text);
    border: 1px solid var(--legal-border);
    background: rgba(255,255,255,0.6);
    transition: all .18s ease;
  }
  .legal-nav-cta:hover { border-color: rgba(221,42,123,0.4); color: var(--legal-ig2); }

  .legal-eyebrow {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 999px;
    font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--legal-ig2);
    background: linear-gradient(135deg, rgba(245,133,41,.10), rgba(221,42,123,.10));
    border: 1px solid rgba(221,42,123,.16);
  }

  .legal-hero-icon {
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    width: 56px; height: 56px; border-radius: 16px;
    background: var(--legal-grad); color: #fff;
    box-shadow: 0 10px 30px rgba(221,42,123,.28);
  }
  .legal-hero-title {
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
    background: rgba(255,255,255,0.7);
    border: 1px solid var(--legal-border);
  }
  .legal-chip-link { transition: color .15s ease, border-color .15s ease; }
  .legal-chip-link:hover { color: var(--legal-ig2); border-color: rgba(221,42,123,.35); }
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
  .legal-toc-link:hover { color: var(--legal-text); background: rgba(129,52,175,.04); }
  .legal-toc-link.is-active {
    color: var(--legal-ig2); font-weight: 600;
    border-left-color: var(--legal-ig2);
    background: linear-gradient(90deg, rgba(221,42,123,.06), transparent);
  }
  .legal-toc-top {
    margin-top: 16px;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; font-size: 12px; font-weight: 500;
    color: var(--legal-text3); border-radius: 999px;
    border: 1px solid var(--legal-border); background: transparent;
    cursor: pointer; transition: all .15s ease;
  }
  .legal-toc-top:hover { color: var(--legal-ig2); border-color: rgba(221,42,123,.35); }

  .legal-card {
    background: rgba(255,255,255,0.82);
    backdrop-filter: blur(10px);
    border: 1px solid var(--legal-border);
    border-radius: 24px;
    padding: clamp(28px, 4vw, 48px);
    box-shadow: 0 1px 2px rgba(15,10,30,.04), 0 20px 60px rgba(129,52,175,.08);
  }

  .legal-prose { color: var(--legal-text); font-size: 15.5px; line-height: 1.72; }
  .legal-prose > p:first-child {
    font-size: 17px; color: var(--legal-text);
    padding-bottom: 22px; margin-bottom: 26px;
    border-bottom: 1px solid var(--legal-border);
  }
  .legal-prose h2 {
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
    color: var(--legal-ig2); font-weight: 500;
    text-decoration: none; border-bottom: 1px solid rgba(221,42,123,.3);
    transition: border-color .15s ease;
  }
  .legal-prose a:hover { border-bottom-color: var(--legal-ig2); }

  .legal-related {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 20px;
    background: rgba(255,255,255,0.7);
    border: 1px solid var(--legal-border);
    border-radius: 16px;
    transition: all .18s ease;
  }
  .legal-related:hover {
    transform: translateY(-2px);
    border-color: rgba(221,42,123,.3);
    box-shadow: 0 12px 30px rgba(129,52,175,.10);
  }
  .legal-related-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; border-radius: 12px;
    background: linear-gradient(135deg, rgba(245,133,41,.10), rgba(221,42,123,.10));
    color: var(--legal-ig2);
    flex-shrink: 0;
  }
  .legal-related-arrow {
    color: var(--legal-text3); font-size: 18px; transition: all .18s ease;
  }
  .legal-related:hover .legal-related-arrow {
    color: var(--legal-ig2); transform: translateX(3px);
  }

  @media (max-width: 768px) {
    .legal-nav-cta { display: none; }
    .legal-hero-icon { width: 44px; height: 44px; border-radius: 12px; }
  }
`;
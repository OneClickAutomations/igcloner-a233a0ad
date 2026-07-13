import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link to="/" className="text-lg font-bold tracking-tight">
            IG-Cloner
          </Link>
          <nav className="flex gap-5 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/cookies" className="hover:text-foreground">Cookies</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>

        <div className="legal-prose mt-10 space-y-6 text-[15px] leading-relaxed text-foreground/90">
          {children}
        </div>

        <div className="mt-16 flex flex-wrap gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to IG-Cloner</Link>
          <span className="ml-auto">© {new Date().getFullYear()} IG-Cloner</span>
        </div>
      </main>

      <style>{`
        .legal-prose h2 { font-size: 1.25rem; font-weight: 700; margin-top: 2rem; margin-bottom: .5rem; letter-spacing: -0.01em; }
        .legal-prose h3 { font-size: 1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: .25rem; }
        .legal-prose p { margin: .5rem 0; }
        .legal-prose ul { list-style: disc; padding-left: 1.25rem; margin: .5rem 0; }
        .legal-prose li { margin: .25rem 0; }
        .legal-prose a { color: hsl(var(--primary)); text-decoration: underline; }
        .legal-prose strong { font-weight: 600; }
      `}</style>
    </div>
  );
}
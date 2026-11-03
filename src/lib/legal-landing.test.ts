import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const landing = readFileSync(new URL("../assets/landing.html", import.meta.url), "utf8");
const legal = readFileSync(new URL("../components/legal/LegalLayout.tsx", import.meta.url), "utf8");

function blockAfter(source: string, marker: string, closer = "</div>") {
  const start = source.indexOf(marker);
  expect(start, `missing marker: ${marker}`).toBeGreaterThan(-1);
  const rest = source.slice(start + marker.length);
  const end = rest.indexOf(closer);
  expect(end, `missing closer after: ${marker}`).toBeGreaterThan(-1);
  return rest.slice(0, end);
}

describe("landing footer company links", () => {
  const company = blockAfter(landing, "<h5>Company</h5>");
  const bottom = blockAfter(landing, 'class="footer-links"');

  it("has no dead href=# links in the footer", () => {
    expect(company).not.toContain('href="#"');
    expect(bottom).not.toContain('href="#"');
  });

  it("points Company links at real destinations", () => {
    expect(company).toContain('<a href="/#about" target="_parent">About</a>');
    expect(company).toContain('<a href="/privacy" target="_parent">Privacy</a>');
    expect(company).toContain('<a href="/terms" target="_parent">Terms</a>');
    expect(company).toContain('<a href="mailto:hello@igcloner.com">Contact</a>');
  });

  it("points the footer-bottom links at real destinations", () => {
    expect(bottom).toContain('<a href="/privacy" target="_parent">Privacy</a>');
    expect(bottom).toContain('<a href="/terms" target="_parent">Terms</a>');
    expect(bottom).toContain('<a href="mailto:hello@igcloner.com">Contact</a>');
  });
});

describe("legal pages use the landing dark navy theme", () => {
  it("loads Syne and Inter", () => {
    expect(legal).toContain(
      "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');",
    );
  });

  it("is dark-first with a single set of dark tokens", () => {
    expect(legal).not.toContain(":root.dark");
    expect(legal).toContain("--legal-bg:#0a0a1a;");
    expect(legal).toContain("--legal-bg2:#111128;");
    expect(legal).toContain("--legal-card:#111128;");
    expect(legal).toContain("--legal-border: rgba(255,255,255,0.08);");
    expect(legal).toContain("--legal-text:#e8e8f0;");
    expect(legal).toContain("--legal-text2:#b0b0c8;");
    expect(legal).toContain("--legal-text3:#9090a8;");
    expect(legal).toContain("--legal-bp-line: rgba(255,255,255,0.04);");
    expect(legal).toContain("--legal-bp-line-strong: rgba(255,255,255,0.06);");
    expect(legal).toContain("background: #0a0a1a;");
  });

  it("keeps the IG gradient accent exactly as before", () => {
    expect(legal).toContain("--legal-grad: linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4);");
  });

  it("applies Syne to the logo, hero title and prose headings", () => {
    const syneRules = [
      /\.legal-logo \{ font-family: 'Syne', sans-serif;/,
      /\.legal-hero-title \{[\s\S]*?font-family: 'Syne', sans-serif;/,
      /\.legal-prose h2 \{[\s\S]*?font-family: 'Syne', sans-serif;/,
      /\.legal-prose h3 \{[\s\S]*?font-family: 'Syne', sans-serif;/,
    ];
    for (const rule of syneRules) expect(legal).toMatch(rule);
  });

  it("uses the dark nav, card and prose text treatments", () => {
    expect(legal).toMatch(/\.legal-nav \{[\s\S]*?background: rgba\(10,10,26,0\.88\);/);
    expect(legal).toMatch(/\.legal-nav \{[\s\S]*?backdrop-filter: blur\(14px\);/);
    expect(legal).toMatch(/\.legal-card \{[\s\S]*?background: #111128;/);
    expect(legal).toMatch(/\.legal-prose p \{[^}]*color: var\(--legal-text2\);/);
    expect(legal).toMatch(/\.legal-prose li \{[\s\S]*?color: var\(--legal-text2\);/);
    expect(legal).toMatch(/\.legal-prose h2 \{[\s\S]*?color: var\(--legal-text\);/);
  });
});

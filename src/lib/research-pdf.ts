import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Palette (matches redesigned dark report) ─────────────────────────────
const C = {
  bg: [13, 13, 26] as [number, number, number],           // #0D0D1A page background
  panel: [22, 22, 40] as [number, number, number],        // #161628 cards / stripes
  panelAlt: [28, 28, 48] as [number, number, number],     // #1C1C30
  border: [40, 40, 60] as [number, number, number],       // subtle divider
  ink: [255, 255, 255] as [number, number, number],
  sub: [160, 160, 190] as [number, number, number],       // muted body
  faint: [110, 110, 140] as [number, number, number],     // labels / captions
  // gradient stops (orange → pink → purple → blue)
  g1: [255, 155, 65] as [number, number, number],
  g2: [221, 42, 123] as [number, number, number],
  g3: [129, 52, 175] as [number, number, number],
  g4: [64, 93, 230] as [number, number, number],
  orange: [255, 155, 65] as [number, number, number],
  pink: [221, 42, 123] as [number, number, number],
  purple: [129, 52, 175] as [number, number, number],
  blue: [64, 93, 230] as [number, number, number],
  green: [16, 185, 129] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  rose: [244, 63, 94] as [number, number, number],
};

const A4 = { w: 210, h: 297 };
const M = { x: 16, top: 22, bottom: 20 };

function arr(v: unknown): any[] { return Array.isArray(v) ? v : []; }
function shortText(s?: string, n = 60) { if (!s) return ""; return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }

// ─── Public API ───────────────────────────────────────────────────────────
export function exportResearchPdf(report: any, ideas: any[] = []) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const dna = (report?.dna_report ?? {}) as any;
  const subject = String(report?.subject ?? "Research Report");
  const mode = String(report?.mode ?? "");
  const score = Number(report?.opportunity_score ?? dna?.opportunityScore ?? 0) || 0;
  const perf = dna?.performanceMetrics ?? {};
  const comp = dna?.competitivePosition ?? {};
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  // Derive header meta
  const displayAccount = mode === "competitor" && !subject.startsWith("@") ? `@${subject}` : subject;
  const analysisLabel =
    mode === "competitor" ? "Competitor Intel" :
    mode === "niche"      ? "Niche Report"     :
    mode === "topic"      ? "Topic Report"     : "Content Intelligence";
  const nicheLabel = String(dna?.profileSummary?.businessCategory || dna?.audienceProfile?.who || "Content").split(/[,.]/)[0].trim().slice(0, 24) || "Content";

  // Derive KPIs
  const competitionLevel = String(comp?.competitionLevel || inferCompetition(score)).toUpperCase();
  const cadence = String(dna?.postingFrequency || dna?.postingStrategy?.frequency || "IRREGULAR").split(/[.,–—]/)[0].trim().toUpperCase().slice(0, 14) || "IRREGULAR";
  const engagement = String(perf?.engagementRate ?? "—");
  const gaps = arr(dna?.missedOpportunities).length || arr(comp?.contentGaps).length || arr(dna?.growthOpportunities).length || 0;

  // ── Cover ─────────────────────────────────────────────────────────────
  drawCover(doc, {
    account: displayAccount, date: dateStr, analysis: analysisLabel, niche: nicheLabel,
    score, summary: dna?.executiveSummary ?? comp?.opportunityReasoning ?? "",
    competition: competitionLevel, cadence, engagement, gaps,
  });

  // ── Executive Summary ────────────────────────────────────────────────
  startPage(doc, "01", "OVERVIEW", "Executive Summary");
  let y = M.top + 34;
  y = paragraph(doc, dna?.executiveSummary || "A structured analysis of audience, hooks, cadence, and growth opportunities for this account.", y, C.sub);
  y += 4;
  const summaryPoints = buildSummaryPoints(dna);
  for (const pt of summaryPoints) {
    y = summaryBullet(doc, pt.title, pt.body, y);
  }

  // ── Audience Intelligence ────────────────────────────────────────────
  const audience = dna?.audienceProfile ?? {};
  const aud = dna?.audienceIntelligence ?? {};
  startPage(doc, "02", "AUDIENCE", "Audience Intelligence");
  y = M.top + 34;
  y = paragraph(doc, "Understanding who this account speaks to — and what they actually want — is the foundation of any content strategy that outperforms it.", y, C.sub);
  y += 4;
  y = subhead(doc, "Who they are", y, C.g1);
  y = twoColBullets(doc, splitPairs(audience?.who || aud?.primaryAudience || ""), y);
  y = subhead(doc, "Core desires", y + 2, C.g2);
  y = bulletCol(doc, arr(audience?.desires).length ? arr(audience.desires) : arr(aud?.desiresAddressed), y, C.g2);
  y = subhead(doc, "Pain points to target in your content", y + 2, C.g3);
  y = painPointGrid(doc, arr(audience?.painPoints).length ? arr(audience.painPoints) : arr(aud?.painPointsAddressed), y);

  // ── Content DNA ──────────────────────────────────────────────────────
  startPage(doc, "03", "CONTENT", "Content DNA Analysis");
  y = M.top + 34;
  y = paragraph(doc, "How the account communicates — the hooks, structure, and voice that define its content fingerprint.", y, C.sub);
  y += 4;
  y = subhead(doc, "Proven hook patterns", y, C.g2);
  const hooks = (arr(dna?.hookAnalysis?.provenHooks).length ? arr(dna?.hookAnalysis?.provenHooks).map((h: any) => ({
    type: h?.hookType, label: h?.whyItWorked, quote: h?.actualOpeningLine,
  })) : arr(dna?.commonHooks).map((h: any) => ({ type: h?.pattern, label: "", quote: h?.example })));
  for (const h of hooks.slice(0, 4)) y = hookCard(doc, h, y);

  y = subhead(doc, "Caption anatomy", y + 2, C.g3);
  const cs = dna?.captionStructure ?? {};
  autoTable(doc, {
    startY: y,
    margin: { left: M.x, right: M.x },
    theme: "plain",
    body: [
      ["Opening Style", cs.openingStyle || dna?.hookAnalysis?.dominantHookTypes?.join(", ") || "—"],
      ["Body Structure", cs.typicalLength || dna?.hookAnalysis?.captionStructure || "—"],
      ["Brand Voice", dna?.brandVoice || cs?.tone || "—"],
      ["CTA Pattern", cs.ctaStyle || (arr(dna?.ctaPatterns).join(", ")) || "—"],
      ["Length", cs.typicalLength || dna?.hookAnalysis?.captionLengthPattern || "—"],
    ],
    styles: { fontSize: 9, cellPadding: { top: 3, right: 3, bottom: 3, left: 4 }, textColor: C.sub, fillColor: C.panel, lineColor: C.border, lineWidth: 0.1, valign: "top" },
    columnStyles: { 0: { cellWidth: 44, fontStyle: "bold", textColor: C.ink, fillColor: C.panelAlt } },
    didDrawPage: () => pageChrome(doc, "Content DNA Analysis"),
  });

  // ── Strategy: Opportunity Cards ──────────────────────────────────────
  startPage(doc, "04", "STRATEGY", "Content Gap & Opportunity Analysis");
  y = M.top + 34;
  y = paragraph(doc, "These are the specific opportunities this account is leaving unclaimed. Each one is actionable today.", y, C.sub);
  y += 4;
  const opportunities = buildOpportunities(dna);
  const oppColors = [C.orange, C.pink, C.purple, C.blue, C.green, C.amber];
  opportunities.forEach((op, i) => {
    y = opportunityCard(doc, i + 1, op.title, op.problem, op.action, oppColors[i % oppColors.length], y);
  });

  // ── Action Plan ──────────────────────────────────────────────────────
  startPage(doc, "05", "ACTION PLAN", "30-Day Outperform Strategy");
  y = M.top + 34;
  y = paragraph(doc, "A specific, sequenced plan to outperform this account within 30 days using IGCloner's clone-and-improve workflow.", y, C.sub);
  y += 4;
  const weeks = buildWeeks(dna, subject);
  const weekColors = [C.orange, C.pink, C.purple, C.blue];
  weeks.forEach((w, i) => {
    y = weekBlock(doc, `WEEK ${i + 1}`, w.title, w.bullets, weekColors[i], y);
  });

  // ── Distribution (Hashtags) ──────────────────────────────────────────
  startPage(doc, "06", "DISTRIBUTION", "Hashtag Strategy");
  y = M.top + 34;
  y = paragraph(doc, "A tiered hashtag strategy built for this specific niche. Use a mix of all three tiers on every post for maximum discovery.", y, C.sub);
  y += 4;
  y = hashtagTiers(doc, dna, y);

  // ── Content Opportunity Engine (ideas) ───────────────────────────────
  if (ideas.length) {
    startPage(doc, "07", "IDEAS", "Content Opportunity Engine");
    y = M.top + 34;
    y = paragraph(doc, `${ideas.length} ranked ideas grounded in this research, ready to route into Clone Studio.`, y, C.sub);
    y += 2;
    autoTable(doc, {
      startY: y,
      margin: { left: M.x, right: M.x, top: M.top + 14, bottom: M.bottom },
      theme: "plain",
      head: [["#", "Title", "Format", "Hook", "Viral", "Conf."]],
      body: ideas.map((i: any, idx: number) => [
        String(idx + 1),
        String(i?.title ?? ""),
        String(i?.format ?? ""),
        shortText(String(i?.hook ?? ""), 90),
        String(i?.virality_score ?? "—"),
        String(i?.confidence_score ?? "—"),
      ]),
      styles: { fontSize: 8, cellPadding: 2.2, textColor: C.sub, fillColor: C.bg, lineColor: C.border, lineWidth: 0.1, valign: "top" },
      headStyles: { fillColor: C.panelAlt, textColor: C.ink, fontStyle: "bold" },
      alternateRowStyles: { fillColor: C.panel },
      columnStyles: {
        0: { cellWidth: 8, halign: "center", textColor: C.faint },
        1: { cellWidth: 48, fontStyle: "bold", textColor: C.ink },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 70 },
        4: { cellWidth: 14, halign: "center", textColor: C.ink },
        5: { cellWidth: 14, halign: "center", textColor: C.ink },
      },
      didDrawPage: () => pageChrome(doc, "Content Opportunity Engine"),
    });
  }

  paginate(doc);
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  doc.save(`igcloner-intel-${slug || "report"}.pdf`);
}

// ─── Cover ────────────────────────────────────────────────────────────────
function drawCover(
  doc: jsPDF,
  o: { account: string; date: string; analysis: string; niche: string; score: number; summary: string;
       competition: string; cadence: string; engagement: string; gaps: number },
) {
  pageBg(doc);
  cornerOrb(doc);
  // Top gradient accent bar
  gradientBar(doc, M.x, M.top - 4, 62, 1.6);

  // Brand mark
  setFont(doc, 12, "bold", C.ink);
  doc.text("IGCloner", M.x, M.top + 6);
  setFont(doc, 8, "bold", C.faint);
  doc.text("CONTENT INTELLIGENCE REPORT", M.x, M.top + 11);

  // Huge title — 3 lines. Middle line pink (or gradient stops).
  const title = titleFromMode(o.analysis);
  setFont(doc, 44, "bold", C.ink);
  doc.text(title.top, M.x, M.top + 60);
  setFont(doc, 44, "bold", C.pink);
  doc.text(title.mid, M.x, M.top + 78);
  setFont(doc, 44, "bold", C.ink);
  doc.text(title.bot, M.x, M.top + 96);

  // Divider
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.line(M.x, M.top + 108, A4.w - M.x, M.top + 108);

  // Meta row (4 columns)
  const metaY = M.top + 116;
  const cols = [
    { label: "ACCOUNT", value: o.account },
    { label: "REPORT DATE", value: o.date },
    { label: "ANALYSIS TYPE", value: o.analysis },
    { label: "NICHE", value: o.niche },
  ];
  const colW = (A4.w - M.x * 2) / cols.length;
  cols.forEach((c, i) => {
    const x = M.x + i * colW;
    setFont(doc, 8, "bold", C.faint);
    doc.text(c.label, x, metaY);
    setFont(doc, 11, "bold", C.ink);
    doc.text(shortText(c.value, 22), x, metaY + 6);
  });

  // Opportunity Score card
  const cardY = metaY + 16;
  const cardH = 46;
  doc.setFillColor(...C.panel);
  doc.roundedRect(M.x, cardY, A4.w - M.x * 2, cardH, 2.5, 2.5, "F");

  // Score ring (left)
  const cx = M.x + 22;
  const cy = cardY + cardH / 2;
  scoreRing(doc, cx, cy, 15, o.score);

  // Score copy (right of ring)
  const tx = cx + 22;
  setFont(doc, 8, "bold", C.faint);
  doc.text("OPPORTUNITY SCORE", tx, cardY + 12);
  setFont(doc, 20, "bold", C.orange);
  doc.text(`${o.score} / 100`, tx, cardY + 22);
  setFont(doc, 9, "normal", C.sub);
  const lines = doc.splitTextToSize(o.summary || "Analysis complete — see interior pages for full breakdown.", A4.w - tx - M.x - 4);
  doc.text(lines.slice(0, 3), tx, cardY + 30);

  // KPI band
  const kpiY = cardY + cardH + 10;
  const kpiH = 22;
  const kpiW = (A4.w - M.x * 2) / 4;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(M.x, kpiY, A4.w - M.x * 2, kpiH, 2, 2, "S");
  const kpis = [
    { label: "COMPETITION LEVEL", value: o.competition, color: C.rose },
    { label: "POSTING CADENCE", value: o.cadence, color: C.amber },
    { label: "AVG ENGAGEMENT", value: o.engagement, color: C.rose },
    { label: "CONTENT GAPS", value: `${o.gaps} FOUND`, color: C.green },
  ];
  kpis.forEach((k, i) => {
    const x = M.x + i * kpiW;
    if (i > 0) {
      doc.setDrawColor(...C.border);
      doc.line(x, kpiY + 3, x, kpiY + kpiH - 3);
    }
    setFont(doc, 7, "bold", C.faint);
    doc.text(k.label, x + kpiW / 2, kpiY + 7, { align: "center" });
    setFont(doc, 13, "bold", k.color);
    doc.text(shortText(k.value, 14), x + kpiW / 2, kpiY + 16, { align: "center" });
  });

  // Footer note
  setFont(doc, 8, "normal", C.faint);
  doc.text("This report was generated by IGCloner. Data sourced from public Instagram profile signals. For internal use only.", M.x, A4.h - 14);
}

function titleFromMode(analysis: string) {
  const a = analysis.toLowerCase();
  if (a.includes("competitor")) return { top: "Deep-Dive", mid: "Competitor", bot: "Intelligence" };
  if (a.includes("niche"))      return { top: "Niche",     mid: "Content",    bot: "Intelligence" };
  if (a.includes("topic"))      return { top: "Topic",     mid: "Signal",     bot: "Intelligence" };
  return { top: "Content", mid: "Intelligence", bot: "Report" };
}

// ─── Page chrome / headers ────────────────────────────────────────────────
function pageBg(doc: jsPDF) {
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, A4.w, A4.h, "F");
}

function cornerOrb(doc: jsPDF) {
  // decorative purple orb (top right)
  doc.setFillColor(28, 22, 56);
  doc.circle(A4.w + 8, -4, 26, "F");
  doc.setFillColor(45, 32, 78);
  doc.circle(A4.w - 4, -12, 14, "F");
}

function pageChrome(doc: jsPDF, _title: string) {
  pageBg(doc);
  cornerOrb(doc);
}

function startPage(doc: jsPDF, num: string, section: string, title: string) {
  doc.addPage();
  pageChrome(doc, title);
  // section label
  setFont(doc, 8, "bold", C.faint);
  doc.text(`${num} / ${section}`, M.x, M.top + 4);
  // title
  setFont(doc, 22, "bold", C.ink);
  doc.text(title, M.x, M.top + 14);
  // underline
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.line(M.x, M.top + 18, A4.w - M.x, M.top + 18);
}

function paginate(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i === 1) continue;
    setFont(doc, 8, "normal", C.faint);
    doc.text(`IGCloner  ·  Content Intelligence Report  ·  Page ${i}`, A4.w / 2, A4.h - 8, { align: "center" });
  }
}

// ─── Building blocks ──────────────────────────────────────────────────────
function setFont(doc: jsPDF, size: number, style: "normal" | "bold" | "italic" = "normal", color: [number, number, number] = C.ink) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

function ensure(doc: jsPDF, y: number, need: number, title: string): number {
  if (y + need > A4.h - M.bottom) {
    doc.addPage();
    pageChrome(doc, title);
    return M.top + 6;
  }
  return y;
}

function paragraph(doc: jsPDF, text: string, y: number, color = C.sub): number {
  if (!text) return y;
  setFont(doc, 10, "normal", color);
  const lines = doc.splitTextToSize(text, A4.w - M.x * 2);
  for (const line of lines) {
    y = ensure(doc, y, 5.5, "");
    doc.text(line, M.x, y);
    y += 5;
  }
  return y + 2;
}

function subhead(doc: jsPDF, title: string, y: number, accent = C.pink): number {
  y = ensure(doc, y, 10, title);
  // small accent dot
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(M.x, y - 2.6, 2, 2.6, "F");
  setFont(doc, 9, "bold", C.faint);
  doc.text(title.toUpperCase(), M.x + 4, y);
  return y + 5;
}

function summaryBullet(doc: jsPDF, title: string, body: string, y: number): number {
  const w = A4.w - M.x * 2;
  setFont(doc, 11, "bold", C.ink);
  const titleLines = doc.splitTextToSize(title, w - 10);
  setFont(doc, 10, "normal", C.sub);
  const bodyLines = doc.splitTextToSize(body, w - 10);
  const need = titleLines.length * 5.5 + bodyLines.length * 5 + 6;
  y = ensure(doc, y, need, "");
  // square marker
  doc.setFillColor(...C.pink);
  doc.rect(M.x, y - 1.6, 2.4, 2.4, "F");
  setFont(doc, 11, "bold", C.ink);
  doc.text(titleLines, M.x + 8, y);
  let ny = y + titleLines.length * 5.5;
  setFont(doc, 10, "normal", C.sub);
  doc.text(bodyLines, M.x + 8, ny + 0.5);
  return ny + bodyLines.length * 5 + 4;
}

function bulletCol(doc: jsPDF, items: unknown[], y: number, accent = C.pink): number {
  setFont(doc, 10, "normal", C.sub);
  for (const raw of items) {
    const text = String(raw ?? "").trim();
    if (!text) continue;
    const lines = doc.splitTextToSize(text, A4.w - M.x * 2 - 8);
    y = ensure(doc, y, lines.length * 5 + 2, "");
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(M.x, y - 1.8, 2.2, 2.2, "F");
    setFont(doc, 10, "normal", C.sub);
    doc.text(lines, M.x + 6, y);
    y += lines.length * 5 + 1.2;
  }
  return y + 2;
}

function twoColBullets(doc: jsPDF, items: [string, string][], y: number): number {
  if (!items.length) return y;
  const colW = (A4.w - M.x * 2 - 6) / 2;
  const lineH = 5.5;
  for (let i = 0; i < items.length; i += 2) {
    const rowItems = [items[i], items[i + 1]].filter(Boolean);
    // compute row height
    let rowH = 0;
    rowItems.forEach(([label, val]) => {
      const l1 = doc.splitTextToSize(label, colW - 4);
      const l2 = doc.splitTextToSize(val, colW - 4);
      rowH = Math.max(rowH, l1.length * lineH + l2.length * 4.5 + 4);
    });
    y = ensure(doc, y, rowH, "");
    rowItems.forEach(([label, val], idx) => {
      const x = M.x + idx * (colW + 6);
      setFont(doc, 10, "bold", C.ink);
      const labelLines = doc.splitTextToSize(label, colW - 4);
      doc.text(labelLines, x, y);
      setFont(doc, 9, "normal", C.sub);
      const valLines = doc.splitTextToSize(val, colW - 4);
      doc.text(valLines, x, y + labelLines.length * lineH);
    });
    y += rowH + 1;
  }
  return y + 2;
}

function painPointGrid(doc: jsPDF, items: unknown[], y: number): number {
  const list = items.map((i) => String(i ?? "").trim()).filter(Boolean).slice(0, 6);
  if (!list.length) return y;
  const cols = 2;
  const gap = 4;
  const cardW = (A4.w - M.x * 2 - gap * (cols - 1)) / cols;
  const cardH = 26;
  for (let i = 0; i < list.length; i += cols) {
    y = ensure(doc, y, cardH + gap, "");
    for (let j = 0; j < cols && i + j < list.length; j++) {
      const x = M.x + j * (cardW + gap);
      const text = list[i + j];
      doc.setFillColor(...C.panel);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
      // left accent
      doc.setFillColor(...C.pink);
      doc.rect(x, y, 1.5, cardH, "F");
      const [title, ...rest] = text.split(/[:\-—]\s?/);
      setFont(doc, 10, "bold", C.ink);
      doc.text(shortText(title, 34), x + 5, y + 8);
      setFont(doc, 9, "normal", C.sub);
      const body = rest.length ? rest.join(" — ") : "";
      const lines = doc.splitTextToSize(body || " ", cardW - 8);
      doc.text(lines.slice(0, 2), x + 5, y + 14);
    }
    y += cardH + gap;
  }
  return y + 2;
}

function hookCard(doc: jsPDF, h: { type?: string; label?: string; quote?: string }, y: number): number {
  if (!h?.quote && !h?.type) return y;
  const w = A4.w - M.x * 2;
  const quote = String(h.quote ?? "");
  const quoteLines = doc.splitTextToSize(`"${quote}"`, w - 12);
  const cardH = 14 + quoteLines.length * 4.4 + 6;
  y = ensure(doc, y, cardH + 3, "");
  doc.setFillColor(...C.panel);
  doc.roundedRect(M.x, y, w, cardH, 2, 2, "F");
  // gradient accent stripe (top)
  gradientBar(doc, M.x + 2, y + 2, 30, 1);
  setFont(doc, 10, "bold", C.ink);
  doc.text(String(h.type ?? "Hook").toUpperCase(), M.x + 5, y + 8);
  setFont(doc, 8, "bold", C.faint);
  doc.text(String(h.label ?? "").slice(0, 60), M.x + 5, y + 12.5);
  setFont(doc, 9, "italic", C.sub);
  doc.text(quoteLines, M.x + 6, y + 18);
  return y + cardH + 3;
}

function opportunityCard(doc: jsPDF, n: number, title: string, problem: string, action: string, accent: [number, number, number], y: number): number {
  const w = A4.w - M.x * 2;
  setFont(doc, 10, "normal", C.sub);
  const pLines = doc.splitTextToSize(problem || "—", w - 12);
  const aLines = doc.splitTextToSize(action || "—", w - 12);
  const cardH = 16 + pLines.length * 5 + 8 + aLines.length * 5 + 8;
  y = ensure(doc, y, cardH + 4, "");
  // panel
  doc.setFillColor(...C.panel);
  doc.roundedRect(M.x, y, w, cardH, 2, 2, "F");
  // right accent stripe
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(M.x + w - 2, y + 2, 1.5, cardH - 4, 0.7, 0.7, "F");
  // Big number
  setFont(doc, 22, "bold", accent);
  doc.text(String(n).padStart(2, "0"), M.x + 6, y + 12);
  // Title
  setFont(doc, 12, "bold", C.ink);
  doc.text(shortText(title, 78), M.x + 22, y + 10);
  // Problem label + body
  setFont(doc, 8, "bold", C.faint);
  doc.text("THE PROBLEM", M.x + 6, y + 20);
  setFont(doc, 10, "normal", C.sub);
  doc.text(pLines, M.x + 6, y + 25);
  const midY = y + 25 + pLines.length * 5 + 3;
  setFont(doc, 8, "bold", accent);
  doc.text("YOUR ACTION STEP", M.x + 6, midY);
  setFont(doc, 10, "normal", C.sub);
  doc.text(aLines, M.x + 6, midY + 5);
  return y + cardH + 4;
}

function weekBlock(doc: jsPDF, week: string, title: string, bullets: string[], accent: [number, number, number], y: number): number {
  const w = A4.w - M.x * 2;
  setFont(doc, 10, "normal", C.sub);
  const bulletLines = bullets.map((b) => doc.splitTextToSize(b, w - 62));
  const totalBulletH = bulletLines.reduce((s, l) => s + l.length * 5 + 2, 0);
  const cardH = Math.max(30, 14 + totalBulletH + 6);
  y = ensure(doc, y, cardH + 6, "");
  // top gradient/accent line
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.8);
  doc.line(M.x, y, A4.w - M.x, y);
  // panel
  doc.setFillColor(...C.panel);
  doc.roundedRect(M.x, y + 1.4, w, cardH, 2, 2, "F");
  // week label + title (left column)
  setFont(doc, 7.5, "bold", accent);
  doc.text(week, M.x + 6, y + 10);
  setFont(doc, 12, "bold", C.ink);
  const titleLines = doc.splitTextToSize(title, 46);
  doc.text(titleLines, M.x + 6, y + 16);
  // bullets (right column)
  let by = y + 10;
  for (let i = 0; i < bullets.length; i++) {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(M.x + 58, by - 2, 2.2, 2.2, "F");
    setFont(doc, 10, "normal", C.sub);
    doc.text(bulletLines[i], M.x + 63, by);
    by += bulletLines[i].length * 5 + 2;
  }
  return y + cardH + 6;
}

function hashtagTiers(doc: jsPDF, dna: any, y: number): number {
  const tiers = buildHashtagTiers(dna);
  const w = A4.w - M.x * 2;
  const colW = (w - 6) / 3;
  const cardH = 90;
  y = ensure(doc, y, cardH + 20, "");
  const labels = [
    { name: "TIER 1", sub: "Broad Reach", note: "5M+ posts", color: C.orange },
    { name: "TIER 2", sub: "Niche Authority", note: "500K – 5M posts", color: C.pink },
    { name: "TIER 3", sub: "Community", note: "Under 500K posts", color: C.purple },
  ];
  labels.forEach((l, i) => {
    const x = M.x + i * (colW + 3);
    doc.setFillColor(...C.panel);
    doc.roundedRect(x, y, colW, cardH, 2, 2, "F");
    // color band
    doc.setFillColor(l.color[0], l.color[1], l.color[2]);
    doc.rect(x, y, colW, 1.8, "F");
    setFont(doc, 9, "bold", l.color);
    doc.text(l.name, x + 5, y + 8);
    setFont(doc, 11, "bold", C.ink);
    doc.text(l.sub, x + 5, y + 14);
    setFont(doc, 8, "normal", C.faint);
    doc.text(l.note, x + 5, y + 19);
    setFont(doc, 9, "normal", C.sub);
    const tags = tiers[i] || [];
    const tagText = tags.length ? tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join("  ") : "—";
    const lines = doc.splitTextToSize(tagText, colW - 10);
    doc.text(lines.slice(0, 10), x + 5, y + 28);
  });
  let ny = y + cardH + 8;
  setFont(doc, 9, "bold", C.faint);
  doc.text("RECOMMENDED MIX PER POST", M.x, ny);
  ny += 5;
  const mix = [
    { label: "Broad Reach (5 tags)", pct: 33, color: C.orange },
    { label: "Niche Authority (5 tags)", pct: 33, color: C.pink },
    { label: "Community (5 tags)", pct: 34, color: C.purple },
  ];
  mix.forEach((m) => {
    ny = ensure(doc, ny, 8, "");
    setFont(doc, 9, "normal", C.sub);
    doc.text(m.label, M.x, ny);
    setFont(doc, 9, "bold", C.ink);
    doc.text(`${m.pct}%`, A4.w - M.x, ny, { align: "right" });
    // bar
    const barY = ny + 1.4;
    doc.setFillColor(...C.panelAlt);
    doc.rect(M.x + 55, barY, A4.w - M.x * 2 - 70, 2, "F");
    doc.setFillColor(m.color[0], m.color[1], m.color[2]);
    doc.rect(M.x + 55, barY, ((A4.w - M.x * 2 - 70) * m.pct) / 100, 2, "F");
    ny += 7;
  });
  ny += 2;
  setFont(doc, 8, "italic", C.faint);
  const foot = "Total: 15 hashtags per post. Instagram recommends 3–5 but testing consistently shows 12–20 outperform for accounts under 10K followers.";
  const footLines = doc.splitTextToSize(foot, A4.w - M.x * 2);
  doc.text(footLines, M.x, ny + 2);
  return ny + footLines.length * 4 + 2;
}

// ─── Score ring + gradient bar ────────────────────────────────────────────
function scoreRing(doc: jsPDF, cx: number, cy: number, r: number, score: number) {
  // background track
  doc.setDrawColor(...C.panelAlt);
  doc.setLineWidth(2.4);
  doc.circle(cx, cy, r, "S");
  // colored arc via segmented lines around circumference
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const steps = 60;
  const segs = Math.round(steps * pct);
  const grad = [C.orange, C.pink, C.purple, C.blue];
  doc.setLineWidth(2.4);
  for (let i = 0; i < segs; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const a0 = -Math.PI / 2 + t0 * Math.PI * 2;
    const a1 = -Math.PI / 2 + t1 * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const c = pickGradient(grad, t0);
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.line(x0, y0, x1, y1);
  }
  setFont(doc, 14, "bold", C.ink);
  doc.text(String(score), cx, cy + 1, { align: "center" });
  setFont(doc, 7, "normal", C.faint);
  doc.text("/100", cx, cy + 6, { align: "center" });
}

function gradientBar(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const stops = [C.g1, C.g2, C.g3, C.g4];
  const segs = 40;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const c = pickGradient(stops, t);
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(x + (w / segs) * i, y, w / segs + 0.2, h, "F");
  }
}

function pickGradient(stops: [number, number, number][], t: number): [number, number, number] {
  if (t <= 0) return stops[0];
  if (t >= 1) return stops[stops.length - 1];
  const scaled = t * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = stops[i], b = stops[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

// ─── Content derivation ───────────────────────────────────────────────────
function buildSummaryPoints(dna: any): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  const perf = dna?.performanceMetrics ?? {};
  const eng = String(perf?.engagementRate ?? "").trim();
  if (eng) {
    out.push({
      title: eng.startsWith("0") || eng === "0.00%" ? "Engagement near zero." : `Engagement measured at ${eng}.`,
      body: perf?.engagementBenchmark
        ? `Benchmark: ${perf.engagementBenchmark}. ${arr(dna?.growthOpportunities)[0] ?? "A clone-and-improve strategy can outperform quickly."}`
        : "Content is not resonating at scale. A clone-and-improve strategy targeting this same audience can outperform on day one.",
    });
  }
  const pillars = arr(dna?.contentPillars);
  if (!pillars.length) {
    out.push({ title: "Content pillars undefined.", body: "No consistent content format is established. The account posts sporadically across topics without a repeatable structure. This is your opening." });
  } else {
    out.push({ title: `Top pillar: ${pillars[0]?.name}.`, body: String(pillars[0]?.description ?? "").slice(0, 220) });
  }
  const brand = dna?.brandVoice || dna?.storytellingStyle;
  if (brand) out.push({ title: "Niche messaging is sharp.", body: String(brand).slice(0, 240) });
  const opps = arr(dna?.growthOpportunities);
  if (opps.length) out.push({ title: "Biggest unclaimed opportunity.", body: String(opps[0]).slice(0, 240) });
  return out.slice(0, 4);
}

function splitPairs(who: string): [string, string][] {
  if (!who) return [];
  const parts = who.split(/[·•|\n]|,\s(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 6).map((p) => {
    const [a, ...rest] = p.split(/[—:–\-]\s?/);
    return [a.trim(), rest.join(" — ").trim() || ""] as [string, string];
  });
}

function buildOpportunities(dna: any): { title: string; problem: string; action: string }[] {
  const raw = arr(dna?.missedOpportunities).length
    ? arr(dna?.missedOpportunities)
    : arr(dna?.competitivePosition?.contentGaps).length
      ? arr(dna?.competitivePosition?.contentGaps)
      : arr(dna?.growthOpportunities);
  return raw.slice(0, 6).map((item: any) => {
    if (typeof item === "string") {
      const [title, ...rest] = item.split(/[—:–]\s?/);
      return {
        title: title.trim().slice(0, 90),
        problem: rest.join(" — ").trim() || item,
        action: "Test this angle inside IGCloner's Clone Studio and measure saves in the first 48 hours.",
      };
    }
    return {
      title: String(item?.title ?? item?.name ?? "Opportunity").slice(0, 90),
      problem: String(item?.problem ?? item?.description ?? item?.why ?? ""),
      action: String(item?.action ?? item?.actionStep ?? "Test this angle inside IGCloner's Clone Studio and measure saves in the first 48 hours."),
    };
  });
}

function buildWeeks(dna: any, subject: string): { title: string; bullets: string[] }[] {
  const opps = arr(dna?.growthOpportunities);
  const hooks = arr(dna?.commonHooks);
  const firstHook = hooks[0]?.pattern ?? "the strongest hook";
  return [
    {
      title: "Establish Your Hooks",
      bullets: [
        `Clone ${firstHook} — same format, your niche adaptation`,
        "Post 3 carousel versions using the Steal the Frame mode in Clone Studio",
        `Use the "Comment [WORD] for blueprint" CTA — set up DM automation first`,
        `Target hashtags from Distribution page (mix all 3 tiers)`,
      ],
    },
    {
      title: "Launch Your Reel Strategy",
      bullets: [
        `Record your first Reel — 30–45 seconds, one specific angle from ${subject}'s niche`,
        "Clone the highest-performing Reel format from similar accounts in IGCloner",
        "Post 3x Reels this week — algorithm rewards new format adoption early",
        "Measure: which hook in Week 1 got the most saves? Double down on that angle",
      ],
    },
    {
      title: "Build Your Series",
      bullets: [
        `Launch ${opps[0] ? String(opps[0]).slice(0, 60) : "a numbered content series"} (#1 of 10)`,
        "Post one personal story — your own before-and-after in this niche",
        "Engage: respond to every comment in the first hour of every post",
        "Repurpose Week 1 top performer as a Reel with voiceover",
      ],
    },
    {
      title: "Scale What's Working",
      bullets: [
        "Identify your top-performing format from weeks 1–3 — post 5x that format",
        "DM outreach to 5 similar accounts for cross-promotion",
        "Post a content-recap carousel — your best insights from the month",
        "Plan the next 30 days using IGCloner's Content Calendar",
      ],
    },
  ];
}

function buildHashtagTiers(dna: any): string[][] {
  const raw = arr(dna?.hookAnalysis?.hashtagStrategy);
  const flat = typeof dna?.hookAnalysis?.hashtagStrategy === "string"
    ? dna.hookAnalysis.hashtagStrategy.split(/[,\s]+/).filter(Boolean)
    : arr(dna?.hashtagTiers?.broad).length
      ? []
      : raw;
  // Prefer structured `hashtagTiers` if present
  const t1 = arr(dna?.hashtagTiers?.broad);
  const t2 = arr(dna?.hashtagTiers?.niche);
  const t3 = arr(dna?.hashtagTiers?.community);
  if (t1.length || t2.length || t3.length) return [t1, t2, t3].map((t) => t.map(String));
  // Fallback: split whatever we have across three tiers
  const all = flat.length ? flat : String(dna?.hookAnalysis?.hashtagStrategy ?? "").split(/[,\s]+/).map((x: string) => x.trim()).filter(Boolean);
  const chunk = Math.ceil(all.length / 3);
  return [all.slice(0, chunk), all.slice(chunk, chunk * 2), all.slice(chunk * 2)];
}

function inferCompetition(score: number): string {
  if (!score) return "MEDIUM";
  if (score >= 75) return "LOW";
  if (score >= 50) return "MEDIUM";
  return "HIGH";
}
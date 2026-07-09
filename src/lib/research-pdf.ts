import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Brand palette
const BRAND = {
  primary: [129, 52, 175] as [number, number, number], // #8134AF
  accent: [221, 42, 123] as [number, number, number],  // #DD2A7B
  ink: [17, 24, 39] as [number, number, number],
  sub: [107, 114, 128] as [number, number, number],
  soft: [243, 244, 246] as [number, number, number],
  line: [229, 231, 235] as [number, number, number],
  green: [16, 185, 129] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  rose: [244, 63, 94] as [number, number, number],
  blue: [59, 130, 246] as [number, number, number],
};

const A4 = { w: 210, h: 297 };
const M = { x: 16, top: 22, bottom: 20 };

function arr(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

export function exportResearchPdf(report: any, ideas: any[] = []) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const dna = (report?.dna_report ?? {}) as any;
  const subject = String(report?.subject ?? "Research Report");
  const mode = String(report?.mode ?? "");
  const score = Number(report?.opportunity_score ?? 0);
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  // ── Cover ──────────────────────────────────────────────────
  drawCover(doc, { subject, mode, score, dateStr, summary: dna.executiveSummary });

  // ── Content pages ──────────────────────────────────────────
  let y = newPage(doc, "Executive Summary");
  y = paragraph(doc, dna.executiveSummary || "No summary available.", y);

  y = ensure(doc, y, 30, "Executive Summary");
  y = subhead(doc, "Opportunity Snapshot", y);
  y = kpiRow(doc, [
    { label: "Opportunity", value: score ? `${score}/100` : "—", tone: BRAND.green },
    { label: "Competition", value: inferCompetition(score), tone: BRAND.rose },
    { label: "Cadence", value: shortText(dna.postingFrequency, 22) || "—", tone: BRAND.amber },
    { label: "Audience", value: firstWord(dna?.audienceProfile?.who) || "Defined", tone: BRAND.blue },
  ], y);

  // Audience
  y = section(doc, y, "Audience Profile");
  y = labeledPara(doc, "Who they are", dna?.audienceProfile?.who, y);
  y = labeledPara(doc, "Psychographics", dna?.audienceProfile?.psychographics, y);
  y = bulletList(doc, "Desires", arr(dna?.audienceProfile?.desires), y, BRAND.green);
  y = bulletList(doc, "Pain Points", arr(dna?.audienceProfile?.painPoints), y, BRAND.rose);

  // Content pillars
  const pillars = arr(dna.contentPillars);
  if (pillars.length) {
    y = section(doc, y, "Content Pillars");
    autoTable(doc, {
      startY: y,
      margin: { left: M.x, right: M.x },
      head: [["Pillar", "Share", "Description"]],
      body: pillars.map((p: any) => [
        String(p?.name ?? ""),
        p?.share != null ? `${Math.round(Number(p.share))}%` : "—",
        String(p?.description ?? ""),
      ]),
      styles: { fontSize: 9, cellPadding: 2.5, textColor: BRAND.ink, lineColor: BRAND.line, lineWidth: 0.1 },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 252] as any },
      columnStyles: { 0: { cellWidth: 45, fontStyle: "bold" }, 1: { cellWidth: 18, halign: "center" } },
      didDrawPage: () => header(doc, "Content Pillars"),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Topics & Hooks
  const topics = arr(dna.topTopics);
  const hooks = arr(dna.commonHooks);
  if (topics.length || hooks.length) {
    y = section(doc, y, "Top Topics & Hooks");
    if (topics.length) {
      y = subhead(doc, "Top Topics", y);
      y = bulletItems(doc, topics.map((t: any) => `${t?.topic ?? ""} — ${t?.why ?? ""}`), y, BRAND.green);
    }
    if (hooks.length) {
      y = subhead(doc, "Proven Hook Patterns", y + 2);
      for (const h of hooks) {
        y = ensure(doc, y, 16, "Top Topics & Hooks");
        setFont(doc, 10, "bold", BRAND.ink);
        y = writeText(doc, `• ${h?.pattern ?? ""}`, M.x, y);
        setFont(doc, 9, "italic", BRAND.sub);
        y = writeText(doc, `   “${h?.example ?? ""}”`, M.x, y + 1);
        y += 3;
      }
    }
  }

  // Caption & Voice
  y = section(doc, y, "Caption Structure & Brand Voice");
  const cs = dna?.captionStructure ?? {};
  autoTable(doc, {
    startY: y,
    margin: { left: M.x, right: M.x },
    body: [
      ["Length", cs.typicalLength ?? "—"],
      ["Tone", cs.tone ?? "—"],
      ["Opening style", cs.openingStyle ?? "—"],
      ["CTA style", cs.ctaStyle ?? "—"],
    ],
    styles: { fontSize: 9, cellPadding: 2.5, textColor: BRAND.ink, lineColor: BRAND.line, lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: 40, fontStyle: "bold", fillColor: BRAND.soft } },
    didDrawPage: () => header(doc, "Caption Structure & Brand Voice"),
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  y = labeledPara(doc, "Brand Voice", dna.brandVoice, y);
  y = labeledPara(doc, "Storytelling Style", dna.storytellingStyle, y);
  y = bulletList(doc, "CTA Patterns", arr(dna.ctaPatterns), y, BRAND.blue);

  // Visual
  const vs = dna?.visualStyle ?? {};
  if (vs.palette || vs.composition || vs.textOverlay || vs.editStyle || dna.thumbnailPatterns) {
    y = section(doc, y, "Visual Style");
    autoTable(doc, {
      startY: y,
      margin: { left: M.x, right: M.x },
      body: [
        ["Palette", vs.palette ?? "—"],
        ["Composition", vs.composition ?? "—"],
        ["Text Overlay", vs.textOverlay ?? "—"],
        ["Edit Style", vs.editStyle ?? "—"],
        ["Thumbnail Patterns", dna.thumbnailPatterns ?? "—"],
      ],
      styles: { fontSize: 9, cellPadding: 2.5, textColor: BRAND.ink, lineColor: BRAND.line, lineWidth: 0.1 },
      columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", fillColor: BRAND.soft } },
      didDrawPage: () => header(doc, "Visual Style"),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Posting Strategy
  y = section(doc, y, "Posting Strategy");
  y = labeledPara(doc, "Frequency", dna.postingFrequency, y);
  y = labeledPara(doc, "Best Times", dna.postingTimes, y);
  y = labeledPara(doc, "Engagement Trends", dna.engagementTrends, y);
  y = labeledPara(doc, "Most Shared", dna.mostShared, y);
  y = labeledPara(doc, "Most Saved", dna.mostSaved, y);

  // Growth & risks
  y = section(doc, y, "Growth Opportunities & Risks");
  y = bulletList(doc, "Growth Opportunities", arr(dna.growthOpportunities), y, BRAND.green);
  y = bulletList(doc, "Competitive Advantages", arr(dna.competitiveAdvantages), y, BRAND.blue);
  y = bulletList(doc, "Weaknesses to Avoid", arr(dna.weaknesses), y, BRAND.amber);
  y = bulletList(doc, "Missed Opportunities", arr(dna.missedOpportunities), y, BRAND.primary);

  // Content Ideas table
  if (ideas.length) {
    doc.addPage();
    header(doc, "Content Opportunity Engine");
    setFont(doc, 16, "bold", BRAND.ink);
    doc.text("Content Opportunity Engine", M.x, M.top + 6);
    setFont(doc, 10, "normal", BRAND.sub);
    doc.text(`${ideas.length} ranked ideas grounded in this research.`, M.x, M.top + 12);

    autoTable(doc, {
      startY: M.top + 18,
      margin: { left: M.x, right: M.x, top: M.top, bottom: M.bottom },
      head: [["#", "Title", "Format", "Hook", "Viral", "Conf."]],
      body: ideas.map((i: any, idx: number) => [
        String(idx + 1),
        String(i?.title ?? ""),
        String(i?.format ?? ""),
        shortText(String(i?.hook ?? ""), 90),
        String(i?.virality_score ?? "—"),
        String(i?.confidence_score ?? "—"),
      ]),
      styles: { fontSize: 8, cellPadding: 2, textColor: BRAND.ink, lineColor: BRAND.line, lineWidth: 0.1, valign: "top" },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 252] as any },
      columnStyles: {
        0: { cellWidth: 8, halign: "center", textColor: BRAND.sub },
        1: { cellWidth: 48, fontStyle: "bold" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 70 },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 14, halign: "center" },
      },
      didDrawPage: () => header(doc, "Content Opportunity Engine"),
    });
  }

  // Footers
  paginate(doc);

  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  doc.save(`igcloner-research-${slug || "report"}.pdf`);
}

// ── drawing primitives ───────────────────────────────────────────────
function setFont(
  doc: jsPDF, size: number, style: "normal" | "bold" | "italic" = "normal", color: [number, number, number] = BRAND.ink,
) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

function header(doc: jsPDF, title: string) {
  // top bar
  doc.setFillColor(BRAND.primary[0], BRAND.primary[1], BRAND.primary[2]);
  doc.rect(0, 0, A4.w, 12, "F");
  setFont(doc, 9, "bold", [255, 255, 255]);
  doc.text("IGCLONER · CONTENT INTELLIGENCE", M.x, 7.8);
  setFont(doc, 9, "normal", [255, 255, 255]);
  doc.text(title, A4.w - M.x, 7.8, { align: "right" });
}

function paginate(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i === 1) continue; // cover has no footer
    setFont(doc, 8, "normal", BRAND.sub);
    doc.text(`Page ${i} of ${total}`, A4.w - M.x, A4.h - 8, { align: "right" });
    doc.text("Generated by IGCloner — igcloner.lovable.app", M.x, A4.h - 8);
  }
}

function newPage(doc: jsPDF, title: string): number {
  doc.addPage();
  header(doc, title);
  setFont(doc, 20, "bold", BRAND.ink);
  doc.text(title, M.x, M.top + 6);
  // accent underline
  doc.setDrawColor(BRAND.accent[0], BRAND.accent[1], BRAND.accent[2]);
  doc.setLineWidth(0.8);
  doc.line(M.x, M.top + 9, M.x + 24, M.top + 9);
  return M.top + 18;
}

function section(doc: jsPDF, y: number, title: string): number {
  y = ensure(doc, y, 20, title);
  setFont(doc, 14, "bold", BRAND.primary);
  doc.text(title, M.x, y);
  doc.setDrawColor(BRAND.line[0], BRAND.line[1], BRAND.line[2]);
  doc.setLineWidth(0.2);
  doc.line(M.x, y + 1.5, A4.w - M.x, y + 1.5);
  return y + 7;
}

function subhead(doc: jsPDF, title: string, y: number): number {
  y = ensure(doc, y, 10, title);
  setFont(doc, 10, "bold", BRAND.sub);
  const t = title.toUpperCase();
  doc.text(t, M.x, y);
  return y + 5;
}

function paragraph(doc: jsPDF, text: string, y: number): number {
  if (!text) return y;
  setFont(doc, 10, "normal", BRAND.ink);
  const lines = doc.splitTextToSize(text, A4.w - M.x * 2);
  for (const line of lines) {
    y = ensure(doc, y, 6, "");
    doc.text(line, M.x, y);
    y += 5;
  }
  return y + 2;
}

function labeledPara(doc: jsPDF, label: string, text: string | undefined, y: number): number {
  if (!text) return y;
  y = ensure(doc, y, 12, label);
  setFont(doc, 9, "bold", BRAND.sub);
  doc.text(label.toUpperCase(), M.x, y);
  y += 4.5;
  return paragraph(doc, text, y);
}

function bulletList(
  doc: jsPDF, label: string, items: unknown[], y: number, color: [number, number, number],
): number {
  if (!items?.length) return y;
  y = subhead(doc, label, y);
  return bulletItems(doc, items, y, color);
}

function bulletItems(
  doc: jsPDF, items: unknown[], y: number, color: [number, number, number],
): number {
  setFont(doc, 10, "normal", BRAND.ink);
  for (const it of items) {
    const text = String(it ?? "").trim();
    if (!text) continue;
    const lines = doc.splitTextToSize(text, A4.w - M.x * 2 - 6);
    y = ensure(doc, y, lines.length * 5 + 2, "");
    // bullet dot
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(M.x + 1.4, y - 1.6, 0.9, "F");
    setFont(doc, 10, "normal", BRAND.ink);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], M.x + 5, y);
      y += 5;
    }
    y += 1.5;
  }
  return y + 2;
}

function kpiRow(
  doc: jsPDF,
  cells: { label: string; value: string; tone: [number, number, number] }[],
  y: number,
): number {
  const gap = 3;
  const totalW = A4.w - M.x * 2;
  const w = (totalW - gap * (cells.length - 1)) / cells.length;
  const h = 18;
  y = ensure(doc, y, h + 4, "");
  cells.forEach((c, i) => {
    const x = M.x + i * (w + gap);
    // card
    doc.setFillColor(BRAND.soft[0], BRAND.soft[1], BRAND.soft[2]);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    // accent bar
    doc.setFillColor(c.tone[0], c.tone[1], c.tone[2]);
    doc.roundedRect(x, y, 1.4, h, 0.7, 0.7, "F");
    setFont(doc, 7.5, "bold", BRAND.sub);
    doc.text(c.label.toUpperCase(), x + 4, y + 5);
    setFont(doc, 13, "bold", BRAND.ink);
    doc.text(shortText(c.value, 22), x + 4, y + 13);
  });
  return y + h + 6;
}

function writeText(doc: jsPDF, text: string, x: number, y: number): number {
  const lines = doc.splitTextToSize(text, A4.w - M.x * 2);
  doc.text(lines, x, y);
  return y + lines.length * 4.5;
}

function ensure(doc: jsPDF, y: number, need: number, title: string): number {
  if (y + need > A4.h - M.bottom) {
    doc.addPage();
    header(doc, title || "");
    return M.top + 6;
  }
  return y;
}

function drawCover(
  doc: jsPDF,
  o: { subject: string; mode: string; score: number; dateStr: string; summary?: string },
) {
  // gradient-ish background using two rects
  doc.setFillColor(BRAND.primary[0], BRAND.primary[1], BRAND.primary[2]);
  doc.rect(0, 0, A4.w, 130, "F");
  doc.setFillColor(BRAND.accent[0], BRAND.accent[1], BRAND.accent[2]);
  doc.rect(0, 110, A4.w, 20, "F");

  // Brand mark
  setFont(doc, 10, "bold", [255, 255, 255]);
  doc.text("IGCLONER  ·  CONTENT INTELLIGENCE REPORT", M.x, 22);

  // Title
  setFont(doc, 30, "bold", [255, 255, 255]);
  const titleLines = doc.splitTextToSize(o.subject, A4.w - M.x * 2 - 45);
  doc.text(titleLines, M.x, 55);

  // Mode chip
  setFont(doc, 9, "bold", BRAND.primary);
  const chip = o.mode ? o.mode.toUpperCase() : "REPORT";
  const chipW = doc.getTextWidth(chip) + 8;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M.x, 78, chipW, 7.5, 2, 2, "F");
  doc.text(chip, M.x + 4, 83.2);

  // Date
  setFont(doc, 10, "normal", [255, 255, 255]);
  doc.text(o.dateStr, M.x, 96);

  // Score badge (top right)
  const cx = A4.w - M.x - 20;
  const cy = 50;
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, 22, "F");
  setFont(doc, 8, "bold", BRAND.sub);
  doc.text("OPPORTUNITY", cx, cy - 10, { align: "center" });
  setFont(doc, 26, "bold", BRAND.primary);
  doc.text(String(o.score || 0), cx, cy + 2, { align: "center" });
  setFont(doc, 8, "normal", BRAND.sub);
  doc.text("/ 100", cx, cy + 9, { align: "center" });

  // Executive summary block
  setFont(doc, 11, "bold", BRAND.ink);
  doc.text("Executive Summary", M.x, 150);
  doc.setDrawColor(BRAND.accent[0], BRAND.accent[1], BRAND.accent[2]);
  doc.setLineWidth(0.8);
  doc.line(M.x, 152.5, M.x + 22, 152.5);

  setFont(doc, 10, "normal", BRAND.ink);
  const sum = o.summary ?? "A structured analysis of audience, pillars, hooks, cadence, and growth opportunities for this niche.";
  const lines = doc.splitTextToSize(sum, A4.w - M.x * 2);
  doc.text(lines.slice(0, 18), M.x, 160);

  // Footer band
  doc.setFillColor(BRAND.soft[0], BRAND.soft[1], BRAND.soft[2]);
  doc.rect(0, A4.h - 20, A4.w, 20, "F");
  setFont(doc, 9, "normal", BRAND.sub);
  doc.text("Prepared by IGCloner  ·  igcloner.lovable.app", M.x, A4.h - 8);
  setFont(doc, 9, "bold", BRAND.primary);
  doc.text("Confidential — Client Deliverable", A4.w - M.x, A4.h - 8, { align: "right" });
}

// ── utils ───────────────────────────────────────────────────────────
function shortText(s?: string, n = 60) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function firstWord(s?: string) { return (s ?? "").trim().split(/[\s,.]/)[0] || ""; }
function inferCompetition(score: number) {
  if (!score) return "—";
  if (score >= 75) return "Low";
  if (score >= 50) return "Medium";
  return "High";
}
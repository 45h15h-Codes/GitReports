/**
 * PDF generation service (PRD §7.5)
 *
 * Generates a public-data-only PDF report.
 * Private repos are NEVER included — enforced here before any data touches PDFKit.
 *
 * Layout:
 *   Page 1 — Dev Card (persona, top stats, AI summary excerpt)
 *   Page 2 — Full stats + language breakdown + commit frequency
 *
 * Privacy: only public repo data enters this function.
 * Caller (route handler) must pass pre-filtered public payload.
 */

import PDFDocument from "pdfkit";
import type { Readable } from "stream";
import type { AiPayload } from "../aggregation/types";

// High-end Palette (Zinc-based)
const COLOR = {
  canvas: "#09090B", // Zinc 950
  surface: "#18181B", // Zinc 900
  border: "#27272A", // Zinc 800
  borderSoft: "#1F1F22", // Subtle inner border
  primary: "#FAFAFA", // Zinc 50
  secondary: "#A1A1AA", // Zinc 400
  muted: "#52525B", // Zinc 600
  accent: "#FFFFFF", // Pure White for high-contrast
  deltaUp: "#10B981", // Emerald 500
  deltaDown: "#F43F5E", // Rose 500
};

const PERSONA_COLORS: Record<string, string> = {
  "The Architect": "#3B82F6", // Blue 500
  "The Shipper": "#10B981", // Emerald 500
  "The Maintainer": "#A1A1AA", // Zinc 400
  "The Explorer": "#F59E0B", // Amber 500
  "The Open Source Contributor": "#8B5CF6", // Violet 500
  "The Builder": "#F97316", // Orange 500
};

function monthLabel(period: string): string {
  const [y, m] = period.split("-");
  return new Date(parseInt(y!), parseInt(m!) - 1)
    .toLocaleString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();
}

function formatLines(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export interface PdfReportInput {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  payload: AiPayload;
  narrative: string | null;
  isOwner?: boolean;
}

export function generateReportPdf(input: PdfReportInput): Readable {
  const { username, displayName, payload, narrative, isOwner } = input;
  const personaColor =
    PERSONA_COLORS[payload.developer_persona] ?? COLOR.accent;
  const month = monthLabel(payload.period);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: `${displayName} - ${month} GitReport`,
      Author: "GitReport",
      Subject: `Monthly developer activity report for ${username}`,
    },
  });

  const W = doc.page.width; // 595.28
  const H = doc.page.height; // 841.89
  const MARGIN = 48;

  // Helper: Draw Premium Card
  const drawCard = (x: number, y: number, w: number, h: number) => {
    // Subtle gradient fill
    const grad = doc.linearGradient(x, y, x, y + h);
    grad.stop(0, COLOR.surface).stop(1, "#131316");
    doc.roundedRect(x, y, w, h, 8).fill(grad);
    // Outer border
    doc
      .roundedRect(x, y, w, h, 8)
      .lineWidth(1)
      .strokeColor(COLOR.border)
      .stroke();
    // Inner "Liquid Glass" highlight
    doc
      .roundedRect(x + 1, y + 1, w - 2, h - 2, 7)
      .lineWidth(1)
      .strokeColor(COLOR.borderSoft)
      .stroke();
  };

  // Helper: Draw Privacy Footer
  const drawFooter = () => {
    doc
      .fillColor(COLOR.muted)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text("GITREPORT.DEV", MARGIN, H - 32, { characterSpacing: 1 });

    const footerText = isOwner
      ? "FULL ACTIVITY • INCLUDES PRIVATE REPOSITORIES"
      : "PUBLIC ACTIVITY ONLY • PRIVATE REPOS EXCLUDED";

    doc
      .fillColor(COLOR.muted)
      .font("Helvetica")
      .fontSize(7)
      .text(footerText, MARGIN, H - 32, {
        align: "right",
        characterSpacing: 0.5,
      });
  };

  // ── PAGE 1: Cinematic Dev Card ─────────────────────────────────────────────

  doc.rect(0, 0, W, H).fill(COLOR.canvas);

  // Subtle background mesh/glow simulation
  const bgGrad = doc.radialGradient(W / 2, 0, 0, W / 2, 0, W);
  bgGrad.stop(0, personaColor, 0.1).stop(1, COLOR.canvas, 0);
  doc.rect(0, 0, W, H).fill(bgGrad);

  // Header Nav
  doc
    .fillColor(COLOR.primary)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("GITREPORT", MARGIN, MARGIN, { characterSpacing: 2 });
  doc
    .fillColor(COLOR.secondary)
    .font("Helvetica")
    .fontSize(10)
    .text(month, MARGIN, MARGIN, { align: "right", characterSpacing: 1 });

  // Hero Section (Attention)
  let yPos = 140;

  // Persona Pill
  const pillLabel = payload.developer_persona.toUpperCase();
  const pillW =
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .widthOfString(pillLabel, { characterSpacing: 1 }) + 24;
  doc.roundedRect(MARGIN, yPos, pillW, 20, 10).fill(`${personaColor}22`);
  doc
    .fillColor(personaColor)
    .text(pillLabel, MARGIN + 12, yPos + 6, { characterSpacing: 1 });

  yPos += 36;

  // Massive Typography
  doc
    .fillColor(COLOR.primary)
    .font("Helvetica-Bold")
    .fontSize(48)
    .text(displayName.toUpperCase(), MARGIN, yPos, {
      characterSpacing: -1.5,
      lineGap: -10,
    });
  yPos += 52;
  doc
    .fillColor(COLOR.secondary)
    .font("Helvetica")
    .fontSize(18)
    .text(`@${username}`, MARGIN, yPos, { characterSpacing: 0.5 });

  yPos += 64;

  // Top Stats Bento (Interest)
  const topLang =
    Object.entries(payload.languages).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "N/A";
  const heroStats = [
    { label: "TOTAL COMMITS", value: String(payload.total_commits) },
    { label: "LONGEST STREAK", value: `${payload.longest_streak} DAYS` },
    { label: "TOP LANGUAGE", value: topLang.toUpperCase() },
  ];

  const colW = (W - MARGIN * 2 - 32) / 3;
  heroStats.forEach((stat, i) => {
    const sx = MARGIN + i * (colW + 16);
    drawCard(sx, yPos, colW, 90);

    doc
      .fillColor(COLOR.secondary)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(stat.label, sx + 16, yPos + 20, { characterSpacing: 1.2 });

    // Fit text if too long
    let valSize = 28;
    doc.font("Helvetica-Bold").fontSize(valSize);
    while (doc.widthOfString(stat.value) > colW - 32 && valSize > 12) {
      valSize -= 2;
      doc.fontSize(valSize);
    }
    doc
      .fillColor(COLOR.primary)
      .text(stat.value, sx + 16, yPos + 48, { characterSpacing: -0.5 });
  });

  yPos += 130;

  // AI Narrative (Desire) - Rendered as a cinematic pull quote
  if (narrative) {
    const summaryText =
      narrative.length > 400 ? narrative.slice(0, 397) + "..." : narrative;

    doc.rect(MARGIN, yPos, 2, 80).fill(personaColor); // Accent line

    doc
      .fillColor(COLOR.primary)
      .font("Helvetica")
      .fontSize(12)
      .text(summaryText, MARGIN + 24, yPos + 4, {
        width: W - MARGIN * 2 - 24,
        height: 120,
        lineGap: 4,
        ellipsis: true,
      });
  }

  drawFooter();

  // ── PAGE 2: Data Cockpit ───────────────────────────────────────────────────

  doc.addPage();
  doc.rect(0, 0, W, H).fill(COLOR.canvas);

  // Header
  doc
    .fillColor(COLOR.primary)
    .font("Helvetica-Bold")
    .fontSize(24)
    .text("ANALYTICS", MARGIN, MARGIN, { characterSpacing: -0.5 });
  doc
    .fillColor(COLOR.secondary)
    .font("Helvetica")
    .fontSize(10)
    .text(month, MARGIN, MARGIN + 8, { align: "right", characterSpacing: 1 });

  yPos = MARGIN + 56;

  // ── Stat Grid ──────────────────────────────────────────────────────────────
  const statCards = [
    { label: "TOTAL COMMITS", value: payload.total_commits.toLocaleString() },
    { label: "REPOSITORIES", value: String(payload.repos_touched) },
    { label: "LINES ADDED", value: formatLines(payload.lines_added_total) },
    { label: "PULL REQUESTS", value: String(payload.prs_merged_total) },
  ];

  const gridCols = 2;
  const gridW = (W - MARGIN * 2 - 16) / gridCols;
  const gridH = 84;

  statCards.forEach((card, i) => {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const cx = MARGIN + col * (gridW + 16);
    const cy = yPos + row * (gridH + 16);

    drawCard(cx, cy, gridW, gridH);

    doc
      .fillColor(COLOR.secondary)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(card.label, cx + 16, cy + 20, { characterSpacing: 1.2 });

    doc
      .fillColor(COLOR.primary)
      .font("Helvetica-Bold")
      .fontSize(32)
      .text(card.value, cx + 16, cy + 40, { characterSpacing: -1 });
  });

  yPos += gridH * 2 + 16 + 32;

  // ── Activity Row ───────────────────────────────────────────────────────────
  const activityCards = [
    { label: "ACTIVE DAYS", value: `${payload.active_days}` },
    { label: "LONGEST STREAK", value: `${payload.longest_streak}` },
    { label: "CURRENT STREAK", value: `${payload.current_streak}` },
    { label: "PEAK HOURS", value: payload.peak_hour_block.toUpperCase() },
  ];

  const actW = (W - MARGIN * 2 - 12 * 3) / 4;

  activityCards.forEach((card, i) => {
    const cx = MARGIN + i * (actW + 12);
    drawCard(cx, yPos, actW, 72);

    doc
      .fillColor(COLOR.secondary)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(card.label, cx + 12, yPos + 16, { characterSpacing: 0.8 });

    doc
      .fillColor(COLOR.primary)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(card.value, cx + 12, yPos + 36, { characterSpacing: -0.5 });
  });

  yPos += 72 + 32;

  // ── Languages & Commits Split ──────────────────────────────────────────────
  const splitW = (W - MARGIN * 2 - 24) / 2;

  // Languages (Left)
  doc
    .fillColor(COLOR.secondary)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("LANGUAGE DISTRIBUTION", MARGIN, yPos, { characterSpacing: 1 });

  let langY = yPos + 24;
  const langs = Object.entries(payload.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  langs.forEach(([lang, pct]) => {
    const barMaxW = splitW - 48;
    const barW = Math.max(4, (pct / 100) * barMaxW);

    doc
      .fillColor(COLOR.primary)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(lang.toUpperCase(), MARGIN, langY);

    doc
      .fillColor(COLOR.muted)
      .font("Helvetica")
      .fontSize(9)
      .text(`${pct}%`, MARGIN + splitW - 32, langY, {
        width: 32,
        align: "right",
      });

    // Track
    doc.roundedRect(MARGIN, langY + 14, barMaxW, 4, 2).fill(COLOR.border);
    // Fill
    doc.roundedRect(MARGIN, langY + 14, barW, 4, 2).fill(personaColor);

    langY += 32;
  });

  // Daily Commits Chart (Right)
  if (payload.daily_commits && payload.daily_commits.length > 0) {
    const chartX = MARGIN + splitW + 24;
    doc
      .fillColor(COLOR.secondary)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("COMMIT FREQUENCY", chartX, yPos, { characterSpacing: 1 });

    const chartY = yPos + 24;
    const chartH2 = 100;
    const chartMaxW = splitW;
    const barCount = payload.daily_commits.length;
    const barUnit = chartMaxW / barCount;
    const maxCount = Math.max(...payload.daily_commits, 1);

    // Draw baseline
    doc.rect(chartX, chartY + chartH2, chartMaxW, 1).fill(COLOR.border);

    payload.daily_commits.forEach((count, i) => {
      const bh = count === 0 ? 2 : Math.max(4, (count / maxCount) * chartH2);
      const bx = chartX + i * barUnit;
      const by = chartY + chartH2 - bh;
      const bw = Math.max(1, barUnit - 2);

      // Use persona color with varying opacity based on intensity
      const intensity = Math.max(0.2, count / maxCount);

      // We can't directly use rgba easily with variables in fill(), so we use opacity
      doc
        .fillOpacity(intensity)
        .rect(bx, by, bw, bh)
        .fill(personaColor)
        .fillOpacity(1);
    });
  }

  yPos = Math.max(langY, yPos + 140) + 32;

  // ── MoM Delta ──────────────────────────────────────────────────────────────
  if (payload.prev_period_summary) {
    const prev = payload.prev_period_summary;
    const delta = payload.total_commits - prev.total_commits;
    const deltaSign = delta >= 0 ? "+" : "";
    const deltaColor = delta >= 0 ? COLOR.deltaUp : COLOR.deltaDown;

    drawCard(MARGIN, yPos, W - MARGIN * 2, 60);

    doc
      .fillColor(COLOR.secondary)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("MOMENTUM (VS LAST MONTH)", MARGIN + 16, yPos + 16, {
        characterSpacing: 1,
      });

    doc
      .fillColor(deltaColor)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(`${deltaSign}${delta} COMMITS`, MARGIN + 16, yPos + 32);

    const currFocus = Math.round(payload.focus_score * 100);
    const prevFocus = Math.round(prev.focus_score * 100);
    const focusDelta = currFocus - prevFocus;
    const fSign = focusDelta >= 0 ? "+" : "";

    doc
      .fillColor(COLOR.primary)
      .font("Helvetica")
      .fontSize(10)
      .text(
        `Focus Score: ${currFocus}% (${fSign}${focusDelta}% from previous period)`,
        MARGIN + 200,
        yPos + 38,
      );
  }

  drawFooter();

  doc.end();
  return doc as unknown as Readable;
}

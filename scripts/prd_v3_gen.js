const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, LevelFormat, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageBreak, TabStopType, TabStopPosition, PageNumber
} = require('docx');
const fs = require('fs');

// ─── helpers ────────────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };

const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 160 }, children: [new TextRun({ text: t, font: "Arial", size: 32, bold: true, color: "0D1117" })] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 }, children: [new TextRun({ text: t, font: "Arial", size: 26, bold: true, color: "185FA5" })] });
const h3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 220, after: 100 }, children: [new TextRun({ text: t, font: "Arial", size: 22, bold: true, color: "2C2C2A" })] });
const body = t => new Paragraph({ spacing: { before: 80, after: 100 }, children: [new TextRun({ text: t, font: "Arial", size: 22, color: "2C2C2A" })] });
const muted = t => new Paragraph({ spacing: { before: 60, after: 80 }, children: [new TextRun({ text: t, font: "Arial", size: 20, color: "5F5E5A" })] });
const bullet = (t, sub = false) => new Paragraph({ numbering: { reference: "bullets", level: sub ? 1 : 0 }, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: t, font: "Arial", size: 22, color: "2C2C2A" })] });
const spacer = (pts = 120) => new Paragraph({ spacing: { before: pts, after: 0 }, children: [] });
const divider = () => new Paragraph({ spacing: { before: 200, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0", space: 1 } }, children: [] });
const code = t => new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: t, font: "Courier New", size: 18, color: "185FA5" })] });

const callout = (label, labelColor, bg, lines) => {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
  const bords = { top: b, bottom: b, left: b, right: b };
  return new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows: [new TableRow({
      children: [new TableCell({
        borders: bords, width: { size: 9360, type: WidthType.DXA },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        shading: { fill: bg, type: ShadingType.CLEAR },
        children: [
          new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: label, font: "Arial", size: 20, bold: true, color: labelColor })] }),
          ...lines.map(l => l === "" ? spacer(60) : l.startsWith("  ") ? new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: l, font: "Courier New", size: 18, color: "185FA5" })] }) : new Paragraph({ spacing: { before: 0, after: 60 }, children: [new TextRun({ text: l, font: "Arial", size: 20, color: "2C2C2A" })] }))
        ]
      })]
    })]
  });
};

const metaTable = rows => new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: [2200, 7160],
  rows: rows.map(([k, v]) => new TableRow({
    children: [
      new TableCell({ borders: noBorders, width: { size: 2200, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 0, right: 120 }, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: k, font: "Arial", size: 20, bold: true, color: "5F5E5A" })] })] }),
      new TableCell({ borders: noBorders, width: { size: 7160, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 0 }, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: v, font: "Arial", size: 20, color: "2C2C2A" })] })] })
    ]
  }))
});

const featTable = rows => {
  const cols = [2000, 4200, 1580, 1580];
  const total = cols.reduce((a, b) => a + b, 0);
  const hRow = new TableRow({ tableHeader: true, children: ["Feature", "Description", "Priority", "Phase"].map((h, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 140, right: 140 }, shading: { fill: "0D1117", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 20, bold: true, color: "FFFFFF" })] })] })) });
  const dRows = rows.map(([feat, desc, pri, phase], idx) => {
    const pc = pri === "P0" ? "C0392B" : pri === "P1" ? "9E5E09" : "2E7D32";
    const bg = idx % 2 === 0 ? "F9F9F9" : "FFFFFF";
    return new TableRow({
      children: [
        new TableCell({ borders, width: { size: cols[0], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: bg, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: feat, font: "Arial", size: 20, bold: true, color: "185FA5" })] })] }),
        new TableCell({ borders, width: { size: cols[1], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: bg, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: desc, font: "Arial", size: 20, color: "2C2C2A" })] })] }),
        new TableCell({ borders, width: { size: cols[2], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: bg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: pri, font: "Arial", size: 20, bold: true, color: pc })] })] }),
        new TableCell({ borders, width: { size: cols[3], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: bg, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: phase, font: "Arial", size: 20, color: "5F5E5A" })] })] }),
      ]
    });
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: cols, rows: [hRow, ...dRows] });
};

const simpleTable = (headers, cols, rows) => {
  const total = cols.reduce((a, b) => a + b, 0);
  const hRow = new TableRow({ tableHeader: true, children: headers.map((h, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 140, right: 140 }, shading: { fill: "0D1117", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 20, bold: true, color: "FFFFFF" })] })] })) });
  const dRows = rows.map((row, idx) => new TableRow({ children: row.map((v, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: idx % 2 === 0 ? "F9F9F9" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: v, font: "Arial", size: 20, color: i === 0 ? "185FA5" : "2C2C2A", bold: i === 0 })] })] })) }));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: cols, rows: [hRow, ...dRows] });
};

const milestoneTable = rows => {
  const cols = [1400, 2600, 1480, 3880];
  const hRow = new TableRow({ tableHeader: true, children: ["Phase", "Milestone", "Timeline", "Deliverables"].map((h, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 140, right: 140 }, shading: { fill: "185FA5", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 20, bold: true, color: "FFFFFF" })] })] })) });
  const dRows = rows.map(([ph, ms, tl, dl], idx) => new TableRow({
    children: [
      new TableCell({ borders, width: { size: cols[0], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: idx % 2 === 0 ? "EBF3FB" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: ph, font: "Arial", size: 20, bold: true, color: "185FA5" })] })] }),
      new TableCell({ borders, width: { size: cols[1], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: idx % 2 === 0 ? "EBF3FB" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: ms, font: "Arial", size: 20, bold: true, color: "2C2C2A" })] })] }),
      new TableCell({ borders, width: { size: cols[2], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: idx % 2 === 0 ? "EBF3FB" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: tl, font: "Arial", size: 20, color: "5F5E5A" })] })] }),
      new TableCell({ borders, width: { size: cols[3], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: idx % 2 === 0 ? "EBF3FB" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: dl, font: "Arial", size: 20, color: "2C2C2A" })] })] }),
    ]
  }));
  return new Table({ width: { size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: cols, rows: [hRow, ...dRows] });
};

// ─── document ────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, font: "Arial", color: "0D1117" }, paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Arial", color: "185FA5" }, paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, font: "Arial", color: "2C2C2A" }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [{
      reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }
      ]
    }]
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: {
      default: new Header({
        children: [new Paragraph({
          spacing: { before: 0, after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "185FA5", space: 1 } },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: "GitReport — Product Requirements Document  v3.0", font: "Arial", size: 18, color: "5F5E5A" }),
            new TextRun({ text: "\tCONFIDENTIAL", font: "Arial", size: 18, color: "5F5E5A" })
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          spacing: { before: 0, after: 0 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0", space: 1 } },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: "GitReport PRD v3.0", font: "Arial", size: 18, color: "888780" }),
            new TextRun({ text: "\tPage ", font: "Arial", size: 18, color: "888780" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "888780" })
          ]
        })]
      })
    },

    children: [

      // ══ COVER ══════════════════════════════════════════════════════════════
      spacer(400),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "GitReport", font: "Arial", size: 72, bold: true, color: "0D1117" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 80 }, children: [new TextRun({ text: "Product Requirements Document", font: "Arial", size: 36, color: "185FA5" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 }, children: [new TextRun({ text: "Developer Identity Engine & Monthly Engineering Intelligence Platform", font: "Arial", size: 24, color: "5F5E5A" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 400 }, children: [new TextRun({ text: "Version 3.0 — Viral Growth & Premium Experience Edition", font: "Arial", size: 22, bold: true, color: "888780" })] }),
      spacer(80),
      metaTable([
        ["Version", "3.0"],
        ["Status", "Final Draft — Ready for Engineering Handoff"],
        ["Date", "May 2025"],
        ["Previous", "v2.0 (Architecture & Expansion)"],
        ["This version", "Adds: AI Storyteller Engine, Viral Growth Loop, Dev Card, Challenge Link, Dual Dashboard Modes, Longitudinal Retention Layer"],
        ["Author", "Product Team"],
        ["Classification", "Confidential"]
      ]),
      spacer(400),
      new Paragraph({ children: [new PageBreak()] }),

      // ══ 1. PRODUCT VISION ══════════════════════════════════════════════════
      h1("1. Product Vision"),
      callout("Core positioning — v3.0", "185FA5", "EBF3FB", [
        "GitReport is not a dashboard. It is not an analytics tool. It is not a GitHub wrapper.",
        "",
        "GitReport is a developer identity engine.",
        "",
        "Every commit a developer makes is a data point. GitReport's job is to transform those",
        "data points into a narrative — a monthly story of what was built, how hard it was,",
        "and what kind of engineer this person is becoming.",
        "",
        "The product must make developers feel seen. Then it makes them want to share that feeling."
      ]),
      spacer(120),
      body("Three forces must work together for the platform to survive launch and grow:"),
      bullet("The AI Storyteller Engine — translates raw GitHub data into human achievement language"),
      bullet("The Premium Wrapped Experience — makes the monthly report visually compelling enough to share"),
      bullet("The Viral Growth Loop — turns every shared report into a new user acquisition funnel"),
      spacer(80),
      body("Without all three, GitReport is a developer tool. With all three, it becomes a developer identity platform that grows itself."),
      divider(),

      // ══ 2. WHAT CHANGED IN V3.0 ════════════════════════════════════════════
      h1("2. What Changed in v3.0"),
      simpleTable(
        ["Area", "v2.0 approach", "v3.0 upgrade"],
        [2000, 3600, 3760],
        [
          ["AI layer", "LLM generates narrative from raw stats", "Structured pre-classified payload; server computes category_signal, focus_score, persona before LLM call"],
          ["Dashboard mode", "Single dashboard mode", "Dual mode: cinematic first-run + fast recurring. Animation is reserved, not constant."],
          ["Dev Card", "Mentioned as Phase 4 deliverable", "Promoted to P0 launch requirement — it is the primary viral surface"],
          ["Viral loop", "Shareable link + social share buttons", "Challenge Link mechanic + frictionless one-click onboarding from shared surfaces"],
          ["Retention", "Monthly report emails", "Longitudinal comparison: month-over-month delta narrative powered by stored payload history"],
          ["Persona system", "LLM-generated freeform", "Deterministic server-side persona from category_signal distribution — LLM only weaves it in"],
          ["Positioning", "Avoid enterprise tools", "Explicitly positioned vs DX/Jellyfish: individual portfolio, not corporate surveillance"]
        ]
      ),
      spacer(120),
      divider(),

      // ══ 3. THE AI STORYTELLER ENGINE ═══════════════════════════════════════
      h1("3. The AI Storyteller Engine"),
      body("This is the core technical differentiator of GitReport v3.0. The backend must not pass raw GitHub API data to an LLM. It must translate technical actions into human achievements through a structured pipeline before the LLM is ever called."),
      spacer(80),

      h2("3.1 The Translation Pipeline"),
      callout("Pipeline: Raw data → Intelligence → Narrative", "5F5E5A", "F9F9F9", [
        "GitHub API response",
        "  → Server aggregation (commit counts, lines, PRs, timestamps)",
        "  → Pattern classification (category_signal per repo)",
        "  → Focus score computation (0.0 – 1.0)",
        "  → Persona derivation (deterministic from signal distribution)",
        "  → Structured payload assembly (JSON, ~400–600 tokens)",
        "  → LLM call (Claude API — narrative generation only)",
        "  → Cached insight object stored with report"
      ]),
      spacer(120),

      h2("3.2 The Structured AI Payload Schema"),
      body("The following JSON schema is the contract between the server aggregation layer and the LLM. This schema is the most important engineering decision in the AI layer. It governs privacy, token cost, output quality, and longitudinal comparison capability."),
      spacer(80),
      callout("AI payload schema (per monthly report)", "2E7D32", "EAF3DE", [
        "{",
        "  \"period\": \"2025-04\",",
        "  \"total_commits\": 247,",
        "  \"active_days\": 22,",
        "  \"longest_streak\": 14,",
        "  \"current_streak\": 6,",
        "  \"repos\": [",
        "    {",
        "      \"name_hash\": \"repo_a\",",
        "      \"is_public\": true,",
        "      \"language\": \"TypeScript\",",
        "      \"commits\": 82,",
        "      \"lines_added\": 3400,",
        "      \"lines_deleted\": 1200,",
        "      \"prs_merged\": 11,",
        "      \"category_signal\": \"high_churn_refactor\"",
        "    }",
        "  ],",
        "  \"languages\": { \"TypeScript\": 62, \"Python\": 28, \"CSS\": 10 },",
        "  \"peak_hour_block\": \"evening\",",
        "  \"commit_size_dist\": { \"tiny\": 40, \"small\": 120, \"medium\": 60, \"large\": 27 },",
        "  \"focus_score\": 0.68,",
        "  \"developer_persona\": \"The Architect\",",
        "  \"prev_period_summary\": {",
        "    \"total_commits\": 209,",
        "    \"focus_score\": 0.82,",
        "    \"dominant_language\": \"TypeScript\",",
        "    \"persona\": \"The Architect\"",
        "  }",
        "}"
      ]),
      spacer(120),

      h2("3.3 Schema Design Decisions"),
      simpleTable(
        ["Field", "Design decision", "Why"],
        [2200, 3000, 4160],
        [
          ["name_hash", "SHA-256 hash of repo name", "Real repo names stay out of the LLM entirely — private names cannot leak"],
          ["category_signal", "Server-computed before LLM call", "AI interprets pre-classified signals, not raw numbers — better output, lower tokens"],
          ["focus_score", "0.0–1.0, computed server-side", "Gives LLM a pre-computed anchor for focus/scattered narrative — no inference needed"],
          ["developer_persona", "Deterministic from signal dist.", "Consistent, fast, no extra LLM call — LLM only weaves it into the narrative prose"],
          ["prev_period_summary", "Stored payload from last month", "Enables longitudinal narrative: \"your focus dropped from 0.82 to 0.68 — here's why\""],
          ["peak_hour_block", "Bucketed (morning/afternoon/evening/night)", "Avoids exposing exact timestamps; reduces tokens; sufficient for narrative"]
        ]
      ),
      spacer(120),

      h2("3.4 category_signal Classification Rules"),
      body("The server computes category_signal for each repo using the following deterministic rules before any LLM call. This is computed in the aggregation engine, not inferred by the AI."),
      spacer(80),
      simpleTable(
        ["Signal value", "Detection criteria"],
        [2800, 6560],
        [
          ["high_churn_refactor", "lines_deleted / lines_added > 0.6 AND commits > 20"],
          ["feature_build", "prs_merged >= 3 AND lines_added > 1000 AND churn_ratio < 0.4"],
          ["maintenance", "commits > 10 AND avg_commit_size === 'tiny' AND prs_merged <= 1"],
          ["exploratory", "commits < 10 AND lines_added < 300 — early-stage or experimental"],
          ["open_source_contrib", "is_public === true AND prs_merged >= 2 AND repo is not user-owned"],
          ["documentation", "language === 'Markdown' OR 'MDX' OR lines_added > 500 AND code lines < 100"]
        ]
      ),
      spacer(120),

      h2("3.5 Developer Persona Derivation"),
      body("The persona is computed deterministically on the server from the distribution of category_signal values across all repos in the period. The LLM does not choose the persona — it only uses it in the narrative."),
      spacer(80),
      simpleTable(
        ["Persona", "Derivation rule"],
        [2800, 6560],
        [
          ["The Architect", "Majority of commits in high_churn_refactor repos (>50% of total commits)"],
          ["The Shipper", "Majority in feature_build — high PR rate, consistent output"],
          ["The Maintainer", "Majority in maintenance — steady, reliable, low drama"],
          ["The Explorer", "Majority in exploratory — many small repos, broad language spread"],
          ["The Open Source Contributor", "Majority in open_source_contrib — public impact focus"],
          ["The Builder", "Balanced mix across feature_build and exploratory — no dominant signal"]
        ]
      ),
      spacer(80),
      body("Persona consistency is tracked month-over-month. If a developer's persona changes (e.g. Shipper → Architect), the AI narrative calls this out explicitly as a growth signal."),
      spacer(120),

      h2("3.6 LLM Call Specification"),
      callout("Prompt engineering contract", "185FA5", "EBF3FB", [
        "System prompt (~150 tokens):",
        "You are GitReport's narrative engine. Given a structured JSON summary of a",
        "developer's monthly GitHub activity, write a single paragraph (80–120 words) that",
        "translates their work into a human achievement narrative. Use the developer_persona",
        "field to set the tone. Reference the prev_period_summary for longitudinal context",
        "if available. Never mention repository names. Write in second person (\"you\").",
        "Output plain text only — no markdown, no headers, no bullet points.",
        "",
        "User message (~400–600 tokens):",
        "[structured JSON payload as above]",
        "Generate the monthly summary for April 2025.",
        "",
        "Model: claude-haiku-4-5 (cost: ~$0.001 per report at scale)",
        "Max output tokens: 200",
        "Temperature: 0.7"
      ]),
      spacer(120),

      h2("3.7 The Reflective Summary Output"),
      body("Example output given the schema above — this is what the developer reads in their dashboard and on their shareable Dev Card:"),
      spacer(80),
      callout("Example AI-generated monthly summary", "5F5E5A", "F9F9F9", [
        "April was your month of deep work. As an Architect, you did what architects do best:",
        "you tore things down to build them better. With 82 commits concentrated in your core",
        "service — mostly deletions and restructuring — you traded output volume for structural",
        "quality. Your 14-day streak shows the focus was deliberate, not scattered. Your",
        "evening peak hours suggest this was often the quiet, deep-thinking kind of engineering.",
        "One note: your focus score dipped from 0.82 to 0.68 compared to March. That's not",
        "a warning — it might mean you're starting to explore new territory. We'll see in May."
      ]),
      spacer(80),
      body("This paragraph is what developers share. It is what gets posted on LinkedIn. It is why they come back next month."),
      divider(),

      // ══ 4. THE PREMIUM WRAPPED EXPERIENCE ══════════════════════════════════
      h1("4. The Premium Wrapped Experience"),
      body("The UI is the marketing channel. If the monthly report is not visually compelling enough for a developer to post on X or LinkedIn, the viral loop does not activate. The design system must treat the shareable surfaces as product-critical, not cosmetic."),
      spacer(80),

      h2("4.1 Dual Dashboard Modes"),
      callout("Critical design rule: animation is reserved, not ambient", "C0392B", "FDF2F2", [
        "Cinematic mode:  First report only (or first report of each new month — debut experience).",
        "                 GSAP ScrollTrigger sequences, staggered stat reveals, full Wrapped feel.",
        "                 Duration: ~8 seconds of guided scroll experience.",
        "",
        "Fast mode:       All subsequent visits. Dense, terminal-like, information-first.",
        "                 No entrance animations. Data loads instantly into its final position.",
        "                 Skeleton shimmer during fetch only. Feels like a pro tool, not a slideshow.",
        "",
        "Rule: Spotify Wrapped works because it is annual and unexpected. A monthly cinematic",
        "experience becomes exhausting by month three. Reserve the magic for the debut."
      ]),
      spacer(120),

      h2("4.2 Cinematic First-Run Sequence (GSAP)"),
      body("The cinematic mode runs a single GSAP ScrollTrigger timeline. Each beat is triggered by scroll position, not a timer, so the user controls the pace."),
      spacer(80),
      simpleTable(
        ["Beat", "Element", "Animation", "Duration"],
        [600, 2600, 4560, 1600],
        [
          ["1", "Month badge + username", "Fade in (opacity 0→1, y 16→0)", "300ms"],
          ["2", "Headline: 'Your April, in numbers'", "SplitText word-by-word reveal, stagger 0.04s", "600ms"],
          ["3", "Stat cards (4 cards)", "Stagger scale 0.92→1 + fade, 0.06s apart", "400ms"],
          ["4", "Number roll-up on each card", "gsap.to() counter, expo.out ease", "800ms"],
          ["5", "MoM delta arrows animate in", "Color crossfade neutral→green/red", "200ms"],
          ["6", "Commit bar chart bars rise", "Left-to-right stagger 0.02s, power4.out", "500ms"],
          ["7", "AI summary paragraph types in", "Character-by-character reveal, 18ms/char", "~2000ms"],
          ["8", "Dev Card slides up", "y 40→0, opacity 0→1, spring physics", "400ms"],
          ["9", "Share CTA pulses gently", "scale 1→1.03→1, loop 2×", "600ms"]
        ]
      ),
      spacer(120),

      h2("4.3 The Dev Card — Primary Viral Surface"),
      callout("Dev Card is a P0 launch requirement", "C0392B", "FDF2F2", [
        "The Dev Card is the most important component in the product.",
        "It is not a Phase 4 deliverable. It ships on day one.",
        "",
        "Every shared report must include a visually striking Dev Card.",
        "The card is what gets screenshotted, posted, and clicked.",
        "The card is the acquisition channel."
      ]),
      spacer(80),
      body("The Dev Card is a trading-card-style component containing:"),
      bullet("Developer avatar (GitHub profile picture)"),
      bullet("Developer handle and GitReport month"),
      bullet("AI-generated developer persona badge (e.g. 'The Architect') with persona-specific color"),
      bullet("Top 3 stats: total commits, longest streak, top language — large Fraunces type"),
      bullet("AI-generated reflective summary — truncated to 2 lines with expand affordance"),
      bullet("Public repo count and lines added — with privacy badge confirming no private data"),
      bullet("GitReport branding and 'Generate yours' CTA"),
      spacer(80),
      body("Animation spec for the Dev Card:"),
      bullet("On hover: spring-physics tilt (react-spring or Framer Motion useMotionValue) — 8deg max X/Y rotation, tracking cursor position. Card feels tactile and three-dimensional."),
      bullet("On first appearance in cinematic mode: slides up (y 40→0) with subtle shadow depth transition — 400ms, spring ease."),
      bullet("Persona badge: color-coded by persona type (Architect = blue, Shipper = green, Explorer = amber, Maintainer = gray, Open Source = purple). Entrance: scale 0→1, 200ms, elastic.out."),
      spacer(80),
      callout("Dev Card persona color system", "5F5E5A", "F9F9F9", [
        "The Architect          →  #185FA5 (blue)   — structural, deep",
        "The Shipper            →  #3FB950 (green)  — output, velocity",
        "The Maintainer         →  #888780 (gray)   — steady, reliable",
        "The Explorer           →  #E3B341 (amber)  — curious, wide",
        "The Open Source Contrib →  #BC8CFF (purple) — community, public",
        "The Builder            →  #D85A30 (coral)  — creative, varied"
      ]),
      spacer(120),

      h2("4.4 Visual Privacy Cues"),
      body("Developers must feel absolute visual certainty that private employer code is not being shared. This is enforced at three levels simultaneously:"),
      bullet("Color-coding: public data uses blue (#58A6FF / #1F3450 fill) throughout. Private data uses purple (#BC8CFF / #1F1B2E fill). These colors are used nowhere else in the UI — they are reserved exclusively for the privacy signal."),
      bullet("Spatial separation: private repo rows are grouped below a visible 'Private — visible to you only' section divider. They are never interspersed with public repos."),
      bullet("DOM absence: private data is server-rendered absent (not hidden with CSS) on all non-owner surfaces. The Dev Card, shared report page, and public profile contain zero private data in the HTML — not just visually hidden."),
      bullet("Explicit label on Dev Card: 'Showing public activity only' with a lock icon (Phosphor, thin) in the card footer. This is non-removable."),
      divider(),

      // ══ 5. THE VIRAL GROWTH LOOP ════════════════════════════════════════════
      h1("5. The Viral Growth Loop"),
      body("Users are the marketing team. Every shared surface must be an acquisition funnel. The loop has three entry points and one exit: sign up."),
      spacer(80),

      h2("5.1 The Acquisition Funnel"),
      callout("Viral loop architecture", "2E7D32", "EAF3DE", [
        "Entry point 1:  Shared Dev Card posted on X / LinkedIn",
        "                → Click → Public report page",
        "                → 'Generate your own report' CTA (above fold AND sticky bottom bar)",
        "                → GitHub OAuth → Onboarding → First report → First Dev Card",
        "",
        "Entry point 2:  Challenge Link ('I shipped 45% more than you — prove me wrong')",
        "                → Click → Challenge comparison page",
        "                → See the challenger's public stats vs a blank 'Your stats here'",
        "                → 'Accept the challenge' → GitHub OAuth → Onboarding",
        "",
        "Entry point 3:  Public developer profile page (/u/:username)",
        "                → Monthly report archive, growth timeline, achievements",
        "                → 'Build your profile' CTA (sticky sidebar on desktop)",
        "                → GitHub OAuth → Onboarding"
      ]),
      spacer(120),

      h2("5.2 Frictionless Onboarding from Shared Surfaces"),
      body("When a new user arrives via any shared surface, the onboarding path must have zero decision points between arrival and first value:"),
      bullet("One button: 'Connect with GitHub to generate your report' — no email, no password, no plan selection at this stage."),
      bullet("Button appears above the fold AND as a sticky bottom bar on mobile. No scrolling required to find it."),
      bullet("After OAuth: animated onboarding flow (5 named states per Section 7.1). The user sees their own data being fetched — this creates anticipation and confirms the product actually works."),
      bullet("First report: cinematic mode automatically. First Dev Card appears at the end of the sequence with a share prompt inline."),
      spacer(120),

      h2("5.3 The Challenge Link"),
      body("The Challenge Link is the highest-leverage viral mechanic in the product. Human competitiveness activates it automatically — no incentive or prompt needed."),
      spacer(80),
      callout("Challenge Link specification", "185FA5", "EBF3FB", [
        "Generated from:  Dashboard → Compare → 'Send a challenge'",
        "URL pattern:     gitreport.io/challenge/:challenger_username/:yyyy-mm",
        "",
        "Challenge page layout (unauthenticated):",
        "  Left card:   Challenger's public stats for the month (commits, streak, persona, top language)",
        "  Right card:  Blank card — 'Your stats' — all fields show '??'",
        "  CTA:         'Accept the challenge — connect GitHub to reveal your stats'",
        "  After auth:  Right card populates with their real stats. Winner badge animates in.",
        "",
        "Social caption (pre-filled for sharing):",
        "  'I shipped [N] commits in April as [Persona]. Think you can beat that?",
        "   gitreport.io/challenge/arjunshah/2025-04'",
        "",
        "Privacy rule: Challenge Link shows challenger's PUBLIC stats only.",
        "The challenged user sees only their own stats after connecting."
      ]),
      spacer(120),

      h2("5.4 The Achievement & Badge System"),
      body("Achievements create a reason to return each month and a reason to share each milestone. They are displayed on the public developer profile and referenced in the AI narrative when first earned."),
      spacer(80),
      simpleTable(
        ["Achievement", "Trigger", "Display"],
        [2800, 4160, 2400],
        [
          ["First Commit", "First ever commit indexed", "Dev Card corner badge"],
          ["Streak: 7 days", "7-day consecutive commit streak", "Profile badge"],
          ["Streak: 30 days", "30-day consecutive commit streak", "Profile badge + AI narrative callout"],
          ["Streak: 100 days", "100-day consecutive streak", "Profile badge + shareable milestone card"],
          ["Century Club", "First month with 100+ commits", "Dev Card badge + milestone card"],
          ["Polyglot", "4+ languages in a single month", "Profile badge"],
          ["Open Source Ally", "5+ PRs merged to public repos not owned by user", "Profile badge"],
          ["The Architect", "3 consecutive months with Architect persona", "Persona badge upgrade"],
          ["Growth Signal", "20%+ MoM increase in commits for 3 months", "Profile badge + AI callout"],
          ["Public Builder", "10+ public repos touched in a single month", "Dev Card badge"]
        ]
      ),
      spacer(80),
      body("Milestone achievements (30-day streak, 100-day streak, Century Club) generate a standalone shareable Milestone Card — same design language as the Dev Card, optimised for social dimensions (1200x630px for OG image). This is a separate viral surface from the monthly Dev Card."),
      divider(),

      // ══ 6. LONGITUDINAL RETENTION LAYER ════════════════════════════════════
      h1("6. Longitudinal Retention Layer"),
      body("The single most important retention mechanism is not notifications or gamification. It is the growing value of each month's AI narrative when it has prior months to reference."),
      spacer(80),
      callout("The retention compounding rule", "185FA5", "EBF3FB", [
        "Month 1 report:  Interesting — see your stats for the first time.",
        "Month 3 report:  Useful — patterns are emerging, persona is stabilising.",
        "Month 6 report:  Irreplaceable — the AI has 5 months of context.",
        "                 No other tool knows your engineering history this well.",
        "                 Switching cost becomes real. Identity is invested.",
        "",
        "This is the real lock-in. Not features. Not pricing. Accumulated narrative context."
      ]),
      spacer(120),

      h2("6.1 Month-Over-Month Delta Narrative"),
      body("Every report after the first includes a dedicated 'vs last month' section in the AI narrative. The prev_period_summary field in the payload (Section 3.2) provides this context. The AI is explicitly prompted to reference it."),
      spacer(80),
      body("Examples of delta insights the AI should surface:"),
      bullet("Focus score dropped: 0.82 → 0.61 — 'You scattered your attention across 7 repos this month vs 3 in March. This could signal exploration or fragmentation — the trend in May will tell us which.'"),
      bullet("Persona shift: The Shipper → The Architect — 'You spent far less time on net-new features this month. Your commits were longer, your diffs were larger, and you deleted more than you wrote. This is what levelling up looks like.'"),
      bullet("Streak context: 'Your 14-day streak this month ties your personal best from January. Longest ever would be 15 days.'"),
      bullet("Language shift: 'Python appeared in your top 3 for the first time. You've been shipping in TypeScript for 6 consecutive months — something new is being explored.'"),
      spacer(120),

      h2("6.2 Stored Payload History"),
      body("The structured AI payload (Section 3.2) is stored in the database alongside each monthly report. This is the longitudinal data asset. Key architectural rules:"),
      bullet("Payload is stored after every report generation, regardless of whether the user views the AI insights."),
      bullet("Payload storage is per-user, per-month. Schema is versioned — new fields added as the product evolves must not break historical payload reads."),
      bullet("On LLM call, the server fetches the previous 3 months of stored payloads and includes the most recent one as prev_period_summary. Future versions can include a rolling 6-month summary."),
      bullet("Payloads are excluded from public profiles and shared surfaces — they contain aggregated private repo metadata (language proportions, commit size distribution) that could reveal information about private work."),
      divider(),

      // ══ 7. FEATURE REQUIREMENTS ════════════════════════════════════════════
      h1("7. Feature Requirements"),
      body("Priority: P0 = launch blocker · P1 = launch target · P2 = post-launch."),
      spacer(120),

      h2("7.1 Authentication & Onboarding"),
      featTable([
        ["GitHub OAuth", "One-click sign-in. Default scope: public_repo. Private repo scope optional.", "P0", "Phase 1"],
        ["Onboarding flow", "Animated 5-state progress: Connecting → Fetching repos → Analyzing → Generating → Preparing insights.", "P0", "Phase 1"],
        ["First-run cinematic", "Cinematic dashboard mode triggers automatically on first report only. Fast mode for all subsequent visits.", "P0", "Phase 1"],
        ["Session management", "Persistent sessions, token refresh, 30-day inactivity logout.", "P0", "Phase 1"],
        ["Account deletion", "Full data deletion within 30 days. GDPR compliant. Stored payloads deleted immediately.", "P0", "Phase 1"]
      ]),
      spacer(120),

      h2("7.2 AI Storyteller Engine"),
      featTable([
        ["Aggregation engine", "Server computes: commit counts, lines delta, PR counts, commit size distribution, active days, streaks.", "P0", "Phase 1"],
        ["category_signal", "Deterministic repo classification into 6 signal types before LLM call (Section 3.4).", "P0", "Phase 1"],
        ["focus_score", "0.0–1.0 computed server-side from repo commit concentration. Stored in payload.", "P0", "Phase 1"],
        ["Persona derivation", "Deterministic persona from signal distribution (Section 3.5). 6 persona types.", "P0", "Phase 1"],
        ["LLM narrative call", "Claude API call with structured payload. System prompt ~150 tokens. Output 80–120 words. Cached.", "P0", "Phase 1"],
        ["Payload storage", "Structured payload stored per user per month. Versioned schema. Powers longitudinal narrative.", "P0", "Phase 1"],
        ["MoM delta narrative", "AI explicitly references prev_period_summary for focus score change, persona shift, streak context.", "P1", "Phase 2"],
        ["6-month context", "Rolling 6-month payload summary added to LLM context. Richer longitudinal analysis.", "P2", "Phase 3"]
      ]),
      spacer(120),

      h2("7.3 Dev Card"),
      featTable([
        ["Dev Card component", "Trading-card UI: avatar, persona badge, top 3 stats, AI summary excerpt, privacy lock label.", "P0", "Phase 1"],
        ["Spring-physics hover", "Cursor-tracking 3D tilt on hover via Framer Motion useMotionValue. 8deg max X/Y.", "P0", "Phase 1"],
        ["Persona color system", "6 persona-coded colors. Persona badge uses color exclusively for that persona. No reuse.", "P0", "Phase 1"],
        ["OG image generation", "Server-side Dev Card rendered as 1200x630px PNG for social sharing previews.", "P1", "Phase 1"],
        ["Privacy lock label", "'Showing public activity only' + lock icon. Non-removable from shared surfaces.", "P0", "Phase 1"],
        ["Milestone Card", "Separate shareable card for streak/achievement milestones. Same design language.", "P1", "Phase 2"]
      ]),
      spacer(120),

      h2("7.4 Dashboard"),
      featTable([
        ["Fast mode (recurring)", "Information-dense, no entrance animations, instant data render. Default after first visit.", "P0", "Phase 1"],
        ["Stat cards", "Commits, repos touched, lines added, PRs merged. MoM delta on each.", "P0", "Phase 1"],
        ["Month selector", "Jan–Dec toggle. Default: most recently completed month. Framer Motion layout animation.", "P0", "Phase 1"],
        ["Commit bar chart", "Daily frequency, intensity-coloured bars. GSAP stagger reveal in cinematic mode only.", "P0", "Phase 1"],
        ["Heatmap", "31-cell grid, 5-level green scale. GSAP row stagger in cinematic mode only.", "P1", "Phase 1"],
        ["AI insights panel", "Persona badge, focus score gauge, reflective summary paragraph. Always visible in fast mode.", "P0", "Phase 1"],
        ["Language breakdown", "Bar chart of lines-by-language.", "P2", "Phase 2"]
      ]),
      spacer(120),

      h2("7.5 Viral Growth Features"),
      featTable([
        ["Challenge Link", "Generate shareable challenge URL from Compare tab. Pre-filled social caption. (Section 5.3)", "P0", "Phase 1"],
        ["Challenge page", "Unauthenticated page: challenger's stats left, blank 'your stats' right. Accept challenge CTA.", "P0", "Phase 1"],
        ["Shared report page", "Public report at /u/:username/:yyyy-mm. Dev Card above fold. One-click GitHub CTA above fold + sticky bottom.", "P0", "Phase 1"],
        ["Frictionless CTA", "Single button: no email, no plan selection. OAuth only. Appears above fold and sticky bottom on shared pages.", "P0", "Phase 1"],
        ["Social share", "Pre-filled captions for X and LinkedIn. OG image from Dev Card.", "P1", "Phase 1"],
        ["PDF export", "Public-data-only PDF. Auto-filename. Includes Dev Card on page 1.", "P1", "Phase 1"]
      ]),
      spacer(120),

      h2("7.6 Achievement System"),
      featTable([
        ["Core achievements", "10 achievements covering streaks, volume, language diversity, open source, persona consistency. (Section 5.4)", "P1", "Phase 2"],
        ["Milestone cards", "Shareable OG card for streak and volume milestones. Separate from monthly Dev Card.", "P1", "Phase 2"],
        ["AI achievement callout", "AI narrative references newly earned achievements in that month's summary.", "P1", "Phase 2"],
        ["Profile badge display", "Earned badges displayed on public developer profile in chronological order.", "P1", "Phase 2"]
      ]),
      spacer(120),

      h2("7.7 Public Developer Profile"),
      featTable([
        ["Profile page", "Persistent page at /u/:username: avatar, bio, persona, monthly archive, achievements.", "P1", "Phase 3"],
        ["Monthly archive", "Scrollable timeline of past public reports. Each month is a Dev Card thumbnail.", "P1", "Phase 3"],
        ["Public highlights", "Auto-generated: best month, longest streak, most-used language, current persona.", "P1", "Phase 3"],
        ["Growth timeline", "Chart of key metrics across user's full GitReport history.", "P2", "Phase 4"],
        ["SEO indexing", "Public profiles and reports indexed. Open Graph metadata. Profile page canonical URL.", "P1", "Phase 3"],
        ["Shareable dev card", "PNG/SVG dev card for embedding in GitHub READMEs and portfolios.", "P2", "Phase 4"]
      ]),
      spacer(120),

      h2("7.8 Notifications"),
      featTable([
        ["Monthly report ready", "In-app + email: 'Your April report is ready.'", "P0", "Phase 2"],
        ["Share link viewed", "In-app: 'Someone viewed your March 2025 report.'", "P1", "Phase 2"],
        ["Challenge received", "In-app + email: '[username] has challenged you. Click to respond.'", "P1", "Phase 2"],
        ["Milestone alerts", "In-app + email when achievement unlocked. Links to milestone card.", "P1", "Phase 2"],
        ["Weekly digest", "Optional email: 7-day rolling commit stats.", "P2", "Phase 3"]
      ]),
      spacer(120),
      divider(),

      // ══ 8. COMPETITIVE POSITIONING ══════════════════════════════════════════
      h1("8. Competitive Positioning"),
      body("GitReport must be explicitly positioned against the individual developer market. It must never attempt to compete with enterprise engineering intelligence tools."),
      spacer(80),
      simpleTable(
        ["Competitor", "Their buyer", "Their focus", "GitReport's position"],
        [1800, 1800, 2600, 3160],
        [
          ["DX / Jellyfish", "VP of Engineering", "DORA metrics, team analytics, Jira integration", "Individual portfolio, personal productivity, public identity"],
          ["WakaTime", "Individual dev", "Time-tracking, language stats, IDE plugin", "No plugin required; narrative intelligence, not time logs"],
          ["GitHub native", "All GitHub users", "Contribution graph, commit history", "Monthly narrative, AI insights, shareable identity surface"],
          ["Polywork", "Individual dev", "Social portfolio, career timeline", "Technical depth, automated data, no manual curation required"],
          ["Linear", "Engineering teams", "Issue tracking, sprint velocity", "Different category — GitReport is output-focused, not process-focused"]
        ]
      ),
      spacer(80),
      callout("Positioning guardrail", "C0392B", "FDF2F2", [
        "GitReport is for the individual developer — their portfolio, their public reputation,",
        "their personal productivity insights.",
        "",
        "GitReport is NOT a corporate surveillance dashboard.",
        "GitReport is NOT a team analytics tool.",
        "GitReport is NOT a manager's reporting tool.",
        "",
        "The moment GitReport adds manager dashboards or team-level aggregation,",
        "it enters a different market with different buyers, different privacy risks,",
        "and different competitive dynamics. Keep the scope razor-sharp."
      ]),
      spacer(120),
      divider(),

      // ══ 9. PRIVACY & SECURITY ══════════════════════════════════════════════
      h1("9. Privacy & Security Requirements"),
      h2("9.1 Data Classification"),
      bullet("Public data: activity on public repositories. Visible in shared, compare, challenge, and public profile surfaces."),
      bullet("Private data: activity on private repos. Owner-only in the dashboard. Absent from all other surfaces in server-rendered DOM."),
      bullet("AI payload data: aggregated metadata (timestamps, counts, language tags, signal categories). Sent to LLM. Does not include repo names, commit messages, file names, or code content."),
      bullet("Longitudinal payload data: stored per-user per-month. Not public. Not included in shared or challenge surfaces. Powers delta narrative."),
      bullet("Auth tokens: AES-256 encrypted at rest. Never logged. Never exposed client-side."),
      h2("9.2 Non-Negotiable Privacy Rules"),
      bullet("Dev Card, challenge page, public report, and public profile: zero private data in DOM. Server-rendered absent, not CSS-hidden."),
      bullet("Challenge Link shows challenger's PUBLIC stats only. Challenged user's stats are never pre-fetched or cached server-side."),
      bullet("AI payload never includes: repo names (hashed only), commit messages, file names, branch names, or any code content."),
      bullet("LLM API calls are server-side only. User's GitHub token is never involved in the LLM call."),
      bullet("Stored longitudinal payloads deleted immediately on account deletion."),
      bullet("prefers-reduced-motion respected across all animation systems."),
      h2("9.3 Security"),
      bullet("GitHub API calls server-side only. OAuth tokens never exposed to client-side JS."),
      bullet("Challenge Links are time-limited: expire 30 days after generation. Not reusable after expiry."),
      bullet("Rate limiting: report generation max 10 req/user/min. LLM calls max 5 req/user/min."),
      bullet("HTTPS enforced everywhere. HSTS. CSP headers on all public surfaces."),
      bullet("GDPR: full data export and deletion within 30 days of request."),
      divider(),

      // ══ 10. TECHNICAL ARCHITECTURE ══════════════════════════════════════════
      h1("10. Technical Architecture"),
      h2("10.1 Stack"),
      spacer(80),
      simpleTable(
        ["Layer", "Technology", "Role"],
        [2000, 3000, 4360],
        [
          ["Frontend", "React + TypeScript", "Dashboard, public surfaces, Dev Card, challenge page"],
          ["Animation: UI", "Framer Motion", "Component transitions, Dev Card hover, month selector, route transitions"],
          ["Animation: Canvas", "GSAP + ScrollTrigger", "Cinematic first-run sequence, bar chart, heatmap stagger, number roll-ups"],
          ["Backend API", "Node.js + Fastify", "Report generation, aggregation engine, LLM orchestration"],
          ["AI layer", "Claude API (Haiku model)", "Narrative generation from structured payload. ~$0.001/report"],
          ["Database", "PostgreSQL", "Users, reports, payloads (versioned schema), achievements, challenge links"],
          ["Cache", "Redis", "Report cache, LLM output cache (24h TTL), session storage, rate limiting"],
          ["Job queue", "BullMQ", "Async report generation, LLM calls, OG image generation"],
          ["OG images", "Satori + Sharp", "Server-side Dev Card → PNG for social previews"],
          ["CDN", "Cloudflare", "Public surfaces (report, profile, challenge) edge-cached. 60s TTL"],
          ["Auth", "GitHub OAuth 2.0", "Scoped token access. public_repo default."]
        ]
      ),
      spacer(120),

      h2("10.2 Report Generation Pipeline"),
      callout("Full pipeline", "5F5E5A", "F9F9F9", [
        "GitHub API  →  Data ingestion worker",
        "            →  Aggregation engine (commits, lines, PRs, timestamps)",
        "            →  Pattern classification (category_signal per repo)",
        "            →  Metric computation (focus_score, streaks, peak_hour_block)",
        "            →  Persona derivation (deterministic)",
        "            →  Payload assembly (JSON, ~400–600 tokens)",
        "            →  LLM call (Claude Haiku — narrative generation)",
        "            →  Achievement evaluation (unlock checks)",
        "            →  Report object assembly",
        "            →  Payload storage (versioned, longitudinal)",
        "            →  OG image generation (Satori → PNG, async)",
        "            →  Public rendering layer (edge cache)",
        "            →  Private rendering layer (auth-gated, server-rendered)"
      ]),
      spacer(120),
      divider(),

      // ══ 11. NON-FUNCTIONAL REQUIREMENTS ════════════════════════════════════
      h1("11. Non-Functional Requirements"),
      h2("11.1 Performance"),
      bullet("Report generation (full pipeline including LLM): < 10s at P95 Phase 1, < 6s Phase 2."),
      bullet("Dashboard load (fast mode, cached): < 1.5s at P95."),
      bullet("Public report / challenge page (edge-cached): < 1.2s at P95."),
      bullet("Dev Card OG image generation: < 3s at P95 (async, does not block report display)."),
      bullet("Cinematic first-run sequence: begins streaming data within 3s of OAuth completion."),
      h2("11.2 Availability & Resilience"),
      bullet("Target uptime: 99.5% monthly."),
      bullet("LLM layer failure: report displays without AI narrative. 'Insights generating...' placeholder shown. Retry queued."),
      bullet("GitHub API rate limit: report generation backs off gracefully. User notified with ETA."),
      bullet("Challenge page: if challenger's data is unavailable, page shows 'Report generating' rather than 404."),
      h2("11.3 Scale"),
      bullet("Architecture supports 50,000 MAU without re-architecture."),
      bullet("LLM cost at 50k MAU, 70% monthly report generation rate: ~35,000 calls/month at ~$0.001 = ~$35/month. Trivial."),
      bullet("OG image generation: async job queue. No user-facing latency impact."),
      h2("11.4 Accessibility"),
      bullet("WCAG 2.1 AA across all surfaces."),
      bullet("prefers-reduced-motion: all GSAP and Framer Motion animations wrapped in matchMedia check. Instant fallback."),
      bullet("Dev Card: all stats have aria-label. Persona badge has descriptive alt text."),
      bullet("Challenge page: fully operable without JavaScript (progressive enhancement)."),
      divider(),

      // ══ 12. ROADMAP ══════════════════════════════════════════════════════════
      h1("12. Roadmap"),
      spacer(80),
      milestoneTable([
        ["Phase 1", "MVP + Viral Core", "Weeks 1–12", "Auth, onboarding, AI Storyteller Engine, Dev Card (P0), cinematic first-run, fast mode, Challenge Link, shared report page with frictionless CTA, social share, PDF export"],
        ["Phase 2", "Retention & Notifications", "Weeks 10–20", "Monthly report notifications, Challenge received alerts, MoM delta narrative, past reports archive, link revocation, weekly digest, saved comparisons"],
        ["Phase 2", "Achievement System", "Weeks 14–22", "10 core achievements, milestone cards, AI achievement callouts, profile badge display"],
        ["Phase 3", "Developer Identity Layer", "Weeks 22–34", "Public developer profile, monthly archive, highlights, SEO indexing, AI 6-month context, growth patterns"],
        ["Phase 3", "Notifications expansion", "Weeks 28–36", "Milestone alerts, public report engagement analytics, share link view counts"],
        ["Phase 4", "Growth & Ecosystem", "Weeks 36–52", "Dev card embed (README), growth timeline, API access, shareable milestone cards, engineering growth chart"]
      ]),
      spacer(120),
      divider(),

      // ══ 13. STRATEGIC PRIORITIES ════════════════════════════════════════════
      h1("13. Strategic Priority Order"),
      spacer(80),
      new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [1200, 8160],
        rows: [
          new TableRow({ tableHeader: true, children: ["#", "Priority"].map((h, i) => new TableCell({ borders, width: { size: [1200, 8160][i], type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 140, right: 140 }, shading: { fill: "0D1117", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 20, bold: true, color: "FFFFFF" })] })] })) }),
          ...[
            ["1", "Data readability — every decision defers to legibility of the developer's story"],
            ["2", "Privacy certainty — developers must feel visually certain private code is not shared"],
            ["3", "AI narrative quality — the reflective summary is the product's core value; it must earn sharing"],
            ["4", "Dev Card shareability — if developers don't post it, the loop doesn't activate"],
            ["5", "Fast recurring experience — the dashboard must feel like a pro tool after month one"],
            ["6", "Challenge mechanic — competitive tension is the highest-leverage acquisition channel"],
            ["7", "Longitudinal depth — accumulated context is the retention moat; it compounds every month"],
            ["8", "Developer identity ecosystem — public profile and achievements create long-term stickiness"]
          ].map(([n, p], idx) => new TableRow({
            children: [
              new TableCell({ borders, width: { size: 1200, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: idx % 2 === 0 ? "F9F9F9" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: n, font: "Arial", size: 22, bold: true, color: "185FA5" })] })] }),
              new TableCell({ borders, width: { size: 8160, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, shading: { fill: idx % 2 === 0 ? "F9F9F9" : "FFFFFF", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: p, font: "Arial", size: 20, color: "2C2C2A" })] })] }),
            ]
          }))
        ]
      }),
      spacer(120),
      divider(),

      // ══ 14. OPEN QUESTIONS ═══════════════════════════════════════════════════
      h1("14. Open Questions"),
      bullet("LLM scope: should commit message text ever be included in the AI payload for richer classification, or does privacy compliance require metadata-only? If the former, a legal review of terms is required before implementation."),
      bullet("Challenge Link expiry: 30 days proposed. Should challenges be permanent (archived comparison pages) or ephemeral? Permanent creates a richer public surface but increases storage complexity."),
      bullet("Persona stability UX: if a developer's persona shifts month-to-month, does that feel like growth or inconsistency? Consider a 'dominant persona' derived from a 3-month rolling window rather than a single month."),
      bullet("Opt-out from challenges: should developers be able to disable the ability for others to send them challenge links?"),
      bullet("Public profile opt-in vs opt-out: privacy positioning strongly favours opt-in (default private). Confirm before Phase 3 build."),
      bullet("Monetisation: free tier (public repos, basic narrative, Dev Card) vs paid (private repo visibility, extended LLM context, milestone cards, API access)?"),
      bullet("Mobile app: responsive PWA sufficient for Phase 1–2? Native app evaluation at Phase 3 based on usage data."),
      divider(),

      // ══ 15. APPENDIX ══════════════════════════════════════════════════════════
      h1("15. Appendix"),
      h2("15.1 Glossary"),
      bullet("AI Storyteller Engine: the server-side pipeline that transforms raw GitHub data into structured AI payloads and LLM-generated narrative summaries."),
      bullet("category_signal: server-computed classification of a repo's work pattern (e.g. high_churn_refactor, feature_build) used as input to the LLM and persona derivation."),
      bullet("focus_score: 0.0–1.0 metric representing how concentrated a developer's monthly work was in a single repo. Computed server-side, stored in payload."),
      bullet("Developer persona: deterministic classification of a developer's monthly working style (The Architect, The Shipper, etc.) derived from category_signal distribution."),
      bullet("Dev Card: the primary shareable visual component — a trading-card-style summary of the developer's monthly report. The core viral surface."),
      bullet("Challenge Link: a shareable URL that presents the challenger's public stats alongside a blank 'your stats' card, with a CTA to connect GitHub and reveal the comparison."),
      bullet("Cinematic mode: the animated, scroll-triggered first-run experience. Runs once per user on their first report only."),
      bullet("Fast mode: the information-dense, non-animated dashboard view for all subsequent visits after the first report."),
      bullet("Longitudinal payload: the stored JSON payload from previous months used to generate month-over-month delta narratives in the AI summary."),
      bullet("Milestone Card: a separate shareable OG image generated for streak and volume achievements. Same design language as the Dev Card."),
      h2("15.2 Related Documents"),
      bullet("GitReport — Design System & Competitive Positioning (design.md v3.0 — update pending)"),
      bullet("GitReport — Site Map v2 (interactive diagram, product wiki)"),
      bullet("GitReport — AI Payload Schema (engineering specification, TBD)"),
      bullet("GitReport — API Schema (OpenAPI, TBD)"),
      bullet("GitReport — Privacy Impact Assessment (legal review pending)"),
      bullet("GitReport — OG Image Specification (design, TBD)"),
      spacer(200),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 0 }, children: [new TextRun({ text: "End of Document — GitReport PRD v3.0", font: "Arial", size: 20, color: "888780" })] })
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  const path = require('path');
  const outPath = path.join(__dirname, '..', 'docs', 'GitReport_PRD_v3.docx');
  fs.writeFileSync(outPath, buf);
  console.log("Done");
});

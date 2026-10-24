// Plain-language PDF of an athlete's fueling and recovery report.
// Hand-written PDF writer with no dependencies: US Letter pages, Helvetica text, simple tables.
// All text is converted to ASCII, so string lengths match byte offsets.

import { kgToLb, formatHeight, perLb } from "./units.js";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const BOTTOM = 60; // keep clear of the footer
const CHAR_EM = 0.52; // average Helvetica character width, in em
const INK = "0.12 0.12 0.12";
const MUTED = "0.42 0.42 0.42";
const ACCENT = "0.62 0.13 0.38";
const ALERT = "0.6 0.2 0.1";

function toPdfText(value) {
  const ascii = String(value)
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7E]/g, "?");
  return ascii.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function fit(text, maxChars) {
  const s = String(text);
  return s.length <= maxChars ? s : `${s.slice(0, Math.max(1, maxChars - 1))}.`;
}

class Doc {
  constructor() {
    this.pages = [];
    this.newPage();
  }

  newPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = PAGE_H - MARGIN;
  }

  need(height) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  draw(x, y, size, text, { bold = false, color = INK } = {}) {
    this.ops.push(`${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${toPdfText(text)}) Tj ET`);
  }

  rule(y) {
    this.ops.push(`0.8 0.8 0.8 RG 0.5 w ${MARGIN} ${y} m ${PAGE_W - MARGIN} ${y} l S`);
  }

  heading(text) {
    this.y -= 10;
    this.need(40);
    this.draw(MARGIN, this.y, 13, text, { bold: true, color: ACCENT });
    this.y -= 6;
    this.rule(this.y);
    this.y -= 14;
  }

  paragraph(text, { size = 10, bold = false, color = INK, gap = 6, indent = 0 } = {}) {
    const lineH = size + 4;
    const maxChars = Math.floor((CONTENT_W - indent) / (size * CHAR_EM));
    for (const line of wrap(text, maxChars)) {
      this.need(lineH);
      this.draw(MARGIN + indent, this.y, size, line, { bold, color });
      this.y -= lineH;
    }
    this.y -= gap;
  }

  // Label on the left, value wrapped on the right.
  keyValues(pairs, size = 10) {
    const labelW = 190;
    const lineH = size + 4;
    const maxChars = Math.floor((CONTENT_W - labelW) / (size * CHAR_EM));
    for (const [label, value] of pairs) {
      const lines = wrap(value, maxChars);
      this.need(lineH * lines.length + 4);
      this.draw(MARGIN, this.y, size, label, { bold: true });
      lines.forEach((line, i) => {
        this.draw(MARGIN + labelW, this.y - i * lineH, size, line);
      });
      this.y -= lineH * lines.length + 4;
    }
    this.y -= 4;
  }

  // Columns: [{ label, width, align }]. Rows: arrays of strings. Header repeats on each page.
  table(columns, rows, size = 8) {
    const lineH = size + 6;
    const cellX = (col, colX, text) =>
      col.align === "right" ? colX + col.width - String(text).length * size * CHAR_EM - 4 : colX + 4;
    const maxChars = (col) => Math.floor((col.width - 8) / (size * CHAR_EM));
    const drawRow = (cells, bold = false, color = INK) => {
      let colX = MARGIN;
      columns.forEach((col, i) => {
        const text = fit(cells[i] ?? "", maxChars(col));
        this.draw(cellX(col, colX, text), this.y, size, text, { bold, color });
        colX += col.width;
      });
    };
    const drawHeader = () => {
      this.need(lineH * 2);
      drawRow(
        columns.map((c) => c.label),
        true,
        ACCENT,
      );
      this.rule(this.y - 3);
      this.y -= lineH;
    };

    drawHeader();
    for (const row of rows) {
      if (this.y - lineH < BOTTOM) {
        this.newPage();
        drawHeader();
      }
      drawRow(row);
      this.y -= lineH;
    }
    this.y -= 6;
  }

  // Adds the footer to every page and returns the complete PDF text.
  finish(footerText) {
    const total = this.pages.length;
    this.pages.forEach((ops, i) => {
      this.ops = ops;
      this.draw(MARGIN, 30, 8, `${footerText}   Page ${i + 1} of ${total}`, { color: MUTED });
    });
    return serialize(this.pages);
  }
}

// Objects: 1 catalog, 2 page tree, 3 Helvetica, 4 Helvetica-Bold, then a page and content stream per page.
function serialize(pages) {
  const objects = [];
  const kids = [];
  let next = 5;
  pages.forEach((ops) => {
    const pageId = next++;
    const contentId = next++;
    kids.push(`${pageId} 0 R`);
    const stream = ops.join("\n");
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  let out = "%PDF-1.4\n";
  const offsets = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return out;
}

const STATUS_LABEL = {
  ok: "Stable. Fueling covers training.",
  flagged: "Flagged for clinician review.",
  insufficient: "Not enough data yet.",
};

const shortDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
const longDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
const num = (value, digits = 0) => (value === null || value === undefined ? "n/a" : Number(value).toFixed(digits));
const lbText = (kg) => (kg === null || kg === undefined ? "Not set" : `${Math.round(kgToLb(kg))} lb`);

// Builds the PDF text for an athlete report from /api/report-data.
export function buildReportPdf(report) {
  const doc = new Doc();
  const athlete = report.athlete ?? {};
  const uf = report.underfueling ?? {};
  const cur = uf.report?.current ?? null;
  const fuelingRows = cur && !cur.insufficient;

  doc.paragraph("WHY THO", { size: 10, bold: true, color: ACCENT, gap: 2 });
  doc.paragraph(`Athlete report: ${athlete.name ?? "Athlete"}`, { size: 20, bold: true, gap: 4 });
  doc.paragraph(
    `Generated ${new Date(report.generatedAt).toLocaleString("en-US")}. Covers ${longDate(report.periodStart)} to ${longDate(report.periodEnd)} (last ${report.windowDays} days).`,
    { size: 10, color: MUTED, gap: 10 },
  );
  if (report.demoData) {
    doc.paragraph("DEMO DATA: this report uses synthetic demo values, not real measurements.", {
      bold: true,
      color: ALERT,
      gap: 10,
    });
  }

  doc.heading("1. Summary");
  doc.keyValues([
    ["Fueling status", STATUS_LABEL[uf.status] ?? uf.status ?? "n/a"],
    ["Why", uf.reason ?? ""],
    ["Trends moving the wrong way", uf.signals?.length ? uf.signals.join(", ") : "None"],
  ]);
  if (uf.persistent) {
    doc.paragraph("Low fueling has lasted two weeks in a row. This is the pattern a clinician should review.");
  }

  doc.heading("2. Last 7 days in detail");
  if (!fuelingRows) {
    doc.paragraph("Meals were logged on fewer than 5 of the last 7 days, so the fueling numbers are not shown.");
  } else {
    doc.keyValues([
      ["Days with meals logged", `${cur.loggedDays} of 7`],
      ["Training days", `${cur.trainingDays ?? 0} of 7`],
      ["Average eaten per day", `${num(cur.eatenPerDay)} kcal`],
      ["Energy used per day (estimate)", `${num(cur.expendedPerDay)} kcal`],
      [
        "Eaten below energy used",
        cur.gapPerDay === null || cur.gapPerDay === undefined
          ? "Not calculated (needs resting metabolic rate)"
          : `${num(cur.gapPerDay)} kcal a day (a positive number means eating less than the body uses)`,
      ],
      [
        "Energy availability",
        cur.energyAvailability === null || cur.energyAvailability === undefined
          ? "Not calculated (needs fat-free mass)"
          : `${num(perLb(cur.energyAvailability), 1)} kcal per lb of fat-free mass a day (low below 13.6)`,
      ],
      [
        "Carbohydrate per day",
        cur.carbsPerKg === null || cur.carbsPerKg === undefined
          ? "n/a"
          : `${num(perLb(cur.carbsPerKg), 1)} g per lb (training target about ${num(perLb(cur.carbTargetPerKg), 1)} g per lb)`,
      ],
      ["Protein per day", cur.proteinPerKg == null ? "n/a" : `${num(perLb(cur.proteinPerKg), 2)} g per lb`],
      ["Sodium per day", cur.sodiumPerDay == null ? "n/a" : `${num(cur.sodiumPerDay)} mg`],
    ]);
    if (cur.flags?.length) {
      doc.paragraph("Flags in the last 7 days:", { bold: true, gap: 4 });
      for (const flag of cur.flags) {
        doc.paragraph(`- ${flag.label}: ${flag.detail}.`, { indent: 12, gap: 3 });
      }
      doc.y -= 4;
    } else {
      doc.paragraph("No flags in the last 7 days.");
    }
  }

  doc.heading("3. Athlete profile");
  doc.keyValues([
    ["Sex", athlete.sex ?? "Not set"],
    ["Age", athlete.age ? `${athlete.age}` : "Not set"],
    ["Height", formatHeight(athlete.heightCm)],
    ["Weight", lbText(athlete.weightKg)],
    ["Fat-free mass", lbText(athlete.ffmKg)],
    ["Measured resting metabolic rate", athlete.rmrKcal ? `${athlete.rmrKcal} kcal a day` : "Not set"],
    ["Period tracking", athlete.cycleTracking || athlete.sex === "Female" ? "On" : "Off"],
  ]);

  doc.heading("4. Weekly averages (4 weeks)");
  doc.paragraph(
    "Each row averages one 7-day block. Energy availability is the energy left for body functions after exercise, per pound of fat-free mass.",
    { size: 9, color: MUTED },
  );
  doc.table(
    [
      { label: "Week ending", width: 90 },
      { label: "Days logged", width: 70, align: "right" },
      { label: "Energy avail. kcal/lb", width: 90, align: "right" },
      { label: "Resting HR (bpm)", width: 80, align: "right" },
      { label: "HRV (ms)", width: 80, align: "right" },
      { label: "Sleep (h)", width: 102, align: "right" },
    ],
    (report.weekly ?? []).map((w) => [
      longDate(w.weekEnding),
      `${w.loggedDays} of 7`,
      w.energyAvailability === null || w.energyAvailability === undefined
        ? "n/a"
        : num(perLb(w.energyAvailability), 1),
      num(w.restingHr, 1),
      num(w.hrvMs, 1),
      num(w.sleepHours, 1),
    ]),
  );

  if (report.days?.length) {
    doc.heading("5. Day by day");
    doc.paragraph(
      "A dash means nothing was logged or synced for that day. Eaten is the estimated calories from meals logged that day.",
      { size: 9, color: MUTED },
    );
    const dash = (v) => (v === null || v === undefined ? "-" : String(v));
    doc.table(
      [
        { label: "Date", width: 58 },
        { label: "Eaten kcal", width: 50, align: "right" },
        { label: "Train min", width: 46, align: "right" },
        { label: "Exercise kcal", width: 56, align: "right" },
        { label: "Protein g", width: 50, align: "right" },
        { label: "Carbs g", width: 48, align: "right" },
        { label: "Sodium mg", width: 52, align: "right" },
        { label: "Rest HR", width: 50, align: "right" },
        { label: "HRV ms", width: 50, align: "right" },
        { label: "Sleep h", width: 52, align: "right" },
      ],
      report.days.map((d) => [
        shortDate(d.date),
        dash(d.intakeKcal),
        dash(d.exerciseMin),
        dash(d.exerciseKcal),
        dash(d.proteinG),
        dash(d.carbsG),
        dash(d.sodiumMg),
        dash(d.restingHr),
        dash(d.hrvMs),
        d.sleepHours == null ? "-" : Number(d.sleepHours).toFixed(1),
      ]),
      7.5,
    );
  }

  if (report.cycle) {
    doc.heading("6. Menstrual cycle");
    doc.keyValues([
      [
        "Average cycle length",
        report.cycle.averageLength ? `${report.cycle.averageLength} days` : "Not enough period starts recorded",
      ],
      ["Recent cycle lengths", report.cycle.lengths?.length ? report.cycle.lengths.join(", ") + " days" : "None yet"],
      ["Irregular cycle", report.cycle.irregular ? "Yes" : "No"],
      ["Next period (estimate)", report.cycle.nextPeriod ? longDate(report.cycle.nextPeriod) : "n/a"],
    ]);
  }

  doc.heading(report.cycle ? "7. What the terms mean" : "6. What the terms mean");
  doc.paragraph(
    "Energy availability: energy left for body functions after exercise, per pound of fat-free mass a day. Below 13.6 kcal per lb is a sign of low fueling.",
    { size: 9, indent: 0 },
  );
  doc.paragraph(
    "Eaten below energy used: the gap between intake and the estimate of what the body uses, from resting metabolic rate, exercise, and protein digestion.",
    { size: 9 },
  );
  doc.paragraph(
    "Carbohydrate target: set by training time. About 1.4 g per lb on rest days, 2.3 g per lb for up to 60 minutes, and 2.7 g per lb for longer sessions.",
    { size: 9 },
  );
  doc.paragraph(
    "Resting HR, HRV, and sleep: recovery signals from the wearable. A rising resting heart rate, falling HRV, or shorter sleep can mean the body is under strain.",
    { size: 9 },
  );

  doc.heading(report.cycle ? "8. Notes" : "7. Notes");
  doc.paragraph(report.disclaimer ?? "", { size: 9, color: MUTED });

  return doc.finish("WHY THO athlete report");
}

// Browser Blob for download. The PDF text is ASCII, so the byte encoding is exact.
export function reportPdfBlob(report) {
  return new Blob([buildReportPdf(report)], { type: "application/pdf" });
}

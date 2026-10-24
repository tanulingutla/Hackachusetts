import { useState } from "react";
import ExpandDialog from "./ExpandDialog.jsx";

// Clear line chart for athletes. Each chart has a plain-language description, a verdict comparing the
// last 7 days with the 7 days before, labeled axes, and an Enlarge button for a full-size view.
// series: [{ label, color, points: [{ date, value }] }]
// goodWhen: "higher" | "lower" | "none". Sets whether a rise is better, worse, or just a change.

const VIEW_W = 640;
const VIEW_H = 300;
const PAD = { top: 18, right: 22, bottom: 40, left: 64 };

function shortDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function average(points) {
  return points.reduce((sum, p) => sum + p.value, 0) / points.length;
}

// Last 7 valid days against the 7 valid days before them.
function verdict(points, goodWhen, unit, decimals) {
  const valid = points.filter((p) => p.value !== null && p.value !== undefined);
  const recent = valid.slice(-7);
  const prior = valid.slice(-14, -7);
  if (recent.length < 3 || prior.length < 3) return null;

  const recentAvg = average(recent);
  const priorAvg = average(prior);
  const change = recentAvg - priorAvg;
  const steady = Math.abs(change) <= Math.max(0.03 * Math.abs(priorAvg), 0.01);

  let tone;
  let text;
  if (steady) {
    tone = "steady";
    text = "About the same as last week";
  } else if (goodWhen === "none") {
    tone = "neutral";
    text = change > 0 ? "Up from last week" : "Down from last week";
  } else {
    const better = (change > 0) === (goodWhen === "higher");
    tone = better ? "good" : "watch";
    text = better ? "Better than last week" : "Worse than last week";
  }

  return {
    tone,
    text,
    summary: `The last 7 days averaged ${recentAvg.toFixed(decimals)} ${unit}. The 7 days before averaged ${priorAvg.toFixed(decimals)} ${unit}.`,
  };
}

function ChartBody({ series, unit, decimals, goodWhen, plain, large }) {
  const allValues = series.flatMap((s) => s.points.map((p) => p.value)).filter((v) => v !== null && v !== undefined);
  const dates = series[0]?.points.map((p) => p.date) ?? [];

  if (allValues.length === 0) {
    return <p className="muted">No data in this window yet.</p>;
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;

  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (dates.length <= 1 ? 0 : (i / (dates.length - 1)) * innerW);
  const y = (v) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);

  function linePath(points) {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      if (p.value === null || p.value === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  }

  const v = verdict(series[0].points, goodWhen, unit, decimals);
  const latest = [...series[0].points].reverse().find((p) => p.value !== null && p.value !== undefined);
  const mid = Math.floor((dates.length - 1) / 2);
  const labelIndexes = [0, mid, dates.length - 1].filter((i, idx, arr) => arr.indexOf(i) === idx);

  const description = `${series.map((s) => s.label).join(" and ")} over the last ${dates.length} days. ${
    v ? `${v.text}. ${v.summary}` : ""
  }`;

  return (
    <div className={large ? "chart-body large" : "chart-body"}>
      {plain && <p className="chart-plain">{plain}</p>}

      <div className="chart-summary">
        {latest && (
          <div className="chart-latest">
            <span className="chart-latest-value">
              {latest.value.toFixed(decimals)} <span className="unit">{unit}</span>
            </span>
            <span className="muted">latest reading, {shortDate(latest.date)}</span>
          </div>
        )}
        {v && <span className={`chart-verdict verdict-${v.tone}`}>{v.text}</span>}
      </div>
      {v && <p className="chart-compare muted">{v.summary}</p>}

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={description} className="chart-svg">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" className="axis-label">
              {t.toFixed(decimals)}
            </text>
          </g>
        ))}
        <text x={14} y={PAD.top + innerH / 2} className="axis-title" transform={`rotate(-90 14 ${PAD.top + innerH / 2})`} textAnchor="middle">
          {unit}
        </text>

        {labelIndexes.map((i) => (
          <text key={i} x={x(i)} y={VIEW_H - 14} textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"} className="axis-label">
            {shortDate(dates[i])}
          </text>
        ))}

        {series.map((s) => (
          <g key={s.label}>
            <path
              d={linePath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={large ? 3.5 : 2.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength="1"
              className="chart-line"
            />
            {s.points.map((p, i) =>
              p.value === null || p.value === undefined ? null : (
                <circle key={p.date} cx={x(i)} cy={y(p.value)} r={p === latest ? 5.5 : 3} fill={s.color} className="chart-dot">
                  <title>{`${shortDate(p.date)}: ${p.value.toFixed(decimals)} ${unit}`}</title>
                </circle>
              )
            )}
          </g>
        ))}
      </svg>

      <ul className="legend-list">
        {series.map((s) => (
          <li key={s.label}>
            <span className="swatch" style={{ background: s.color }} /> {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Chart({ title, unit, series, decimals = 0, goodWhen = "none", plain }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <figure className="chart-card">
        <figcaption className="chart-head">
          <div>
            <strong className="chart-title">{title}</strong>
          </div>
          <button
            type="button"
            className="enlarge-button"
            onClick={() => setOpen(true)}
            aria-label={`Enlarge ${title}`}
          >
            Enlarge
          </button>
        </figcaption>
        <ChartBody series={series} unit={unit} decimals={decimals} goodWhen={goodWhen} plain={plain} />
      </figure>

      {open && (
        <ExpandDialog title={title} onClose={() => setOpen(false)}>
          <ChartBody series={series} unit={unit} decimals={decimals} goodWhen={goodWhen} plain={plain} large />
        </ExpandDialog>
      )}
    </>
  );
}

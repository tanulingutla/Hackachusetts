import { useMemo, useState } from "react";
import { localDate } from "../lib/dates.js";
import { useTrends } from "../lib/useTrends.js";

const RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 28, label: "Last 4 weeks" },
  { days: 90, label: "Last 3 months" },
];

// Sport keyword -> category used for the icon color and label.
const CATEGORIES = {
  run: { glyph: "run", color: "#e8772e", name: "Running", match: /run/ },
  bike: { glyph: "bike", color: "#3da35d", name: "Cycling", match: /cycl|bik/ },
  swim: { glyph: "swim", color: "#2f6fdb", name: "Swimming", match: /swim/ },
  gym: { glyph: "gym", color: "#282828", name: "Strength", match: /strength|yoga|pilates|hiit|climb/ },
  other: { glyph: "gym", color: "#8a8a8a", name: "Training", match: /./ },
};

// White sport pictograms drawn for this app. They sit inside the colored activity circles.
function ActivityGlyph({ kind }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
    fill: "none",
    stroke: "#fff",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
  if (kind === "run") {
    return (
      <svg {...common}>
        <circle cx="14" cy="4.5" r="2" fill="#fff" stroke="none" />
        <path d="M12.5 8 L10 13.5 L13.5 15.5 L12 20.5" />
        <path d="M12.5 9 L16.5 11.5 L19 10.5" />
        <path d="M11.5 9.5 L8 11.5 L5.5 10.5" />
        <path d="M10 13.5 L6.5 15.5 L4 13" />
      </svg>
    );
  }
  if (kind === "bike") {
    return (
      <svg {...common}>
        <circle cx="6" cy="16" r="4" />
        <circle cx="18" cy="16" r="4" />
        <path d="M6 16 L10 9 L15 9 L18 16" />
        <path d="M10 9 L12 16 L6 16" />
        <path d="M15 9 L13.5 6 H16.5" />
      </svg>
    );
  }
  if (kind === "swim") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="2" fill="#fff" stroke="none" />
        <path d="M11 9.5 Q14 5.5 18 8.5" />
        <path d="M5 13.5 L14 12.5" />
        <path d="M2 18 q2.5 -2 5 0 t5 0 t5 0 t5 0 t5 0" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="8" width="3" height="8" rx="1" fill="#fff" stroke="none" />
      <rect x="18" y="8" width="3" height="8" rx="1" fill="#fff" stroke="none" />
      <rect x="6.5" y="10" width="2.5" height="4" rx="0.5" fill="#fff" stroke="none" />
      <rect x="15" y="10" width="2.5" height="4" rx="0.5" fill="#fff" stroke="none" />
      <path d="M9 12 H15" />
    </svg>
  );
}

function categoryOf(sport) {
  const key = Object.keys(CATEGORIES).find((k) => k !== "other" && CATEGORIES[k].match.test(sport));
  return key ?? "other";
}

function sportNames(sports) {
  if (!sports) return [];
  return sports
    .split(";")
    .map((s) => s.trim().replace(/_/g, " "))
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

// Row title and icon come from the first sport. Mixed days say so.
function summarize(sports) {
  const list = sportNames(sports);
  if (list.length === 0) return { category: "other", title: "Training", subtitle: "Training" };
  const categories = [...new Set(list.map((s) => categoryOf(s.toLowerCase())))];
  const primary = categories.length === 1 ? categories[0] : "other";
  const title = categories.length === 1 ? CATEGORIES[primary].name : "Mixed training";
  return { category: primary, title, subtitle: list.join(" · ") };
}

// Minutes to h:mm:ss (or m:ss under an hour).
function formatDuration(minutes) {
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function shortDate(date) {
  const d = new Date(`${date}T00:00:00`);
  return {
    day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    year: d.getFullYear(),
  };
}

function Metric({ value, label }) {
  return (
    <div className="activity-metric">
      <span className="activity-metric-value">{value}</span>
      <span className="activity-metric-label">{label}</span>
    </div>
  );
}

export default function ActivitiesPanel() {
  const [range, setRange] = useState(28);
  const { data, error } = useTrends(90);

  const sessions = useMemo(() => {
    if (!data) return [];
    const cutoff = localDate(new Date(Date.now() - (range - 1) * 86400000));
    return data.days
      .filter((d) => (d.exerciseMin ?? 0) > 0 || (d.exerciseKcal ?? 0) > 0)
      .filter((d) => d.date >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, range]);

  if (error) return <p role="alert" className="flag">{error}</p>;

  return (
    <div className="stack">
      <div className="activities-toolbar">
        <p className="muted">
          {sessions.length} {sessions.length === 1 ? "activity" : "activities"}
        </p>
        <label htmlFor="activity-range" className="sr-only">
          Show activities from
        </label>
        <select id="activity-range" value={range} onChange={(e) => setRange(Number(e.target.value))}>
          {RANGES.map((r) => (
            <option key={r.days} value={r.days}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {!data && <p className="muted">Loading activities...</p>}

      {data && sessions.length === 0 && (
        <section className="card">
          <p className="muted">
            No activities in this range. Import daily data from the Import data page to see your sessions here.
          </p>
        </section>
      )}

      {sessions.length > 0 && (
        <div className="activity-scroll">
          <ul className="activity-list" role="list">
            {sessions.map((d) => {
              const { category, title, subtitle } = summarize(d.sports);
              const { day, year } = shortDate(d.date);
              const meta = CATEGORIES[category];
              return (
                <li key={d.date} className="activity-row">
                  <span
                    className="activity-icon"
                    style={{ background: meta.color }}
                    aria-hidden="true"
                  >
                    <ActivityGlyph kind={meta.glyph} />
                  </span>

                  <div className="activity-date">
                    <span className="activity-day">{day}</span>
                    <span className="activity-year">{year}</span>
                  </div>

                  <div className="activity-name">
                    <span className="activity-title">{title}</span>
                    <span className="activity-sports">{subtitle}</span>
                  </div>

                  <Metric value={formatDuration(d.exerciseMin ?? 0)} label="Time" />
                  <Metric value={`${d.exerciseKcal ?? 0} kcal`} label="Energy" />
                  <Metric value={d.acuteLoad ?? "--"} label="Load" />
                  <Metric value={d.restingHr ? `${d.restingHr} bpm` : "--"} label="Resting HR" />
                  <Metric value={d.sleepHours ? `${d.sleepHours.toFixed(1)} h` : "--"} label="Sleep" />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

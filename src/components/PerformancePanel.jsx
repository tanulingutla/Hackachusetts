import { useState } from "react";
import { useTrends } from "../lib/useTrends.js";
import Chart from "./Chart.jsx";
import ExpandDialog from "./ExpandDialog.jsx";

function average(values) {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

function fmt(value, digits = 0) {
  return value === null ? "n/a" : value.toFixed(digits);
}

// Weekly totals as bars. Each bar is scaled to the largest week. Enlarge opens a full-size view.
function WeeklyBars({ weeks, valueKey, unit, label, plain }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...weeks.map((w) => w[valueKey] ?? 0));
  const description = weeks.map((w) => `Week ending ${w.weekEnding}: ${Math.round(w[valueKey])} ${unit}`).join(". ");

  const body = (large) => (
    <>
      <p className="chart-plain">{plain}</p>
      <div className={large ? "weekly-bars large" : "weekly-bars"} role="img" aria-label={`${label}. ${description}`}>
        {weeks.map((w) => (
          <div key={w.weekEnding} className="weekly-bar-col">
            <span className="weekly-bar-value">
              {Math.round(w[valueKey]).toLocaleString()} <span className="unit">{unit}</span>
            </span>
            <div className="weekly-bar" style={{ height: `${((w[valueKey] ?? 0) / max) * 100}%` }} />
            <span className="weekly-bar-label">Week ending {w.weekEnding.slice(5)}</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <figure className="weekly-bars-card">
        <figcaption className="chart-head">
          <strong className="chart-title">{label}</strong>
          <button type="button" className="enlarge-button" onClick={() => setOpen(true)} aria-label={`Enlarge ${label}`}>
            Enlarge
          </button>
        </figcaption>
        {body(false)}
      </figure>
      {open && (
        <ExpandDialog title={label} onClose={() => setOpen(false)}>
          {body(true)}
        </ExpandDialog>
      )}
    </>
  );
}

// Performance stats for athletes: training against recovery, in plain language.
export default function PerformancePanel() {
  const { data, error } = useTrends(28);

  if (error) return <p role="alert" className="flag">{error}</p>;
  if (!data) return <p className="muted">Loading performance stats...</p>;

  // Group the 28 days into four weeks, oldest first.
  const weeks = [];
  for (let i = 0; i < data.days.length; i += 7) {
    const slice = data.days.slice(i, i + 7);
    weeks.push({
      weekEnding: slice[slice.length - 1].date,
      sessions: slice.filter((d) => (d.exerciseMin ?? 0) > 0).length,
      minutes: slice.reduce((sum, d) => sum + (d.exerciseMin ?? 0), 0),
      energy: slice.reduce((sum, d) => sum + (d.exerciseKcal ?? 0), 0),
      restingHr: average(slice.map((d) => d.restingHr)),
      hrv: average(slice.map((d) => d.hrvMs)),
      sleep: average(slice.map((d) => d.sleepHours)),
    });
  }

  const series = (pick) => data.days.map((d) => ({ date: d.date, value: pick(d) }));

  return (
    <div className="stack">
      <section className="card" aria-labelledby="how-to-read">
        <h2 id="how-to-read">How to read this page</h2>
        <p className="muted">
          Each chart shows the last 4 weeks, one point per day. The label under each title says whether the latest week
          is better, worse, or about the same as the week before. Press Enlarge to see a chart full size.
        </p>
      </section>

      <section className="card" aria-labelledby="weekly-visual-heading">
        <h2 id="weekly-visual-heading">Training by week</h2>
        <div className="grid-2">
          <WeeklyBars
            weeks={weeks}
            valueKey="minutes"
            unit="min"
            label="Training minutes"
            plain="Total minutes of training each week. More minutes means more work for your body."
          />
          <WeeklyBars
            weeks={weeks}
            valueKey="energy"
            unit="kcal"
            label="Energy used in training"
            plain="Energy your training burned each week. This is the fuel your body needed to do the work."
          />
        </div>
      </section>

      <div className="grid-2">
        <Chart
          title="Energy used in training"
          unit="kcal"
          goodWhen="none"
          plain="How much energy each day's training burned. Higher means a harder day."
          series={[{ label: "Energy used", color: "#ff0083", points: series((d) => d.exerciseKcal) }]}
        />
        <Chart
          title="Resting heart rate"
          unit="bpm"
          goodWhen="lower"
          plain="How fast your heart beats when you are completely at rest. A steady rise over several days can mean you are tired or under-recovered. Lower is usually better."
          series={[{ label: "Resting heart rate", color: "#282828", points: series((d) => d.restingHr) }]}
        />
        <Chart
          title="HRV (recovery score)"
          unit="ms"
          goodWhen="higher"
          plain="Heart rate variability: how much the time between heartbeats changes. Higher usually means your body has recovered well. A steady drop can be an early warning sign of fatigue."
          series={[{ label: "HRV", color: "#b40060", points: series((d) => d.hrvMs) }]}
        />
        <Chart
          title="Sleep"
          unit="h"
          decimals={1}
          goodWhen="higher"
          plain="Hours you slept the night before. Most athletes need about 7 to 9 hours to recover from training."
          series={[{ label: "Sleep", color: "#282828", points: series((d) => d.sleepHours) }]}
        />
      </div>

      <section className="card" aria-labelledby="perf-heading">
        <h2 id="perf-heading">Weekly numbers</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Week ending</th>
                <th scope="col">Training days</th>
                <th scope="col">Minutes</th>
                <th scope="col">Energy used</th>
                <th scope="col">Resting heart rate</th>
                <th scope="col">HRV</th>
                <th scope="col">Sleep</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.weekEnding}>
                  <th scope="row">{w.weekEnding}</th>
                  <td>{w.sessions} of 7</td>
                  <td>{w.minutes}</td>
                  <td>{w.energy} kcal</td>
                  <td>{fmt(w.restingHr, 1)} bpm</td>
                  <td>{fmt(w.hrv, 1)} ms</td>
                  <td>{fmt(w.sleep, 1)} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { localDate } from "../lib/dates.js";
import { perLb } from "../lib/units.js";
import Chart from "./Chart.jsx";

const STATUS_TEXT = {
  ok: "Stable",
  watch: "Watch",
  flagged: "Flagged for review",
  insufficient: "Not enough data",
  unavailable: "Needs body composition",
};

function fmt(value, digits = 0) {
  return value === null || value === undefined ? "n/a" : value.toFixed(digits);
}

// Weekly view. The underfueling call uses week-over-week trends, not any single day.
export default function TrendsPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/trends?end=${localDate()}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p role="alert" className="flag">{error}</p>;
  if (!data) return <p className="muted">Loading trends...</p>;

  const { days, weekly, underfueling, ffmKg } = data;
  const series = (pick) => days.map((d) => ({ date: d.date, value: pick(d) }));

  return (
    <div className="stack">
      <section className="card" aria-labelledby="uf-heading">
        <h2 id="uf-heading">Weekly fueling check</h2>
        <p>
          <strong>{STATUS_TEXT[underfueling.status] ?? underfueling.status}.</strong> {underfueling.reason}
        </p>
        {underfueling.signals?.length > 0 && (
          <p className="muted">Trends moving the wrong way: {underfueling.signals.join(", ")}.</p>
        )}
        {underfueling.weeks && (
          <table className="data-table">
            <caption className="muted">Previous 7 days compared with the latest 7 days</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Previous week</th>
                <th scope="col">Latest week</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Days with meals logged</th>
                <td>{underfueling.weeks.previous.loggedDays} of 7</td>
                <td>{underfueling.weeks.current.loggedDays} of 7</td>
              </tr>
              <tr>
                <th scope="row">Energy availability (kcal/lb FFM)</th>
                <td>{fmt(perLb(underfueling.weeks.previous.energyAvailability), 1)}</td>
                <td>{fmt(perLb(underfueling.weeks.current.energyAvailability), 1)}</td>
              </tr>
              <tr>
                <th scope="row">Resting HR (bpm)</th>
                <td>{fmt(underfueling.weeks.previous.restingHr, 1)}</td>
                <td>{fmt(underfueling.weeks.current.restingHr, 1)}</td>
              </tr>
              <tr>
                <th scope="row">HRV (ms)</th>
                <td>{fmt(underfueling.weeks.previous.hrvMs, 1)}</td>
                <td>{fmt(underfueling.weeks.current.hrvMs, 1)}</td>
              </tr>
              <tr>
                <th scope="row">Sleep (hours)</th>
                <td>{fmt(underfueling.weeks.previous.sleepHours, 1)}</td>
                <td>{fmt(underfueling.weeks.current.sleepHours, 1)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <div className="grid-2">
        <Chart
          title="Resting heart rate"
          unit="bpm"
          series={[{ label: "Resting HR", color: "#282828", points: series((d) => d.restingHr) }]}
        />
        <Chart
          title="HRV against baseline"
          unit="ms"
          series={[
            { label: "HRV", color: "#b40060", points: series((d) => d.hrvMs) },
            { label: "Baseline", color: "#8a8a8a", points: series((d) => d.hrvBaselineMid) },
          ]}
        />
        <Chart
          title="Sleep"
          unit="h"
          decimals={1}
          series={[{ label: "Sleep", color: "#282828", points: series((d) => d.sleepHours) }]}
        />
        <Chart
          title="Intake and exercise"
          unit="kcal"
          series={[
            { label: "Intake (best guess)", color: "#282828", points: series((d) => d.intake?.mid ?? null) },
            { label: "Exercise", color: "#ff0083", points: series((d) => d.exerciseKcal) },
          ]}
        />
        {ffmKg && (
          <Chart
            title="Energy availability"
            unit="kcal/lb FFM"
            decimals={1}
            series={[
              {
                label: "Energy availability",
                color: "#b40060",
                points: series((d) => perLb(d.energyAvailability)),
              },
            ]}
          />
        )}
      </div>

      <section className="card" aria-labelledby="weekly-heading">
        <h2 id="weekly-heading">Weekly averages</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Week ending</th>
              <th scope="col">Days logged</th>
              <th scope="col">Energy availability</th>
              <th scope="col">Resting HR</th>
              <th scope="col">HRV</th>
              <th scope="col">Sleep</th>
            </tr>
          </thead>
          <tbody>
            {weekly.map((w) => (
              <tr key={w.weekEnding}>
                <th scope="row">{w.weekEnding}</th>
                <td>{w.loggedDays} of 7</td>
                <td>{fmt(w.energyAvailability, 1)}</td>
                <td>{fmt(w.restingHr, 1)}</td>
                <td>{fmt(w.hrvMs, 1)}</td>
                <td>{fmt(w.sleepHours, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

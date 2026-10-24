import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const STATUS_TEXT = {
  ok: "Stable",
  watch: "Watch",
  flagged: "Flagged for clinician review",
  insufficient: "Not enough data",
  unavailable: "Needs body composition",
};

function fmt(value, digits = 0) {
  return value === null || value === undefined ? "n/a" : value.toFixed(digits);
}

// Read-only report opened from a share link. No sign-in needed.
export default function ReportView({ token }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/report?token=${encodeURIComponent(token)}`)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) {
    return (
      <main className="center">
        <p role="alert" className="flag">
          {error}
        </p>
      </main>
    );
  }
  if (!report) return <p className="center muted">Loading report...</p>;

  const { athlete, underfueling, weekly, cycle } = report;

  return (
    <main className="report">
      <p className="brand">why tho report</p>
      <h1>{athlete.name ?? "Athlete"}</h1>
      <p className="muted">
        Generated {new Date(report.generatedAt).toLocaleString()}. Covers the last {report.windowDays} days.
      </p>

      <section className="card" aria-labelledby="r-uf">
        <h2 id="r-uf">Weekly fueling check</h2>
        <p>
          <strong>{STATUS_TEXT[underfueling.status] ?? underfueling.status}.</strong> {underfueling.reason}
        </p>
        {underfueling.signals?.length > 0 && <p>Trends moving the wrong way: {underfueling.signals.join(", ")}.</p>}
      </section>

      <section className="card" aria-labelledby="r-weekly">
        <h2 id="r-weekly">Weekly averages</h2>
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

      {cycle && (
        <section className="card" aria-labelledby="r-cycle">
          <h2 id="r-cycle">Menstrual cycle</h2>
          {cycle.averageLength === null ? (
            <p className="muted">No period starts recorded.</p>
          ) : (
            <p>
              Average length {cycle.averageLength} days. Recent lengths: {cycle.lengths.join(", ") || "one cycle logged"}.
              {cycle.irregular ? " Cycle lengths are irregular." : ""}
            </p>
          )}
        </section>
      )}

      <p className="muted">{report.disclaimer}</p>
    </main>
  );
}

import { useEffect, useState } from "react";
import { dayTarget, proteinTefKcal } from "../lib/analytics.js";
import { api } from "../lib/api.js";
import { localDate } from "../lib/dates.js";
import { useTrends } from "../lib/useTrends.js";
import VoiceLogger from "./VoiceLogger.jsx";

// Meals and targets: today's log plus the last 14 days of intake against target.
export default function NutritionPanel({ user }) {
  const { data, error } = useTrends(14);
  const [reloadKey, setReloadKey] = useState(0);
  const [summaryError, setSummaryError] = useState("");
  const [summary, setSummary] = useState(null);
  const today = localDate();

  useEffect(() => {
    api(`/summary?date=${today}`)
      .then(setSummary)
      .catch((err) => setSummaryError(err.message));
  }, [today, reloadKey]);

  if (error || summaryError) {
    return (
      <p role="alert" className="flag">
        {error || summaryError}
      </p>
    );
  }

  const rows = data
    ? data.days
        .slice()
        .reverse()
        .map((d) => {
          const base = dayTarget({
            ffmKg: user.ffmKg,
            rmrKcal: user.rmrKcal,
            exerciseKcal: d.exerciseKcal ?? 0,
          });
          const target = base ? base.kcal + proteinTefKcal(d.proteinG ?? 0) : null;
          const eaten = d.intake?.mid ?? null;
          return {
            date: d.date,
            eaten,
            target,
            remaining: target !== null && eaten !== null ? target - eaten : null,
          };
        })
    : [];

  return (
    <div className="stack">
      <section className="card">
        <h2>Today</h2>
        {summary ? (
          <div className="stats">
            <div className="stat">
              <span className="label">Target</span>
              <span className="value">{summary.target ? `${summary.target.kcal} kcal` : "Not set"}</span>
              <span className="muted">
                {summary.target ? summary.target.method : "Add fat-free mass or RMR in Profile."}
              </span>
            </div>
            <div className="stat">
              <span className="label">Eaten</span>
              <span className="value">{summary.eaten.mid} kcal</span>
              <span className="muted">
                range {summary.eaten.low} to {summary.eaten.high}
              </span>
            </div>
            <div className="stat">
              <span className="label">Remaining</span>
              <span className="value">{summary.remaining ? `${summary.remaining.kcal} kcal` : "n/a"}</span>
            </div>
          </div>
        ) : (
          <p className="muted">Loading today...</p>
        )}
      </section>

      <VoiceLogger date={today} onSaved={() => setReloadKey((k) => k + 1)} />

      <section className="card" aria-labelledby="history-heading">
        <h2 id="history-heading">Last 14 days</h2>
        {!data && <p className="muted">Loading history...</p>}
        {data && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Eaten (best guess)</th>
                  <th scope="col">Target</th>
                  <th scope="col">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <th scope="row">{r.date}</th>
                    <td>{r.eaten === null ? "No meals logged" : `${r.eaten} kcal`}</td>
                    <td>{r.target === null ? "Not set" : `${r.target} kcal`}</td>
                    <td>{r.remaining === null ? "n/a" : `${r.remaining} kcal`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

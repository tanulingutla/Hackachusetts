import { useTrends } from "../lib/useTrends.js";
import { perLb } from "../lib/units.js";

const STATUS_TEXT = {
  ok: "Stable",
  watch: "Watch",
  flagged: "Underfueled this week",
  insufficient: "Not enough data yet",
  unavailable: "Needs body composition",
};

function fmt(value, digits = 0) {
  return value === null || value === undefined ? "n/a" : value.toFixed(digits);
}

// Insights: the weekly fueling check and the trends behind it. Judged over weeks, not single days.
export default function InsightsPanel() {
  const { data, error } = useTrends(28);

  if (error) return <p role="alert" className="flag">{error}</p>;
  if (!data) return <p className="muted">Loading insights...</p>;

  const { underfueling } = data;

  return (
    <div className="stack">
      <section className="card" aria-labelledby="insight-heading">
        <h2 id="insight-heading">Weekly fueling check</h2>
        <p className="status-line">
          <span className={`status-pill status-${underfueling.status}`}>
            {STATUS_TEXT[underfueling.status] ?? underfueling.status}
          </span>
        </p>
        <p>{underfueling.reason}</p>
        {underfueling.signals?.length > 0 && (
          <p className="muted">Trends moving the wrong way: {underfueling.signals.join(", ")}.</p>
        )}
        <p className="muted">
          The check looks at 7-day windows, never a single day. It flags a week when energy availability is below
          13.6 kcal/lb of fat-free mass, carbohydrate or sodium is low for training, or protein is low.
        </p>
      </section>

      {data.carbs && data.carbs.gramsPerKg !== null && (
        <section className="card" aria-labelledby="carb-heading">
          <h2 id="carb-heading">Carbohydrate check</h2>
          <p className="status-line">
            <span className={`status-pill status-${data.carbs.status === "low" ? "watch" : "ok"}`}>
              {data.carbs.status === "low" ? "Carbs low" : "Carbs adequate"}
            </span>
          </p>
          <p>
            Over the last 4 weeks, carbohydrate averaged <strong>{perLb(data.carbs.gramsPerKg)} g per lb</strong>. The
            guidance for this training load is about {perLb(data.carbs.targetGPerKg)} g per lb.
          </p>
          <p className="muted">
            Low carbohydrate with heavy training can limit recovery and performance. This is a general reference, not
            a diagnosis.
          </p>
        </section>
      )}

      {underfueling.weeks && (
        <section className="card" aria-labelledby="compare-heading">
          <h2 id="compare-heading">Previous week and latest week</h2>
          <table className="data-table">
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
        </section>
      )}
    </div>
  );
}

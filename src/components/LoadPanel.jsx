import { useTrends } from "../lib/useTrends.js";
import Chart from "./Chart.jsx";

// Training load: acute (last 7 days) against chronic (longer baseline) load, and their ratio.
// The ratio is a load-management signal, not a diagnosis.
export default function LoadPanel() {
  const { data, error } = useTrends(42);

  if (error) return <p role="alert" className="flag">{error}</p>;
  if (!data) return <p className="muted">Loading training load...</p>;

  const days = data.days;
  const series = (pick) => days.map((d) => ({ date: d.date, value: pick(d) }));
  const ratio = (d) =>
    d.acuteLoad !== null && d.chronicLoad ? Math.round((d.acuteLoad / d.chronicLoad) * 100) / 100 : null;
  const hasLoad = days.some((d) => d.acuteLoad !== null);

  return (
    <div className="stack">
      <section className="card">
        <h2>Training load</h2>
        <p className="muted">
          Acute load is the recent week of training. Chronic load is the longer baseline. A ratio well above 1.5
          suggests a sharp increase, and a ratio below 0.8 suggests a drop in training. Both are worth discussing,
          not diagnosing.
        </p>
        {!hasLoad && (
          <p className="flag">No load values yet. Import a CSV that includes acute_load and chronic_load.</p>
        )}
      </section>

      {hasLoad && (
        <div className="grid-2">
          <Chart
            title="Acute and chronic load"
            unit="load"
            series={[
              { label: "Acute", color: "#ff0083", points: series((d) => d.acuteLoad) },
              { label: "Chronic", color: "#282828", points: series((d) => d.chronicLoad) },
            ]}
          />
          <Chart
            title="Acute to chronic ratio"
            decimals={2}
            series={[{ label: "Ratio", color: "#b40060", points: series(ratio) }]}
          />
        </div>
      )}
    </div>
  );
}

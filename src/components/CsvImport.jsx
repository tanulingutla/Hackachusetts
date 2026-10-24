import { useState } from "react";
import { api } from "../lib/api.js";

// Uploads a daily CSV export and imports it into the athlete's data.
export default function CsvImport({ title, intro }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const csv = await file.text();
      const result = await api("/wearable/import", { method: "POST", csv });
      setStatus(
        `Imported ${result.imported} day${result.imported === 1 ? "" : "s"}. Skipped ${result.skipped} row${
          result.skipped === 1 ? "" : "s"
        } with no valid date. Columns recognized: ${result.columns.join(", ")}.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="csv-heading">
      <h2 id="csv-heading">{title}</h2>
      <p className="muted">{intro}</p>
      <p className="muted">
        Columns can include date, resting_hr, hrv_ms (or hrv), hrv_baseline_low, hrv_baseline_high, sleep_hours,
        exercise_kcal, exercise_min, acute_load, and chronic_load. Implausible values are dropped, not guessed.
      </p>
      <div className="row">
        <label htmlFor="csv-file">CSV file</label>
        <input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={handleImport} disabled={!file || busy}>
          {busy ? "Importing..." : "Import"}
        </button>
      </div>
      {status && <p role="status">{status}</p>}
      {error && (
        <p role="alert" className="flag">
          {error}
        </p>
      )}
    </section>
  );
}

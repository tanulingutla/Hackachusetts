import { useState } from "react";
import { api } from "../lib/api.js";
import { reportPdfBlob } from "../lib/reportPdf.js";

// Builds the athlete's own report as a PDF and downloads it. Nothing is shared by link.
export default function SharePanel() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function downloadPdf() {
    setBusy(true);
    setError("");
    try {
      const report = await api("/report-data");
      const url = URL.createObjectURL(reportPdfBlob(report));
      const link = document.createElement("a");
      link.href = url;
      link.download = `why-tho-report-${report.periodEnd ?? "latest"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Could not create the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="share-heading">
      <h2 id="share-heading">Clinician and coach report</h2>
      <p className="muted">
        Downloads a PDF of your last 28 days. It covers your fueling status, the reasons for it, a weekly
        and day-by-day table, and a plain-language guide to each term. It doesn't include your hormone note
        or the text of your meals.
      </p>
      <button type="button" onClick={downloadPdf} disabled={busy}>
        {busy ? "Creating PDF..." : "Download PDF report"}
      </button>

      {error && (
        <p role="alert" className="flag">
          {error}
        </p>
      )}
    </section>
  );
}

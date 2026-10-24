import { useState } from "react";
import { api } from "../lib/api.js";

// RMR section: the measured resting metabolic rate from a metabolic test.
// It sets the daily target when no fat-free mass is on file: target = RMR + exercise energy.
export default function RmrPanel({ user, onUserChange }) {
  const [rmrKcal, setRmrKcal] = useState(user.rmrKcal ? String(user.rmrKcal) : "");
  const [rmrDate, setRmrDate] = useState(user.rmrDate ?? "");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      // The profile update replaces every field, so send the current profile with the RMR values.
      const data = await api("/me", {
        method: "PUT",
        body: {
          displayName: user.displayName,
          age: user.age,
          sex: user.sex,
          heightCm: user.heightCm,
          weightKg: user.weightKg,
          ffmKg: user.ffmKg,
          cycleTracking: user.cycleTracking,
          hormoneNote: user.hormoneNote,
          rmrKcal: rmrKcal === "" ? null : rmrKcal,
          rmrDate: rmrDate === "" ? null : rmrDate,
        },
      });
      onUserChange(data.user);
      setStatus("RMR saved. Your daily target now uses this value.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hasRmr = Boolean(user.rmrKcal);
  const usesFfm = Boolean(user.ffmKg);

  return (
    <div className="stack">
      <section className="card rmr-hero" aria-labelledby="rmr-summary">
        <div>
          <h2 id="rmr-summary">Measured RMR</h2>
          <p className="muted">
            Resting metabolic rate is the energy your body uses at rest to keep breathing, circulating blood, and
            keeping your brain running.
          </p>
        </div>
        <div className="rmr-figure">
          <span className="rmr-number">{hasRmr ? user.rmrKcal.toLocaleString() : "Not set"}</span>
          <span className="muted">{hasRmr ? "kcal per day" : "Add a test result below"}</span>
          {user.rmrDate && <span className="muted">Tested {user.rmrDate}</span>}
        </div>
      </section>

      <section className="card" aria-labelledby="rmr-effect">
        <h2 id="rmr-effect">How it's used</h2>
        {usesFfm ? (
          <p>
            Your target uses fat-free mass from your body composition scan, so the RMR isn't used for the daily
            target. It still appears here for reference.
          </p>
        ) : hasRmr ? (
          <p>
            On a day with no exercise, your base target is <strong>{user.rmrKcal.toLocaleString()} kcal</strong>.
            Exercise energy from your watch is added on top, and so is the energy needed to digest the protein you
            eat. Sleep is already covered by this resting rate, so it isn't added again.
          </p>
        ) : (
          <p className="muted">Save a measured RMR to set your daily target.</p>
        )}
        <p className="muted">
          Targets are planning estimates. They aren't prescriptions. Discuss your results with a sports dietitian or
          doctor.
        </p>
      </section>

      <form className="card rmr-form" onSubmit={save} aria-labelledby="rmr-form-heading">
        <h2 id="rmr-form-heading">Add or update your RMR test</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="rmr-kcal">Measured RMR (kcal per day)</label>
            <input
              id="rmr-kcal"
              type="number"
              min={800}
              max={4000}
              inputMode="numeric"
              value={rmrKcal}
              onChange={(e) => setRmrKcal(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="rmr-date">Test date</label>
            <input id="rmr-date" type="date" value={rmrDate} onChange={(e) => setRmrDate(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <button type="submit" className="cta" disabled={busy || rmrKcal === ""}>
            {busy ? "Saving..." : "Save RMR"}
          </button>
        </div>
        {status && <p role="status">{status}</p>}
        {error && (
          <p role="alert" className="flag">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

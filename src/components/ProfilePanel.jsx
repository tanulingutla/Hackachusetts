import { useState } from "react";
import { api } from "../lib/api.js";
import { GENDER_OPTIONS } from "../lib/options.js";
import { cmToIn, inToCm, kgToLb, lbToKg } from "../lib/units.js";

const EMPTY = (value) => (value === null || value === undefined ? "" : String(value));
const ROUND = (value, digits = 1) => (value === null || value === undefined ? "" : String(Math.round(value * 10 ** digits) / 10 ** digits));

// Profile sets the numbers the daily target and energy availability depend on.
// Shown in US units (inches, pounds). Stored in metric on the server.
export default function ProfilePanel({ user, onUserChange }) {
  const [form, setForm] = useState({
    displayName: EMPTY(user.displayName),
    age: EMPTY(user.age),
    sex: EMPTY(user.sex),
    heightIn: ROUND(cmToIn(user.heightCm), 1),
    weightLb: ROUND(kgToLb(user.weightKg), 1),
    ffmLb: ROUND(kgToLb(user.ffmKg), 1),
    rmrKcal: EMPTY(user.rmrKcal),
    rmrDate: EMPTY(user.rmrDate),
    cycleTracking: user.cycleTracking,
    hormoneNote: EMPTY(user.hormoneNote),
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      // Convert the US inputs to the metric values the server stores.
      const body = {
        displayName: form.displayName,
        age: form.age,
        sex: form.sex,
        heightCm: inToCm(form.heightIn),
        weightKg: lbToKg(form.weightLb),
        ffmKg: lbToKg(form.ffmLb),
        rmrKcal: form.rmrKcal,
        rmrDate: form.rmrDate,
        cycleTracking: form.cycleTracking,
        hormoneNote: form.hormoneNote,
      };
      const data = await api("/me", { method: "PUT", body });
      onUserChange(data.user);
      setStatus("Profile saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function demo(action) {
    setError("");
    setStatus("");
    try {
      const data = await api(action === "seed" ? "/demo/seed" : "/demo/clear", { method: "POST" });
      setStatus(
        action === "seed"
          ? `Loaded ${data.days} days of synthetic demo data. Check Today and Trends.`
          : "Removed synthetic demo data."
      );
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <form className="card" onSubmit={save} aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile</h2>
        <p className="muted">
          Fat-free mass comes from a body composition scan. Measured RMR comes from a metabolic test. Either
          one sets your daily target. Fat-free mass is preferred because it drives energy availability.
        </p>

        <div className="form-grid">
          <Field label="Name" id="displayName" value={form.displayName} onChange={(v) => update("displayName", v)} />
          <Field label="Age" id="age" type="number" value={form.age} onChange={(v) => update("age", v)} />
          <div className="field">
            <label htmlFor="sex">Gender</label>
            <select id="sex" value={form.sex} onChange={(e) => update("sex", e.target.value)}>
              <option value="">Not set</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <Field label="Height (inches)" id="heightIn" type="number" step="0.5" value={form.heightIn} onChange={(v) => update("heightIn", v)} />
          <Field label="Weight (lb)" id="weightLb" type="number" step="0.1" value={form.weightLb} onChange={(v) => update("weightLb", v)} />
          <Field label="Fat-free mass (lb)" id="ffmLb" type="number" step="0.1" value={form.ffmLb} onChange={(v) => update("ffmLb", v)} />
          <Field label="Measured RMR (kcal/day)" id="rmrKcal" type="number" value={form.rmrKcal} onChange={(v) => update("rmrKcal", v)} />
        </div>

        <div className="row">
          <input
            id="cycleTracking"
            type="checkbox"
            checked={form.cycleTracking}
            onChange={(e) => update("cycleTracking", e.target.checked)}
          />
          <label htmlFor="cycleTracking">Track my period (optional)</label>
        </div>

        <label htmlFor="hormoneNote">Hormone status (private, optional)</label>
        <textarea
          id="hormoneNote"
          rows={2}
          value={form.hormoneNote}
          onChange={(e) => update("hormoneNote", e.target.value)}
        />
        <p className="muted">Only you see this unless you share a report, which includes it.</p>

        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save profile"}
        </button>
        {status && <p role="status">{status}</p>}
        {error && (
          <p role="alert" className="flag">
            {error}
          </p>
        )}
      </form>

      <section className="card" aria-labelledby="demo-heading">
        <h2 id="demo-heading">Demo data</h2>
        <p className="muted">
          Adds 28 days of invented meals and wearable values so you can see the screens. Demo rows are tagged
          and can be removed at any time.
        </p>
        <div className="row">
          <button type="button" onClick={() => demo("seed")}>
            Load demo data
          </button>
          <button type="button" className="tab" onClick={() => demo("clear")}>
            Remove demo data
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, id, value, onChange, type = "text", step }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

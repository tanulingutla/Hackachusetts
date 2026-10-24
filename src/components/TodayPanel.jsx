import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { recentDates } from "../lib/dates.js";
import VoiceLogger from "./VoiceLogger.jsx";
import { perLb } from "../lib/units.js";

// Daily view: what the target is, what has been eaten, and what remains (pending).
function Nutrient({ label, value, unit }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className="value">
        {value} <span className="unit">{unit}</span>
      </span>
    </div>
  );
}

export default function TodayPanel() {
  const [date, setDate] = useState(recentDates(1)[0]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setError("");
    api(`/summary?date=${date}`)
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, [date, reloadKey]);

  async function deleteMeal(id) {
    try {
      await api(`/meals/${id}`, { method: "DELETE" });
      window.dispatchEvent(new Event("meals-changed"));
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="row">
          <h2 className="grow">Day</h2>
          <label htmlFor="day-select">Date</label>
          <select id="day-select" value={date} onChange={(e) => setDate(e.target.value)}>
            {recentDates(14).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="flag">
            {error}
          </p>
        )}
      </section>

      {summary && (
        <>
          <section className="stats" aria-label="Day totals">
            <div className="card stat">
              <span className="label">Target</span>
              <span className="value">{summary.target ? `${summary.target.kcal} kcal` : "Not set"}</span>
              <span className="muted">
                {summary.target ? summary.target.method : "Add fat-free mass or RMR in Profile."}
              </span>
            </div>
            <div className="card stat">
              <span className="label">Eaten</span>
              <span className="value">{summary.eaten.mid} kcal</span>
              <span className="muted">
                range {summary.eaten.low} to {summary.eaten.high}
              </span>
            </div>
            <div className="card stat">
              <span className="label">Remaining</span>
              <span className="value">{summary.remaining ? `${summary.remaining.kcal} kcal` : "n/a"}</span>
              <span className="muted">
                {summary.remaining ? `range ${summary.remaining.low} to ${summary.remaining.high}` : "Needs a target"}
              </span>
            </div>
            <div className="card stat">
              <span className="label">Exercise</span>
              <span className="value">{summary.exerciseKcal} kcal</span>
              <span className="muted">
                {summary.wearable.restingHr ? `Resting HR ${summary.wearable.restingHr} bpm` : "No wearable data for this day"}
              </span>
            </div>
          </section>

          <section className="card training-balance" aria-labelledby="training-heading">
            <h2 id="training-heading">Training energy</h2>
            {summary.training.restingKcal === null ? (
              <p className="muted">
                Add a measured RMR in the RMR section to see how much training energy is still to replace.
              </p>
            ) : (
              <div className="balance-grid">
                <div className="stat">
                  <span className="label">Burned in training</span>
                  <span className="value">{summary.training.exerciseKcal} kcal</span>
                </div>
                <div className="stat">
                  <span className="label">Eaten above resting need</span>
                  <span className="value">{summary.training.eatenAboveResting} kcal</span>
                  <span className="muted">Resting need {summary.training.restingKcal} kcal</span>
                </div>
                <div className="stat">
                  <span className="label">Still to replace</span>
                  <span className="value">{summary.training.stillToReplace} kcal</span>
                  <span className="muted">
                    {summary.training.stillToReplace === 0
                      ? "Training energy is covered."
                      : "Add this much food to cover the workout."}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="nutrients-heading">
            <h2 id="nutrients-heading">Nutrients today</h2>
            <div className="balance-grid">
              <Nutrient label="Protein" value={summary.nutrients.proteinG} unit="g" />
              <Nutrient label="Carbohydrate" value={summary.nutrients.carbsG} unit="g" />
              <Nutrient label="Fat" value={summary.nutrients.fatG} unit="g" />
              <Nutrient label="Fiber" value={summary.nutrients.fiberG} unit="g" />
            </div>
            {summary.nutrients.carbsPerKg === null ? (
              <p className="muted">Set your weight in Profile to check carbohydrate against training guidance.</p>
            ) : (
              <p className={`carb-line carb-${summary.nutrients.carbStatus}`}>
                Carbohydrate is {perLb(summary.nutrients.carbsPerKg)} g per lb. Guidance for this training load is
                about {perLb(summary.nutrients.carbTargetPerKg)} g per lb.{" "}
                {summary.nutrients.carbStatus === "low"
                  ? "Carbs look low for this training. Add grains, fruit, or potatoes."
                  : "Carbs look adequate for this training."}
              </p>
            )}
            <p className="muted">
              Nutrient totals are estimates from the logged foods. Guidance is a general training reference, not a
              prescription.
            </p>
          </section>

          {summary.cycle?.phase && (
            <section className="card">
              <h2>Cycle</h2>
              <p>
                Cycle day {summary.cycle.phase.cycleDay}, estimated <strong>{summary.cycle.phase.phase}</strong>{" "}
                phase.
              </p>
              {summary.cycle.irregular && (
                <p className="flag">Cycle lengths vary a lot. Consider sharing your report with a clinician.</p>
              )}
            </section>
          )}

          <section className="card" aria-labelledby="meals-heading">
            <h2 id="meals-heading">Meals</h2>
            {summary.meals.length === 0 && <p className="muted">Nothing logged for this day yet.</p>}
            <ul className="meal-list">
              {summary.meals.map((m) => (
                <li key={m.id}>
                  <div className="row">
                    <strong className="grow">{m.slot}</strong>
                    <span>
                      {m.estimate.total.low} to {m.estimate.total.high} kcal
                    </span>
                    <button type="button" className="tab" onClick={() => deleteMeal(m.id)}>
                      Remove
                    </button>
                  </div>
                  <div className="muted">{m.text}</div>
                  <div className="meal-macros">
                    Protein {m.nutrients.proteinG} g · Carbs {m.nutrients.carbsG} g · Fat {m.nutrients.fatG} g · Fiber{" "}
                    {m.nutrients.fiberG} g
                  </div>
                  {m.estimate.unmatched?.length > 0 && (
                    <div className="flag">Not counted: {m.estimate.unmatched.join(", ")}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <VoiceLogger date={date} onSaved={() => setReloadKey((k) => k + 1)} />
    </div>
  );
}

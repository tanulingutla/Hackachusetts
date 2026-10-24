import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { localDate } from "../lib/dates.js";
import { useTrends } from "../lib/useTrends.js";
import { perLb } from "../lib/units.js";

const STATUS_TEXT = {
  ok: "Stable",
  watch: "Watch",
  flagged: "Underfueled this week",
  insufficient: "Not enough data yet",
  unavailable: "Needs body composition",
};

// The numbers behind the fueling status, for the last 7 days.
function FuelingDetails({ report }) {
  const c = report.current;
  if (!c || c.insufficient) return null;
  const rows = [
    ["Eaten per day", `${c.eatenPerDay} kcal`],
    ["Needed per day", c.expendedPerDay !== null ? `${c.expendedPerDay} kcal` : "Set RMR"],
    ["Energy gap this week", c.weeklyGap !== null ? `${c.weeklyGap} kcal` : "n/a"],
    ["Energy availability", c.energyAvailability !== null ? `${perLb(c.energyAvailability)} kcal/lb` : "Needs fat-free mass"],
    ["Carbs", c.carbsPerKg !== null ? `${perLb(c.carbsPerKg)} g/lb (target ${perLb(c.carbTargetPerKg)})` : "Set weight"],
    ["Protein", c.proteinPerKg !== null ? `${perLb(c.proteinPerKg)} g/lb` : "Set weight"],
    ["Sodium", c.sodiumPerDay !== null ? `${c.sodiumPerDay} mg a day` : "n/a"],
  ];
  return (
    <>
      {c.flags.length > 0 && (
        <ul className="flag-list">
          {c.flags.map((f) => (
            <li key={f.key}>
              <strong>{f.label}.</strong> {f.detail}.
            </li>
          ))}
        </ul>
      )}
      <dl className="recovery-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

const show = (value, digits = 0) => (value === null || value === undefined ? "n/a" : value.toFixed(digits));

function shortDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

// Small bar chart used inside the focus cards. Values are scaled to the largest bar.
function MiniBars({ items, label }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="mini-bars" role="img" aria-label={label}>
      {items.map((i) => (
        <div key={i.date} className="mini-bar-col">
          <div className="mini-bar" style={{ height: `${(i.value / max) * 100}%` }} title={`${i.date}: ${Math.round(i.value)}`} />
          <span className="mini-bar-label">{shortDay(i.date)}</span>
        </div>
      ))}
    </div>
  );
}

export default function HomeDashboard({ user, onNavigate, onSelectDevice }) {
  const today = localDate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const { data: trends, error: trendsError } = useTrends(28);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("meals-changed", bump);
    return () => window.removeEventListener("meals-changed", bump);
  }, []);

  useEffect(() => {
    api(`/summary?date=${today}`)
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, [today, version]);

  const days = trends?.days ?? [];
  const last7 = days.slice(-7);
  const withData = [...days].reverse().find((d) => d.restingHr !== null || d.intake !== null);
  const rmr = user.rmrKcal ?? null;

  const intakeBars = last7.map((d) => ({ date: d.date, value: d.intake?.mid ?? 0 }));
  const trainingBars = last7.map((d) => ({ date: d.date, value: d.exerciseKcal ?? 0 }));

  const target = summary?.target?.kcal ?? null;
  const eaten = summary?.eaten?.mid ?? 0;
  const progress = target ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  const training = summary?.training;

  return (
    <div className="dashboard">
      <div className="dashboard-top">
        <div>
          <p className="dashboard-date">
            {new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h2 className="dashboard-title">In focus</h2>
        </div>
        <p className="muted">
          {withData ? `Data through ${withData.date}` : "No data yet. Import a CSV or sync a device."}
        </p>
      </div>

      {(user.weightKg == null || (user.rmrKcal == null && user.ffmKg == null)) && (
        <section className="setup-banner" aria-labelledby="setup-heading">
          <div>
            <h2 id="setup-heading">Finish your profile</h2>
            <p className="muted">
              Add your weight and a measured RMR or fat-free mass. Then your daily target, carb guidance, and fueling
              check can be calculated.
            </p>
          </div>
          <button type="button" className="cta" onClick={() => onNavigate("profile")}>
            Open Profile
          </button>
        </section>
      )}

      {trends?.assessment && (
        <section className={`assessment assessment-${trends.assessment.state}`} aria-labelledby="assessment-heading">
          <div className="assessment-head">
            <div>
              <p className="focus-label">Training status this week</p>
              <h2 id="assessment-heading" className="assessment-label">
                {trends.assessment.label}
              </h2>
            </div>
            <button type="button" className="link-button" onClick={() => onNavigate("insights")}>
              Details
            </button>
          </div>
          <p className="assessment-summary">{trends.assessment.summary}</p>
          {trends.assessment.reasons.length > 0 && (
            <ul className="flag-list">
              {trends.assessment.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <dl className="assessment-stats">
            <div>
              <dt>Resting HR</dt>
              <dd>{show(trends.assessment.current.restingHr)} bpm</dd>
            </div>
            <div>
              <dt>HRV</dt>
              <dd>{show(trends.assessment.current.hrvMs)} ms</dd>
            </div>
            <div>
              <dt>Sleep</dt>
              <dd>{show(trends.assessment.current.sleepHours, 1)} h</dd>
            </div>
            <div>
              <dt>Training</dt>
              <dd>{show(trends.assessment.current.exerciseKcal)} kcal/day</dd>
            </div>
          </dl>
        </section>
      )}

      {error && (
        <p role="alert" className="flag">
          {error}
        </p>
      )}

      <div className="dashboard-grid">
        <div className="focus-grid">
          <article className="focus-card">
            <header className="focus-head">
              <span className="focus-label">Meals today</span>
              <button type="button" className="link-button" onClick={() => onNavigate("nutrition")}>
                Log a meal
              </button>
            </header>
            <p className="focus-value">
              {Math.round(eaten).toLocaleString()} <span>kcal</span>
            </p>
            <p className="muted">
              {target ? `of ${target.toLocaleString()} kcal target` : "Set an RMR or body composition for a target"}
            </p>
            <div className="progress" aria-label={`${progress}% of target`}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            {summary?.remaining && (
              <p className="focus-foot">Remaining {summary.remaining.kcal.toLocaleString()} kcal</p>
            )}
            {!trendsError && <MiniBars items={intakeBars} label="Meals eaten, last 7 days" />}
          </article>

          <article className="focus-card">
            <header className="focus-head">
              <span className="focus-label">Training energy</span>
              <button type="button" className="link-button" onClick={() => onNavigate("activities")}>
                Activities
              </button>
            </header>
            <p className="focus-value">
              {(summary?.exerciseKcal ?? 0).toLocaleString()} <span>kcal</span>
            </p>
            {training?.stillToReplace !== null && training?.stillToReplace !== undefined ? (
              <p className="muted">Still to replace: {training.stillToReplace.toLocaleString()} kcal</p>
            ) : (
              <p className="muted">Set an RMR to see what's left to replace</p>
            )}
            {!trendsError && <MiniBars items={trainingBars} label="Training energy, last 7 days" />}
          </article>

          <article className="focus-card">
            <header className="focus-head">
              <span className="focus-label">Resting metabolic rate</span>
              <button type="button" className="link-button" onClick={() => onNavigate("rmr")}>
                Update
              </button>
            </header>
            <p className="focus-value">
              {rmr ? rmr.toLocaleString() : "Not set"} {rmr && <span>kcal</span>}
            </p>
            <p className="muted">{user.rmrDate ? `Measured ${user.rmrDate}` : "Add a measured RMR to set your target"}</p>
          </article>

          <article className="focus-card">
            <header className="focus-head">
              <span className="focus-label">Recovery</span>
              <button type="button" className="link-button" onClick={() => onNavigate("health")}>
                Health stats
              </button>
            </header>
            <dl className="recovery-list">
              <div>
                <dt>Resting HR</dt>
                <dd>{summary?.wearable?.restingHr ? `${summary.wearable.restingHr} bpm` : "No data"}</dd>
              </div>
              <div>
                <dt>HRV</dt>
                <dd>{summary?.wearable?.hrvMs ? `${Math.round(summary.wearable.hrvMs)} ms` : "No data"}</dd>
              </div>
              <div>
                <dt>Sleep</dt>
                <dd>{summary?.wearable?.sleepHours ? `${summary.wearable.sleepHours.toFixed(1)} h` : "No data"}</dd>
              </div>
            </dl>
          </article>
        </div>

        <aside className="side-column">
          <section className="side-card">
            <header className="focus-head">
              <span className="focus-label">Fueling check</span>
              <button type="button" className="link-button" onClick={() => onNavigate("insights")}>
                Details
              </button>
            </header>
            {trends ? (
              <>
                <span className={`status-pill status-${trends.underfueling.status}`}>
                  {STATUS_TEXT[trends.underfueling.status] ?? trends.underfueling.status}
                </span>
                <p className="muted">{trends.underfueling.reason}</p>
                {trends.underfueling.report && <FuelingDetails report={trends.underfueling.report} />}
              </>
            ) : (
              <p className="muted">Loading...</p>
            )}
          </section>

          <section className="side-card">
            <header className="focus-head">
              <span className="focus-label">Today's meals</span>
            </header>
            {summary?.meals?.length ? (
              <ul className="side-list">
                {summary.meals.map((m) => (
                  <li key={m.id}>
                    <span>{m.slot}</span>
                    <span className="muted">
                      {m.estimate.total.low} to {m.estimate.total.high} kcal
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing logged yet today.</p>
            )}
          </section>

        </aside>
      </div>
    </div>
  );
}

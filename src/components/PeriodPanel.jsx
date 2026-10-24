import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { localDate } from "../lib/dates.js";
import { cyclePhase } from "../lib/cycle.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PHASE_LABEL = {
  menstrual: "Menstrual",
  follicular: "Follicular",
  ovulatory: "Ovulatory",
  luteal: "Luteal",
};

// Period tracking. On for female profiles automatically; optional for everyone else.
// Shows a month calendar with estimated phases, logged period starts, and the expected next period.
export default function PeriodPanel({ user }) {
  const trackingOn = user.cycleTracking || user.sex === "Female";
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [newDate, setNewDate] = useState(localDate());
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!trackingOn) return;
    api("/period")
      .then(setData)
      .catch((err) => setError(err.message));
  }, [trackingOn, reloadKey]);

  const starts = useMemo(() => [...(data?.starts ?? [])].sort(), [data]);
  const avgLength = data?.cycle?.averageLength ?? 28;
  const expected = data?.cycle?.nextPeriod ?? null;
  const today = localDate();

  // Phase for any date: the most recent period start on or before it, projected forward by cycle length.
  const cells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const count = new Date(year, monthIndex + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < month.getDay(); i++) list.push(null);
    for (let day = 1; day <= count; day++) {
      const date = localDate(new Date(year, monthIndex, day));
      const lastStart = starts.filter((s) => s <= date).at(-1);
      const info = lastStart ? cyclePhase(date, lastStart, avgLength) : null;
      list.push({
        date,
        day,
        phase: info?.phase ?? null,
        isStart: starts.includes(date),
        isExpected: expected === date,
        isFuture: date > today,
      });
    }
    return list;
  }, [month, starts, avgLength, expected, today]);

  if (!trackingOn) {
    return (
      <section className="card">
        <h2>Period tracking is off</h2>
        <p className="muted">Turn it on in Profile if you want cycle phases and cycle trends.</p>
      </section>
    );
  }

  async function addStart() {
    setError("");
    try {
      await api("/period", { method: "POST", body: { date: newDate } });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeStart(date) {
    setError("");
    try {
      await api("/period", { method: "DELETE", body: { date } });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  function shiftMonth(delta) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  const cycle = data?.cycle;
  const monthTitle = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="stack">
      <section className="card" aria-labelledby="cycle-calendar-heading">
        <div className="cycle-head">
          <h2 id="cycle-calendar-heading">{monthTitle}</h2>
          <div className="row">
            <button type="button" className="tab" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              Previous
            </button>
            <button type="button" className="tab" onClick={() => shiftMonth(1)} aria-label="Next month">
              Next
            </button>
          </div>
        </div>

        <div className="cycle-grid" role="table" aria-label={`Cycle calendar for ${monthTitle}`}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="cycle-weekday" role="columnheader">
              {w}
            </div>
          ))}
          {cells.map((cell, i) =>
            cell === null ? (
              <div key={`blank-${i}`} className="cycle-cell blank" aria-hidden="true" />
            ) : (
              <div
                key={cell.date}
                role="cell"
                className={[
                  "cycle-cell",
                  cell.phase ? `phase-${cell.phase}` : "",
                  cell.isStart ? "is-start" : "",
                  cell.isExpected ? "is-expected" : "",
                  cell.date === today ? "is-today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={`${cell.date}${cell.phase ? `, ${PHASE_LABEL[cell.phase]} phase` : ""}${
                  cell.isStart ? ", period started" : ""
                }${cell.isExpected ? ", expected period" : ""}`}
              >
                <span className="cycle-day">{cell.day}</span>
                {cell.isStart && <span className="cycle-mark">Period</span>}
                {cell.isExpected && !cell.isStart && <span className="cycle-mark">Expected</span>}
              </div>
            )
          )}
        </div>

        <ul className="cycle-legend" aria-label="Legend">
          <li>
            <span className="legend-chip phase-menstrual" /> Menstrual
          </li>
          <li>
            <span className="legend-chip phase-follicular" /> Follicular
          </li>
          <li>
            <span className="legend-chip phase-ovulatory" /> Ovulatory
          </li>
          <li>
            <span className="legend-chip phase-luteal" /> Luteal
          </li>
          <li>
            <span className="legend-chip is-expected-chip" /> Expected period
          </li>
        </ul>
        <p className="muted">
          Phases are estimates from your logged cycle. Ovulation is taken as about 14 days before the next period.
        </p>
      </section>

      {cycle && (
        <section className="card" aria-labelledby="cycle-summary">
          <h2 id="cycle-summary">Cycle summary</h2>
          {cycle.averageLength === null ? (
            <p className="muted">Add a period start below to see your cycle phase.</p>
          ) : (
            <>
              <p>
                Average cycle length: <strong>{cycle.averageLength} days</strong> (last three cycles).
              </p>
              {cycle.lengths.length > 0 && <p className="muted">Recent lengths: {cycle.lengths.join(", ")} days.</p>}
              {cycle.phase && (
                <p>
                  Today is cycle day {cycle.phase.cycleDay}, estimated <strong>{cycle.phase.phase}</strong> phase.
                  Next period expected around {cycle.nextPeriod}.
                </p>
              )}
              {cycle.irregular && (
                <p className="flag">
                  Cycle lengths vary a lot or run past 35 days. Consider sharing your report with a clinician.
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="log-start-heading">
        <h2 id="log-start-heading">Log a period start</h2>
        <div className="row">
          <label htmlFor="period-date">First day of period</label>
          <input id="period-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button type="button" onClick={addStart} disabled={!newDate}>
            Add
          </button>
        </div>
        {error && (
          <p role="alert" className="flag">
            {error}
          </p>
        )}
        {starts.length === 0 ? (
          <p className="muted">No period starts logged yet.</p>
        ) : (
          <ul className="meal-list">
            {[...starts].reverse().map((date) => (
              <li key={date} className="row">
                <span className="grow">{date}</span>
                <button type="button" className="tab" onClick={() => removeStart(date)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

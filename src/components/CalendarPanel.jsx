import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { localDate } from "../lib/dates.js";
import { useTrends } from "../lib/useTrends.js";
import { perLb } from "../lib/units.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

function sportsText(sports) {
  if (!sports) return "Training";
  return sports
    .split(";")
    .map((s) => s.trim().replace(/_/g, " "))
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(", ");
}

function longDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Calendar: each day is a button. Selecting a day shows its activity and its meals by slot.
export default function CalendarPanel({ onNavigate }) {
  const { data, error } = useTrends(28);
  const today = localDate();
  const [selected, setSelected] = useState(today);
  const [day, setDay] = useState(null);
  const [dayError, setDayError] = useState("");

  useEffect(() => {
    setDay(null);
    setDayError("");
    api(`/summary?date=${selected}`)
      .then(setDay)
      .catch((err) => setDayError(err.message));
  }, [selected]);

  if (error) return <p role="alert" className="flag">{error}</p>;
  if (!data) return <p className="muted">Loading calendar...</p>;

  const first = data.days[0].date;
  const [y, m, d] = first.split("-").map(Number);
  const leadingBlanks = new Date(y, m - 1, d).getDay();

  return (
    <div className="stack">
      <section className="card" aria-labelledby="calendar-heading">
        <div className="calendar-top">
          <div>
            <h2 id="calendar-heading">Last 4 weeks</h2>
            <p className="muted">Select a day to see its activity and meals.</p>
          </div>
          <button type="button" className="cta-outline-button" onClick={() => onNavigate("activities")}>
            View past activities
          </button>
        </div>

        <div className="calendar-grid" role="grid" aria-label="Last 28 days">
          {WEEKDAYS.map((w) => (
            <div key={w} className="calendar-weekday" role="columnheader">
              {w}
            </div>
          ))}

          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} className="calendar-cell blank" aria-hidden="true" />
          ))}

          {data.days.map((item) => {
            const trained = (item.exerciseMin ?? 0) > 0;
            const isSelected = item.date === selected;
            const isToday = item.date === today;
            return (
              <button
                key={item.date}
                type="button"
                role="gridcell"
                aria-pressed={isSelected}
                className={[
                  "calendar-cell",
                  "calendar-day",
                  trained ? "trained" : "",
                  isToday ? "today" : "",
                  isSelected ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelected(item.date)}
                aria-label={`${item.date}: ${item.intake ? `${item.intake.mid} kcal logged` : "no meals logged"}, ${
                  trained ? `${item.exerciseMin} minutes of exercise` : "rest day"
                }`}
              >
                <span className="calendar-date">{Number(item.date.slice(8))}</span>
                <span className="calendar-meta">{item.intake ? `${item.intake.mid} kcal` : "No meals"}</span>
                <span className="calendar-meta">{trained ? `${item.exerciseMin} min` : "Rest"}</span>
              </button>
            );
          })}
        </div>

        <div className="legend-row muted">
          <span className="swatch trained-swatch" /> Training day
          <span className="swatch selected-swatch" /> Selected
          <span className="swatch today-swatch" /> Today
        </div>
      </section>

      <section className="card day-detail" aria-labelledby="day-detail-heading" aria-live="polite">
        <h2 id="day-detail-heading">{longDate(selected)}</h2>

        {dayError && (
          <p role="alert" className="flag">
            {dayError}
          </p>
        )}
        {!day && !dayError && <p className="muted">Loading day...</p>}

        {day && (
          <>
            <div className="day-section">
              <h3>Activity</h3>
              {day.wearable.exerciseMin > 0 ? (
                <div className="day-activity">
                  <div>
                    <span className="activity-title">{sportsText(day.wearable.sports)}</span>
                    <span className="muted"> {day.wearable.exerciseMin} min · {day.exerciseKcal} kcal</span>
                  </div>
                  <dl className="recovery-list">
                    <div>
                      <dt>Load</dt>
                      <dd>{day.wearable.acuteLoad ?? "n/a"}</dd>
                    </div>
                    <div>
                      <dt>Resting HR</dt>
                      <dd>{day.wearable.restingHr ? `${day.wearable.restingHr} bpm` : "n/a"}</dd>
                    </div>
                    <div>
                      <dt>Sleep</dt>
                      <dd>{day.wearable.sleepHours ? `${day.wearable.sleepHours.toFixed(1)} h` : "n/a"}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="muted">Rest day. No exercise recorded.</p>
              )}
            </div>

            <div className="day-section">
              <h3>Meals</h3>
              {day.meals.length === 0 ? (
                <p className="muted">Nothing logged for this day.</p>
              ) : (
                <ul className="day-meals">
                  {day.meals.map((meal) => (
                    <li key={meal.id}>
                      <div className="day-meal-head">
                        <span className="day-meal-slot">{SLOT_LABEL[meal.slot] ?? meal.slot}</span>
                        <span className="muted">
                          {meal.estimate.total.low} to {meal.estimate.total.high} kcal
                        </span>
                      </div>
                      <div>{meal.text}</div>
                      <div className="meal-macros">
                        Protein {meal.nutrients.proteinG} g · Carbs {meal.nutrients.carbsG} g · Fat{" "}
                        {meal.nutrients.fatG} g · Fiber {meal.nutrients.fiberG} g · Sodium {meal.nutrients.sodiumMg} mg
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="day-section">
              <h3>Totals</h3>
              <dl className="recovery-list">
                <div>
                  <dt>Eaten</dt>
                  <dd>{day.eaten.mid} kcal</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{day.target ? `${day.target.kcal} kcal` : "Not set"}</dd>
                </div>
                <div>
                  <dt>Remaining</dt>
                  <dd>{day.remaining ? `${day.remaining.kcal} kcal` : "n/a"}</dd>
                </div>
                <div>
                  <dt>Carbs</dt>
                  <dd>
                    {day.nutrients.carbsG} g
                    {day.nutrients.carbsPerKg !== null &&
                      ` (${perLb(day.nutrients.carbsPerKg)} g/lb, target ${perLb(day.nutrients.carbTargetPerKg)})`}
                  </dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

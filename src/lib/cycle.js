// Cycle helpers. Dates are "YYYY-MM-DD" strings in local time.

const DAY_MS = 86400000;

export function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(str, n) {
  const date = parseDate(str);
  date.setDate(date.getDate() + n);
  return formatDate(date);
}

export function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / DAY_MS);
}

// Lengths between consecutive period start dates.
export function cycleLengths(periodStarts) {
  const sorted = [...periodStarts].sort();
  const lengths = [];
  for (let i = 1; i < sorted.length; i++) {
    lengths.push(daysBetween(sorted[i - 1], sorted[i]));
  }
  return lengths;
}

// Average of the last three cycles. Falls back to 28 days with no history.
export function averageCycleLength(periodStarts, fallback = 28) {
  const recent = cycleLengths(periodStarts).slice(-3);
  if (recent.length === 0) return fallback;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}

// Flags cycles that vary by more than 7 days or run longer than 35 days.
// This is a prompt to review with a clinician, not a diagnosis.
export function isIrregular(periodStarts) {
  const lengths = cycleLengths(periodStarts);
  if (lengths.length === 0) return false;
  const max = Math.max(...lengths);
  const min = Math.min(...lengths);
  return max - min > 7 || max > 35;
}

// Estimates the phase for a given day. Ovulation is taken as 14 days before
// the next period, which is a common simplification.
export function cyclePhase(todayStr, lastPeriodStart, cycleLength) {
  const elapsed = daysBetween(lastPeriodStart, todayStr);
  const cycleDay = (((elapsed % cycleLength) + cycleLength) % cycleLength) + 1;
  const ovulationDay = cycleLength - 14;

  let phase;
  if (cycleDay <= 5) phase = "menstrual";
  else if (cycleDay < ovulationDay - 1) phase = "follicular";
  else if (cycleDay <= ovulationDay + 1) phase = "ovulatory";
  else phase = "luteal";

  return { cycleDay, phase, cycleLength, ovulationDay };
}

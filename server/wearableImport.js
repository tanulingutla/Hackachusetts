// Imports daily wearable CSV exports. Accepts the column names used in the
// athlete and Garmin daily files (for example hrv_ms or hrv, hrv_baseline_low or hrv_base_low).
// Values outside plausible ranges are dropped, not guessed, so one bad sensor reading
// does not distort the trends.

export const MAX_IMPORT_ROWS = 400;

const COLUMN_ALIASES = {
  date: ["date"],
  restingHr: ["resting_hr"],
  hrvMs: ["hrv_ms", "hrv"],
  hrvBaselineLow: ["hrv_baseline_low", "hrv_base_low"],
  hrvBaselineHigh: ["hrv_baseline_high", "hrv_base_high"],
  sleepHours: ["sleep_hours"],
  exerciseKcal: ["exercise_kcal"],
  exerciseMin: ["exercise_min"],
  acuteLoad: ["acute_load"],
  chronicLoad: ["chronic_load"],
  sports: ["sports"],
};

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function toNumber(value) {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inRange(value, min, max) {
  return value !== null && value >= min && value <= max ? value : null;
}

function sportsOrNull(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, 200);
  return cleaned === "" ? null : cleaned;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function mapHeaders(headerFields) {
  const index = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const position = headerFields.findIndex((h) => aliases.includes(h.toLowerCase()));
    if (position !== -1) index[field] = position;
  }
  return index;
}

// Returns { rows, skipped, columns }. rows are cleaned daily records.
export function parseWearableCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");

  const headerFields = parseCsvLine(lines[0]);
  const index = mapHeaders(headerFields);
  if (index.date === undefined) throw new Error("CSV needs a date column.");

  const rows = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    if (rows.length >= MAX_IMPORT_ROWS) {
      throw new Error(`Import is limited to ${MAX_IMPORT_ROWS} rows at a time.`);
    }
    const fields = parseCsvLine(line);
    const get = (field) => (index[field] === undefined ? undefined : fields[index[field]]);

    const date = get("date") ?? "";
    if (!isValidDate(date)) {
      skipped += 1;
      continue;
    }

    const low = inRange(toNumber(get("hrvBaselineLow")), 1, 300);
    const high = inRange(toNumber(get("hrvBaselineHigh")), 1, 300);
    const baselineMid = low !== null && high !== null && high > low ? (low + high) / 2 : null;

    rows.push({
      date,
      restingHr: inRange(toNumber(get("restingHr")), 25, 120),
      hrvMs: inRange(toNumber(get("hrvMs")), 10, 250),
      hrvBaselineMid: baselineMid,
      sleepHours: inRange(toNumber(get("sleepHours")), 2, 14),
      exerciseKcal: inRange(toNumber(get("exerciseKcal")), 0, 10000),
      exerciseMin: inRange(toNumber(get("exerciseMin")), 0, 1440),
      acuteLoad: inRange(toNumber(get("acuteLoad")), 0, 100000),
      chronicLoad: inRange(toNumber(get("chronicLoad")), 0, 100000),
      // Sports are semicolon-separated names, for example "running;strength_training".
      sports: sportsOrNull(get("sports")),
    });
  }

  return { rows, skipped, columns: Object.keys(index) };
}

// why tho API. Binds to localhost only.
// Every data route requires a signed-in session except the public clinician report,
// which requires a report token the athlete generated.
import crypto from "node:crypto";
import http from "node:http";
import { db } from "./db.js";
import { parseMealText } from "./llmParser.js";
import {
  attemptAllowed,
  clearFailures,
  clearSessionCookieHeader,
  createReportToken,
  createSessionToken,
  hashPassword,
  readSessionCookie,
  recordFailure,
  sessionCookieHeader,
  userIdFromReportToken,
  userIdFromSession,
  verifyPassword,
} from "./auth.js";
import { buildDemoData } from "./demoData.js";
import { parseWearableCsv } from "./wearableImport.js";
import {
  connectionStatus,
  disconnect,
  finishConnect,
  startConnect,
  syncRecent,
} from "./coros.js";
import { GENDER_OPTIONS } from "../src/lib/options.js";
import { SLOT_NAMES } from "./slots.js";
import {
  carbStatus,
  carbTargetGPerKg,
  dayTarget,
  fuelingReport,
  loadAssessment,
  nutrientsOf,
  proteinTefKcal,
  underfuelingCheck,
  weeklyRollup,
  withEnergyAvailability,
} from "../src/lib/analytics.js";
import { addDays, averageCycleLength, cycleLengths, cyclePhase, isIrregular } from "../src/lib/cycle.js";

const PORT = Number(process.env.PORT) || 8787;
const HOST = "127.0.0.1";
const MAX_JSON_BYTES = 8 * 1024;
const MAX_CSV_BYTES = 1024 * 1024;
const TREND_DAYS = 28;

// Used to keep login timing similar for unknown usernames.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString("hex"));

// ---------- helpers ----------

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, { "content-type": "application/json", ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function readBody(req, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw httpError(413, "Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(req) {
  if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) {
    throw httpError(415, "Expected application/json");
  }
  const text = await readBody(req, MAX_JSON_BYTES);
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw httpError(400, "Invalid JSON");
  }
}

function isDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function requireDate(value) {
  if (!isDateString(value)) throw httpError(400, "date must be YYYY-MM-DD");
  return value;
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateRange(endDate, days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(addDays(endDate, -i));
  return dates;
}

function numberOrNull(value, min, max, label) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw httpError(400, `${label} must be between ${min} and ${max}`);
  }
  return n;
}

function textOrNull(value, maxLength, label) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw httpError(400, `${label} must be text up to ${maxLength} characters`);
  }
  return value.trim();
}

function dateOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!isDateString(value)) throw httpError(400, "RMR test date must be YYYY-MM-DD");
  return value;
}

function genderOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!GENDER_OPTIONS.includes(value)) throw httpError(400, "Gender must be one of the listed options");
  return value;
}

function isEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function currentUserId(req) {
  return userIdFromSession(readSessionCookie(req));
}

function requireUserId(req) {
  const id = currentUserId(req);
  if (!id) throw httpError(401, "Sign in required.");
  return id;
}

function userRow(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    age: row.age,
    sex: row.sex,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    ffmKg: row.ffm_kg,
    rmrKcal: row.rmr_kcal,
    cycleTracking: row.cycle_tracking === 1,
    hormoneNote: row.hormone_note,
    rmrDate: row.rmr_date ?? null,
  };
}

function parseEstimate(json) {
  return JSON.parse(json);
}

// Builds one record per day in the window, used by the summary, trends, and report.
function buildDayRecords(userId, dates) {
  const from = dates[0];
  const to = dates[dates.length - 1];

  const mealRows = db
    .prepare("SELECT date, estimate_json FROM meals WHERE user_id = ? AND date BETWEEN ? AND ?")
    .all(userId, from, to);
  const intakeByDate = new Map();
  const macroByDate = new Map();
  for (const row of mealRows) {
    const estimate = parseEstimate(row.estimate_json);
    const total = estimate.total;
    const macros = nutrientsOf(estimate.items);
    const prior = macroByDate.get(row.date) ?? { proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 };
    macroByDate.set(row.date, {
      proteinG: prior.proteinG + macros.proteinG,
      carbsG: prior.carbsG + macros.carbsG,
      fatG: prior.fatG + macros.fatG,
      fiberG: prior.fiberG + macros.fiberG,
      sodiumMg: prior.sodiumMg + macros.sodiumMg,
    });
    const prev = intakeByDate.get(row.date) ?? { low: 0, mid: 0, high: 0 };
    intakeByDate.set(row.date, {
      low: prev.low + total.low,
      mid: prev.mid + total.mid,
      high: prev.high + total.high,
    });
  }

  const wearableRows = db
    .prepare("SELECT * FROM wearable_days WHERE user_id = ? AND date BETWEEN ? AND ?")
    .all(userId, from, to);
  const wearableByDate = new Map(wearableRows.map((r) => [r.date, r]));

  return dates.map((date) => {
    const w = wearableByDate.get(date);
    return {
      date,
      intake: intakeByDate.get(date) ?? null,
      exerciseKcal: w?.exercise_kcal ?? null,
      exerciseMin: w?.exercise_min ?? null,
      acuteLoad: w?.acute_load ?? null,
      chronicLoad: w?.chronic_load ?? null,
      sports: w?.sports ?? null,
      proteinG: macroByDate.get(date)?.proteinG ?? 0,
      carbsG: macroByDate.get(date)?.carbsG ?? 0,
      fatG: macroByDate.get(date)?.fatG ?? 0,
      fiberG: macroByDate.get(date)?.fiberG ?? 0,
      sodiumMg: macroByDate.get(date)?.sodiumMg ?? 0,
      restingHr: w?.resting_hr ?? null,
      hrvMs: w?.hrv_ms ?? null,
      hrvBaselineMid: w?.hrv_baseline_mid ?? null,
      sleepHours: w?.sleep_hours ?? null,
    };
  });
}

function cycleSummary(user, today) {
  // Period tracking is on for female profiles automatically, and optional for everyone else.
  if (!(user.cycle_tracking || user.sex === "Female")) return null;
  const starts = db
    .prepare("SELECT start_date FROM period_starts WHERE user_id = ? ORDER BY start_date")
    .all(user.id)
    .map((r) => r.start_date);
  if (starts.length === 0) {
    return { tracking: true, starts: [], lengths: [], averageLength: null, irregular: false, phase: null };
  }
  const averageLength = averageCycleLength(starts);
  const lastStart = starts[starts.length - 1];
  return {
    tracking: true,
    starts,
    lengths: cycleLengths(starts),
    averageLength,
    irregular: isIrregular(starts),
    phase: cyclePhase(today, lastStart, averageLength),
    nextPeriod: addDays(lastStart, averageLength),
  };
}

// ---------- route handlers ----------

async function handleSignup(req, res) {
  const ip = req.socket.remoteAddress ?? "unknown";
  if (!attemptAllowed(ip)) return sendJson(res, 429, { error: "Too many attempts. Try again in 15 minutes." });

  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const age = Number(body.age);

  if (name.length < 2 || name.length > 60) {
    return sendJson(res, 400, { error: "Name must be 2 to 60 characters." });
  }
  if (!isEmail(email)) {
    return sendJson(res, 400, { error: "Enter a valid email address." });
  }
  if (!GENDER_OPTIONS.includes(body.gender)) {
    return sendJson(res, 400, { error: "Choose a gender option." });
  }
  if (!Number.isInteger(age) || age < 13 || age > 100) {
    return sendJson(res, 400, { error: "Age must be a whole number from 13 to 100." });
  }
  if (password.length < 12 || password.length > 200) {
    return sendJson(res, 400, { error: "Password must be 12 to 200 characters." });
  }

  try {
    // The login column stores the email. display_name holds the name, sex holds gender.
    const result = db
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, sex, age, cycle_tracking, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      )
      .run(email, hashPassword(password), name, body.gender, age, new Date().toISOString());
    const user = publicUser(userRow(Number(result.lastInsertRowid)));
    return sendJson(res, 201, { user }, { "set-cookie": sessionCookieHeader(createSessionToken(user.id)) });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      recordFailure(ip);
      return sendJson(res, 409, { error: "An account with that email already exists." });
    }
    throw err;
  }
}

async function handleLogin(req, res) {
  const ip = req.socket.remoteAddress ?? "unknown";
  if (!attemptAllowed(ip)) return sendJson(res, 429, { error: "Too many attempts. Try again in 15 minutes." });

  const body = await readJson(req);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(email);

  const passOk = verifyPassword(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !passOk) {
    recordFailure(ip);
    return sendJson(res, 401, { error: "Invalid username or password." });
  }

  clearFailures(ip);
  const user = publicUser(row);
  return sendJson(res, 200, { user }, { "set-cookie": sessionCookieHeader(createSessionToken(user.id)) });
}

function handleSession(req, res) {
  const id = currentUserId(req);
  if (!id) return sendJson(res, 200, { authenticated: false });
  const row = userRow(id);
  if (!row) return sendJson(res, 200, { authenticated: false });
  return sendJson(res, 200, { authenticated: true, user: publicUser(row) });
}

async function handleUpdateProfile(req, res) {
  const id = requireUserId(req);
  const body = await readJson(req);
  const cycleTracking = body.cycleTracking === true ? 1 : 0;
  db.prepare(
    `UPDATE users SET display_name = ?, age = ?, sex = ?, height_cm = ?, weight_kg = ?,
       ffm_kg = ?, rmr_kcal = ?, rmr_date = ?, cycle_tracking = ?, hormone_note = ? WHERE id = ?`
  ).run(
    textOrNull(body.displayName, 60, "Name"),
    numberOrNull(body.age, 10, 90, "Age"),
    genderOrNull(body.sex),
    numberOrNull(body.heightCm, 100, 230, "Height"),
    numberOrNull(body.weightKg, 30, 250, "Weight"),
    numberOrNull(body.ffmKg, 20, 150, "Fat-free mass"),
    numberOrNull(body.rmrKcal, 800, 4000, "RMR"),
    dateOrNull(body.rmrDate),
    cycleTracking,
    textOrNull(body.hormoneNote, 200, "Hormone note"),
    id
  );
  return sendJson(res, 200, { user: publicUser(userRow(id)) });
}

async function handleCreateMeal(req, res) {
  const id = requireUserId(req);
  const body = await readJson(req);
  const date = requireDate(body.date);
  if (!SLOT_NAMES.includes(body.slot)) throw httpError(400, "slot must be breakfast, lunch, dinner, or snack");
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length === 0 || text.length > 500) throw httpError(400, "text must be 1 to 500 characters");

  // The server runs the estimate and stores it, so the client can't write its own numbers.
  const estimate = await parseMealText(text);
  const meal = {
    id: crypto.randomUUID(),
    date,
    slot: body.slot,
    text,
    source: "user",
    estimate,
  };
  db.prepare(
    "INSERT INTO meals (id, user_id, date, slot, text, source, estimate_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(meal.id, id, date, meal.slot, text, "user", JSON.stringify(estimate), new Date().toISOString());
  return sendJson(res, 201, { meal });
}

function handleListMeals(req, res, query) {
  const id = requireUserId(req);
  const date = requireDate(query.get("date"));
  const rows = db
    .prepare("SELECT id, date, slot, text, source, estimate_json FROM meals WHERE user_id = ? AND date = ?")
    .all(id, date);
  const order = SLOT_NAMES;
  const meals = rows
    .map((r) => ({
      id: r.id,
      date: r.date,
      slot: r.slot,
      text: r.text,
      source: r.source,
      estimate: parseEstimate(r.estimate_json),
    }))
    .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  return sendJson(res, 200, { meals });
}

function handleDeleteMeal(req, res, mealId) {
  const id = requireUserId(req);
  const result = db.prepare("DELETE FROM meals WHERE id = ? AND user_id = ?").run(mealId, id);
  if (result.changes === 0) throw httpError(404, "Meal not found");
  return sendJson(res, 200, { ok: true });
}

async function handleParsePreview(req, res) {
  requireUserId(req);
  const body = await readJson(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length === 0) throw httpError(400, "text is required");
  return sendJson(res, 200, await parseMealText(text));
}

// Training energy balance for a day. Resting energy (measured RMR) is covered first. Whatever
// eaten above that counts toward the training energy, and the rest is still to replace.
function trainingBalance(user, eatenMid, exerciseKcal) {
  if (!user.rmr_kcal) {
    return { exerciseKcal, restingKcal: null, eatenAboveResting: null, stillToReplace: null };
  }
  const restingKcal = Math.round(user.rmr_kcal);
  const eatenAboveResting = Math.max(0, Math.round(eatenMid - restingKcal));
  return {
    exerciseKcal,
    restingKcal,
    eatenAboveResting,
    stillToReplace: Math.max(0, Math.round(exerciseKcal - eatenAboveResting)),
  };
}

// Protein, carbohydrate, fat, and fiber for a day, with carbs checked against training guidance.
function dayNutrients(record, user) {
  const weight = user.weight_kg;
  const carbsPerKg = weight && record.intake ? Math.round((record.carbsG / weight) * 10) / 10 : null;
  const target = carbTargetGPerKg(record.exerciseMin ?? 0);
  return {
    proteinG: record.proteinG,
    carbsG: record.carbsG,
    fatG: record.fatG,
    fiberG: record.fiberG,
    carbsPerKg,
    carbTargetPerKg: target,
    carbStatus: carbStatus(carbsPerKg, target),
  };
}

function handleSummary(req, res, query) {
  const id = requireUserId(req);
  const date = requireDate(query.get("date") ?? localToday());
  const user = userRow(id);

  const [record] = buildDayRecords(id, [date]);
  const eaten = record.intake ?? { low: 0, mid: 0, high: 0 };
  const exercise = record.exerciseKcal ?? 0;
  const target = dayTarget({ ffmKg: user.ffm_kg, rmrKcal: user.rmr_kcal, exerciseKcal: exercise });
  // The day's requirement also covers digesting the protein eaten (thermic effect of food).
  if (target) {
    const proteinTef = proteinTefKcal(record.proteinG);
    target.baseKcal = target.kcal;
    target.proteinG = Math.round(record.proteinG);
    target.proteinTefKcal = proteinTef;
    target.kcal = target.kcal + proteinTef;
    target.method = `${target.method}, plus protein thermic effect`;
  }

  const remaining = target
    ? {
        kcal: target.kcal - eaten.mid,
        low: target.kcal - eaten.high,
        high: target.kcal - eaten.low,
      }
    : null;

  const meals = db
    .prepare("SELECT id, slot, text, source, estimate_json FROM meals WHERE user_id = ? AND date = ?")
    .all(id, date)
    .map((r) => {
      const estimate = parseEstimate(r.estimate_json);
      return { id: r.id, slot: r.slot, text: r.text, source: r.source, estimate, nutrients: nutrientsOf(estimate.items) };
    })
    .sort((a, b) => SLOT_NAMES.indexOf(a.slot) - SLOT_NAMES.indexOf(b.slot));

  return sendJson(res, 200, {
    date,
    target,
    eaten,
    exerciseKcal: exercise,
    training: trainingBalance(user, eaten.mid, exercise),
    nutrients: dayNutrients(record, user),
    remaining,
    meals,
    wearable: {
      restingHr: record.restingHr,
      hrvMs: record.hrvMs,
      hrvBaselineMid: record.hrvBaselineMid,
      sleepHours: record.sleepHours,
      exerciseMin: record.exerciseMin ?? 0,
      sports: record.sports ?? null,
      acuteLoad: record.acuteLoad ?? null,
      chronicLoad: record.chronicLoad ?? null,
    },
    cycle: cycleSummary(user, localToday()),
  });
}

// Underfueling for the UI. Judged over 7-day windows, from the fueling rules in analytics.js.
const FLAG_STATUS = { insufficient: "insufficient", ok: "ok", underfueled: "flagged", persistent: "flagged" };
function fuelingForUi(records, user) {
  const report = fuelingReport(records, {
    rmrKcal: user.rmr_kcal,
    ffmKg: user.ffm_kg,
    weightKg: user.weight_kg,
  });
  const legacy = underfuelingCheck(records, user.ffm_kg);
  return {
    status: FLAG_STATUS[report.status],
    reason: report.reason,
    signals: report.current.flags?.map((f) => f.label) ?? [],
    persistent: report.status === "persistent",
    weeks: legacy.weeks,
    report,
  };
}

// Carbohydrate intake over the window, in grams per kg, against the training-day guidance.
function carbGuidance(records, weightKg) {
  if (!weightKg) return null;
  const logged = records.filter((r) => r.intake);
  if (logged.length === 0) return { gramsPerKg: null, targetGPerKg: null, status: "unknown" };
  const actual = logged.reduce((sum, r) => sum + r.carbsG / weightKg, 0) / logged.length;
  const target = logged.reduce((sum, r) => sum + carbTargetGPerKg(r.exerciseMin ?? 0), 0) / logged.length;
  const gramsPerKg = Math.round(actual * 10) / 10;
  const targetGPerKg = Math.round(target * 10) / 10;
  return { gramsPerKg, targetGPerKg, status: carbStatus(gramsPerKg, targetGPerKg) };
}

function trendsFor(user, endDate, windowDays = TREND_DAYS) {
  const records = buildDayRecords(user.id, dateRange(endDate, windowDays));
  const days = withEnergyAvailability(records, user.ffm_kg);
  return {
    days,
    weekly: weeklyRollup(records, user.ffm_kg),
    underfueling: fuelingForUi(records, user),
    carbs: carbGuidance(records, user.weight_kg),
    assessment: loadAssessment(records, {
      rmrKcal: user.rmr_kcal,
      ffmKg: user.ffm_kg,
      weightKg: user.weight_kg,
    }),
    ffmKg: user.ffm_kg,
  };
}

function handleTrends(req, res, query) {
  const id = requireUserId(req);
  const user = userRow(id);
  const days = Math.min(120, Math.max(7, Number(query.get("days")) || TREND_DAYS));
  return sendJson(res, 200, trendsFor(user, requireDate(query.get("end") ?? localToday()), days));
}

async function handleWearableImport(req, res) {
  const id = requireUserId(req);
  if (!String(req.headers["content-type"] ?? "").startsWith("text/csv")) {
    throw httpError(415, "Expected text/csv");
  }
  const text = await readBody(req, MAX_CSV_BYTES);
  let parsed;
  try {
    parsed = parseWearableCsv(text);
  } catch (err) {
    throw httpError(400, err.message);
  }

  const upsert = db.prepare(`
    INSERT INTO wearable_days (user_id, date, resting_hr, hrv_ms, hrv_baseline_mid, sleep_hours,
      exercise_kcal, exercise_min, acute_load, chronic_load, sports, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import')
    ON CONFLICT(user_id, date) DO UPDATE SET
      resting_hr = excluded.resting_hr, hrv_ms = excluded.hrv_ms,
      hrv_baseline_mid = excluded.hrv_baseline_mid, sleep_hours = excluded.sleep_hours,
      exercise_kcal = excluded.exercise_kcal, exercise_min = excluded.exercise_min,
      acute_load = excluded.acute_load, chronic_load = excluded.chronic_load, sports = excluded.sports, source = 'import'
  `);

  db.exec("BEGIN");
  try {
    for (const r of parsed.rows) {
      upsert.run(
        id, r.date, r.restingHr, r.hrvMs, r.hrvBaselineMid, r.sleepHours,
        r.exerciseKcal, r.exerciseMin, r.acuteLoad, r.chronicLoad, r.sports
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return sendJson(res, 200, { imported: parsed.rows.length, skipped: parsed.skipped, columns: parsed.columns });
}

function handleSeedDemo(req, res) {
  const id = requireUserId(req);
  const demo = buildDemoData();
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM meals WHERE user_id = ? AND source = 'demo'").run(id);
    const insertMeal = db.prepare(
      "INSERT INTO meals (id, user_id, date, slot, text, source, estimate_json, created_at) VALUES (?, ?, ?, ?, ?, 'demo', ?, ?)"
    );
    for (const m of demo.meals) {
      insertMeal.run(crypto.randomUUID(), id, m.date, m.slot, m.text, JSON.stringify(m.estimate), now);
    }
    // Keep any real imported rows that share a date with demo rows.
    const insertWearable = db.prepare(`
      INSERT OR IGNORE INTO wearable_days (user_id, date, resting_hr, hrv_ms, hrv_baseline_mid, sleep_hours,
        exercise_kcal, exercise_min, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'demo')
    `);
    for (const w of demo.wearable) {
      insertWearable.run(
        id, w.date, w.restingHr, w.hrvMs, w.hrvBaselineMid, w.sleepHours, w.exerciseKcal, w.exerciseMin
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return sendJson(res, 200, { ok: true, meals: demo.meals.length, days: demo.wearable.length });
}

function handleClearDemo(req, res) {
  const id = requireUserId(req);
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM meals WHERE user_id = ? AND source = 'demo'").run(id);
    db.prepare("DELETE FROM wearable_days WHERE user_id = ? AND source = 'demo'").run(id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return sendJson(res, 200, { ok: true });
}

function handleListPeriods(req, res) {
  const id = requireUserId(req);
  const user = userRow(id);
  const starts = db
    .prepare("SELECT start_date FROM period_starts WHERE user_id = ? ORDER BY start_date DESC")
    .all(id)
    .map((r) => r.start_date);
  return sendJson(res, 200, { starts, cycle: cycleSummary({ ...user, cycle_tracking: 1 }, localToday()) });
}

async function handleAddPeriod(req, res) {
  const id = requireUserId(req);
  const body = await readJson(req);
  const date = requireDate(body.date);
  db.prepare("INSERT OR IGNORE INTO period_starts (user_id, start_date) VALUES (?, ?)").run(id, date);
  return sendJson(res, 200, { ok: true });
}

async function handleDeletePeriod(req, res) {
  const id = requireUserId(req);
  const body = await readJson(req);
  const date = requireDate(body.date);
  db.prepare("DELETE FROM period_starts WHERE user_id = ? AND start_date = ?").run(id, date);
  return sendJson(res, 200, { ok: true });
}

function handleCreateReportLink(req, res) {
  const id = requireUserId(req);
  const token = createReportToken(id);
  return sendJson(res, 201, { token, path: `/?report=${encodeURIComponent(token)}`, validForDays: 7 });
}

// True when any meal or wearable row for this athlete is synthetic demo data.
function hasDemoData(userId) {
  const row = db
    .prepare(
      "SELECT (EXISTS(SELECT 1 FROM meals WHERE user_id = ? AND source = 'demo')" +
        " OR EXISTS(SELECT 1 FROM wearable_days WHERE user_id = ? AND source = 'demo')) AS demo",
    )
    .get(userId, userId);
  return row.demo === 1;
}

// Report payload shared by the athlete's own PDF and the share link.
// includeDaily adds one row per day, for the athlete's own PDF only.
function buildReport(row, { includeDaily = false } = {}) {
  const today = localToday();
  const trends = trendsFor(row, today);
  const report = {
    generatedAt: new Date().toISOString(),
    athlete: {
      name: row.display_name,
      age: row.age,
      sex: row.sex,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      cycleTracking: row.cycle_tracking === 1,
      ffmKg: row.ffm_kg,
      rmrKcal: row.rmr_kcal,
    },
    windowDays: TREND_DAYS,
    periodStart: trends.days[0]?.date ?? null,
    periodEnd: trends.days[trends.days.length - 1]?.date ?? today,
    underfueling: trends.underfueling,
    weekly: trends.weekly,
    cycle: cycleSummary(row, today),
    disclaimer:
      "Generated from the athlete's self-logged meals and wearable data. Estimates are ranges. This report supports clinical review and is not a diagnosis.",
  };
  if (includeDaily) {
    report.demoData = hasDemoData(row.id);
    report.days = trends.days.map((d) => ({
      date: d.date,
      intakeKcal: d.intake ? Math.round(d.intake.mid) : null,
      exerciseMin: d.exerciseMin,
      exerciseKcal: d.exerciseKcal,
      proteinG: d.proteinG,
      carbsG: d.carbsG,
      sodiumMg: d.sodiumMg,
      energyAvailability: d.energyAvailability ?? null,
      restingHr: d.restingHr,
      hrvMs: d.hrvMs,
      sleepHours: d.sleepHours,
    }));
  }
  return report;
}

// The athlete's own report, for the PDF. Requires a signed-in session.
function handleOwnReport(req, res) {
  const id = requireUserId(req);
  const row = userRow(id);
  if (!row) throw httpError(401, "Sign in required.");
  return sendJson(res, 200, buildReport(row, { includeDaily: true }));
}

// Public clinician and coach view. Requires a token the athlete created.
function handleReport(req, res, query) {
  const id = userIdFromReportToken(query.get("token"));
  if (!id) throw httpError(401, "This report link is invalid or has expired.");
  const row = userRow(id);
  if (!row) throw httpError(401, "This report link is invalid or has expired.");
  return sendJson(res, 200, buildReport(row));
}

// ---------- COROS ----------

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:5174";
const COROS_REDIRECT_URI = `${PUBLIC_BASE_URL}/api/coros/callback`;

async function handleCorosConnect(req, res) {
  const id = requireUserId(req);
  try {
    const url = await startConnect(id, COROS_REDIRECT_URI);
    return sendJson(res, 200, { url });
  } catch (err) {
    throw httpError(502, err.message);
  }
}

// COROS redirects the browser here. The session cookie isn't sent on that cross-site
// redirect, so the athlete is identified by the state value saved when connecting.
async function handleCorosCallback(req, res, query) {
  const back = (params) => {
    res.writeHead(302, { location: `${PUBLIC_BASE_URL}/?${params}` });
    res.end();
  };
  if (query.get("error")) return back("coros=denied");
  try {
    await finishConnect(query.get("code") ?? "", query.get("state") ?? "");
    return back("coros=connected");
  } catch (err) {
    console.error("COROS connect failed:", err.message);
    return back("coros=error");
  }
}

async function handleCorosSync(req, res) {
  const id = requireUserId(req);
  try {
    const result = await syncRecent(id, 14);
    return sendJson(res, 200, result);
  } catch (err) {
    throw httpError(502, err.message);
  }
}

function handleCorosDisconnect(req, res) {
  const id = requireUserId(req);
  disconnect(id);
  return sendJson(res, 200, { ok: true });
}

// ---------- router ----------

async function route(req, res) {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  const query = url.searchParams;
  const m = req.method;

  if (m === "GET" && path === "/api/session") return handleSession(req, res);
  if (m === "POST" && path === "/api/signup") return handleSignup(req, res);
  if (m === "POST" && path === "/api/login") return handleLogin(req, res);
  if (m === "POST" && path === "/api/logout") {
    return sendJson(res, 200, { ok: true }, { "set-cookie": clearSessionCookieHeader() });
  }
  if (m === "GET" && path === "/api/report") return handleReport(req, res, query);
  if (m === "GET" && path === "/api/report-data") return handleOwnReport(req, res);

  if (m === "GET" && path === "/api/me") {
    const id = requireUserId(req);
    return sendJson(res, 200, { user: publicUser(userRow(id)) });
  }
  if (m === "PUT" && path === "/api/me") return handleUpdateProfile(req, res);

  if (m === "POST" && path === "/api/meals") return handleCreateMeal(req, res);
  if (m === "GET" && path === "/api/meals") return handleListMeals(req, res, query);
  const mealMatch = path.match(/^\/api\/meals\/([^/]+)$/);
  if (m === "DELETE" && mealMatch) return handleDeleteMeal(req, res, mealMatch[1]);

  if (m === "POST" && path === "/api/parse-meal") return handleParsePreview(req, res);
  if (m === "GET" && path === "/api/summary") return handleSummary(req, res, query);
  if (m === "GET" && path === "/api/trends") return handleTrends(req, res, query);

  if (m === "POST" && path === "/api/wearable/import") return handleWearableImport(req, res);

  if (m === "GET" && path === "/api/period") return handleListPeriods(req, res);
  if (m === "POST" && path === "/api/period") return handleAddPeriod(req, res);
  if (m === "DELETE" && path === "/api/period") return handleDeletePeriod(req, res);

  if (m === "POST" && path === "/api/report-link") return handleCreateReportLink(req, res);

  if (m === "GET" && path === "/api/coros/status") {
    return sendJson(res, 200, connectionStatus(requireUserId(req)));
  }
  if (m === "POST" && path === "/api/coros/connect") return handleCorosConnect(req, res);
  if (m === "GET" && path === "/api/coros/callback") return handleCorosCallback(req, res, query);
  if (m === "POST" && path === "/api/coros/sync") return handleCorosSync(req, res);
  if (m === "DELETE" && path === "/api/coros") return handleCorosDisconnect(req, res);

  if (m === "POST" && path === "/api/demo/seed") return handleSeedDemo(req, res);
  if (m === "POST" && path === "/api/demo/clear") return handleClearDemo(req, res);

  return sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (err) {
    if (err.status) return sendJson(res, err.status, { error: err.message });
    console.error(err);
    return sendJson(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  const provider = process.env.LLM_PROVIDER || "none (rules only)";
  console.log(`API on http://${HOST}:${PORT}. LLM: ${provider}.`);
});

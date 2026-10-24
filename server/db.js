// SQLite storage using Node's built-in node:sqlite module (no extra dependency).
// Every row is scoped to a user_id. Deleting a user removes their data via ON DELETE CASCADE.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
// APP_DB_PATH points at a persistent disk in production, for example /data/app.db.
const dbPath = process.env.APP_DB_PATH || path.join(dataDir, "app.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    age INTEGER,
    sex TEXT,
    height_cm REAL,
    weight_kg REAL,
    ffm_kg REAL,
    rmr_kcal REAL,
    cycle_tracking INTEGER NOT NULL DEFAULT 0,
    hormone_note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    text TEXT NOT NULL,
    source TEXT NOT NULL,
    estimate_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS meals_user_date ON meals(user_id, date);

  CREATE TABLE IF NOT EXISTS wearable_days (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    resting_hr REAL,
    hrv_ms REAL,
    hrv_baseline_mid REAL,
    sleep_hours REAL,
    exercise_kcal REAL,
    exercise_min REAL,
    acute_load REAL,
    chronic_load REAL,
    source TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
  );

  CREATE TABLE IF NOT EXISTS period_starts (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    PRIMARY KEY (user_id, start_date)
  );
`);

// Add the sports column to existing databases (sport names for each day).
const wearableColumns = db.prepare("PRAGMA table_info(wearable_days)").all().map((c) => c.name);
if (!wearableColumns.includes("sports")) {
  db.exec("ALTER TABLE wearable_days ADD COLUMN sports TEXT");
}

// Date of the measured RMR test (for the RMR section).
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes("rmr_date")) {
  db.exec("ALTER TABLE users ADD COLUMN rmr_date TEXT");
}

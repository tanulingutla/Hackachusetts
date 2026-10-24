// COROS connection through the official COROS MCP server, using OAuth 2.0 with PKCE.
// Each athlete connects their own COROS account. Tokens are encrypted at rest with
// TOKEN_ENCRYPTION_KEY (base64, 32 bytes). Without that key, connecting is refused.
import crypto from "node:crypto";
import { db } from "./db.js";

const MCP_ORIGIN = "https://mcp.coros.com";
const MCP_URL = `${MCP_ORIGIN}/mcp`;
const RESOURCE = "https://mcpus.coros.com";
const SCOPE = "openid mcp.tools offline_access";
const PENDING_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30000;

let metadataCache = null;

// ---------- token encryption ----------

function encryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("Set TOKEN_ENCRYPTION_KEY (base64, 32 bytes) before connecting COROS.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes.");
  return key;
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

function decrypt(payload) {
  const [iv, tag, body] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

// ---------- OAuth discovery and client registration ----------

async function discover() {
  if (metadataCache) return metadataCache;
  const res = await fetch(`${MCP_ORIGIN}/.well-known/oauth-authorization-server`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`COROS discovery failed (${res.status})`);
  metadataCache = await res.json();
  return metadataCache;
}

async function registerClient(redirectUri) {
  const existing = db.prepare("SELECT client_id FROM oauth_clients WHERE redirect_uri = ?").get(redirectUri);
  if (existing) return existing.client_id;

  const meta = await discover();
  const res = await fetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "why tho",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`COROS client registration failed (${res.status})`);
  const data = await res.json();
  db.prepare("INSERT INTO oauth_clients (redirect_uri, client_id, created_at) VALUES (?, ?, ?)").run(
    redirectUri,
    data.client_id,
    new Date().toISOString()
  );
  return data.client_id;
}

async function tokenRequest(meta, params) {
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`COROS token request failed (${res.status})`);
  return res.json();
}

function storeConnection(userId, clientId, tokens, previousRefresh) {
  const expiresAt = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
  const refresh = tokens.refresh_token ?? previousRefresh;
  db.prepare(
    `INSERT INTO coros_connections (user_id, client_id, access_token_enc, refresh_token_enc, expires_at, connected_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       client_id = excluded.client_id,
       access_token_enc = excluded.access_token_enc,
       refresh_token_enc = excluded.refresh_token_enc,
       expires_at = excluded.expires_at`
  ).run(userId, clientId, encrypt(tokens.access_token), encrypt(refresh), expiresAt, new Date().toISOString());
}

// ---------- connect flow ----------

// Returns the COROS sign-in URL. The state value ties the callback back to this athlete.
export async function startConnect(userId, redirectUri) {
  encryptionKey(); // fail early if tokens can't be stored safely
  const clientId = await registerClient(redirectUri);
  const meta = await discover();

  const state = crypto.randomBytes(24).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  db.prepare("DELETE FROM oauth_pending WHERE created_at < ?").run(Date.now() - PENDING_TTL_MS);
  db.prepare(
    "INSERT INTO oauth_pending (state, user_id, code_verifier, redirect_uri, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(state, userId, verifier, redirectUri, Date.now());

  const url = new URL(meta.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: RESOURCE,
  }).toString();
  return url.toString();
}

// Called from the browser redirect. Returns the athlete's id, or throws.
export async function finishConnect(code, state) {
  const pending = db.prepare("SELECT * FROM oauth_pending WHERE state = ?").get(state);
  if (!pending || Date.now() - pending.created_at > PENDING_TTL_MS) {
    throw new Error("Connection expired. Start again from the app.");
  }
  db.prepare("DELETE FROM oauth_pending WHERE state = ?").run(state);

  const clientId = await registerClient(pending.redirect_uri);
  const meta = await discover();
  const tokens = await tokenRequest(meta, {
    grant_type: "authorization_code",
    code,
    redirect_uri: pending.redirect_uri,
    client_id: clientId,
    code_verifier: pending.code_verifier,
  });
  storeConnection(pending.user_id, clientId, tokens, null);
  return pending.user_id;
}

async function accessToken(userId) {
  const row = db.prepare("SELECT * FROM coros_connections WHERE user_id = ?").get(userId);
  if (!row) throw new Error("COROS is not connected.");
  if (row.expires_at - Date.now() > 60000) return decrypt(row.access_token_enc);

  const meta = await discover();
  const tokens = await tokenRequest(meta, {
    grant_type: "refresh_token",
    refresh_token: decrypt(row.refresh_token_enc),
    client_id: row.client_id,
  });
  storeConnection(userId, row.client_id, tokens, decrypt(row.refresh_token_enc));
  return tokens.access_token;
}

export function disconnect(userId) {
  db.prepare("DELETE FROM coros_connections WHERE user_id = ?").run(userId);
}

export function connectionStatus(userId) {
  const row = db.prepare("SELECT connected_at, last_sync_at FROM coros_connections WHERE user_id = ?").get(userId);
  return row ? { connected: true, connectedAt: row.connected_at, lastSyncAt: row.last_sync_at } : { connected: false };
}

// ---------- MCP calls ----------

// MCP responses may be plain JSON or a server-sent event stream. Return the JSON-RPC message with the given id.
async function readRpc(res, id) {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const msg = JSON.parse(line.slice(5).trim());
      if (msg.id === id) return msg;
    }
    throw new Error("No matching COROS MCP response.");
  }
  return res.json();
}

async function mcpPost(token, sessionId, body) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${token}`,
    "mcp-protocol-version": "2025-03-26",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return res;
}

// Calls one COROS MCP tool for an athlete and returns its text output.
export async function callTool(userId, name, args) {
  const token = await accessToken(userId);

  const init = await mcpPost(token, null, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "why-tho", version: "0.1.0" },
    },
  });
  if (!init.ok) throw new Error(`COROS MCP initialize failed (${init.status})`);
  const sessionId = init.headers.get("mcp-session-id");
  await init.text();

  await mcpPost(token, sessionId, { jsonrpc: "2.0", method: "notifications/initialized" }).then((r) => r.text());

  const res = await mcpPost(token, sessionId, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: args },
  });
  if (!res.ok) throw new Error(`COROS tool ${name} failed (${res.status})`);
  const msg = await readRpc(res, 2);
  if (msg.error) throw new Error(`COROS tool ${name}: ${msg.error.message}`);
  if (msg.result?.isError) throw new Error(`COROS tool ${name} returned an error.`);
  return (msg.result?.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

// ---------- parsing ----------
// The tool output is text. Each block starts with a date line (yyyy-MM-dd, the wake-up date).
// The example sleep format is documented by COROS. The HRV and resting HR patterns are
// best-effort until a live response is checked. Raw text is always stored for that check.

function splitByDate(text) {
  const blocks = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      current = dateMatch[1];
      blocks.set(current, []);
    } else if (current) {
      blocks.get(current).push(trimmed);
    }
  }
  return blocks;
}

export function parseSleep(text) {
  const out = new Map();
  for (const [date, lines] of splitByDate(text)) {
    const block = lines.join("\n");
    const hours = block.match(/Main Sleep \(asleep\):\s*(\d+)h\s*(\d+)min/);
    const score = block.match(/Sleep Score:\s*(\d+)/);
    out.set(date, {
      sleepHours: hours ? Number(hours[1]) + Number(hours[2]) / 60 : null,
      sleepScore: score ? Number(score[1]) : null,
    });
  }
  return out;
}

export function parseHrv(text) {
  const out = new Map();
  for (const [date, lines] of splitByDate(text)) {
    const m = lines.join("\n").match(/(\d+(?:\.\d+)?)\s*ms/i);
    out.set(date, { hrvMs: m ? Number(m[1]) : null });
  }
  return out;
}

export function parseRestingHr(text) {
  const out = new Map();
  for (const [date, lines] of splitByDate(text)) {
    const m = lines.join("\n").match(/(\d+)\s*bpm/i);
    out.set(date, { restingHr: m ? Number(m[1]) : null });
  }
  return out;
}

// Pulls recent days from COROS and merges them into the athlete's daily wearable table.
export async function syncRecent(userId, days = 14) {
  const fetchedAt = new Date().toISOString();
  const sleepText = await callTool(userId, "querySleepOverview", { days });
  const hrvText = await callTool(userId, "querySleepHrv", { startDate: "", endDate: "", days: Math.min(days, 7) });
  const rhrText = await callTool(userId, "queryRestingHeartRate", { days });

  const insertRaw = db.prepare("INSERT INTO coros_raw (user_id, tool, fetched_at, body) VALUES (?, ?, ?, ?)");
  insertRaw.run(userId, "querySleepOverview", fetchedAt, sleepText);
  insertRaw.run(userId, "querySleepHrv", fetchedAt, hrvText);
  insertRaw.run(userId, "queryRestingHeartRate", fetchedAt, rhrText);

  const sleep = parseSleep(sleepText);
  const hrv = parseHrv(hrvText);
  const rhr = parseRestingHr(rhrText);
  const dates = new Set([...sleep.keys(), ...hrv.keys(), ...rhr.keys()]);

  const upsert = db.prepare(`
    INSERT INTO wearable_days (user_id, date, resting_hr, hrv_ms, sleep_hours, source)
    VALUES (?, ?, ?, ?, ?, 'coros')
    ON CONFLICT(user_id, date) DO UPDATE SET
      resting_hr = COALESCE(excluded.resting_hr, wearable_days.resting_hr),
      hrv_ms = COALESCE(excluded.hrv_ms, wearable_days.hrv_ms),
      sleep_hours = COALESCE(excluded.sleep_hours, wearable_days.sleep_hours),
      source = 'coros'
  `);
  for (const date of dates) {
    upsert.run(
      userId,
      date,
      rhr.get(date)?.restingHr ?? null,
      hrv.get(date)?.hrvMs ?? null,
      sleep.get(date)?.sleepHours ?? null
    );
  }

  db.prepare("UPDATE coros_connections SET last_sync_at = ? WHERE user_id = ?").run(fetchedAt, userId);
  return {
    days: dates.size,
    parsed: {
      sleep: [...sleep.values()].filter((v) => v.sleepHours !== null).length,
      hrv: [...hrv.values()].filter((v) => v.hrvMs !== null).length,
      restingHr: [...rhr.values()].filter((v) => v.restingHr !== null).length,
    },
  };
}

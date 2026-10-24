// Account auth for the app. Passwords use scrypt. Sessions are HMAC-signed cookies.
// Report links are separately signed tokens, so they can't be used as login sessions.
import crypto from "node:crypto";

const COOKIE_NAME = "aft_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_KEYLEN = 64;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

// Random per process unless SESSION_SECRET is set. Restarting without it signs everyone out.
const SECRET = process.env.SESSION_SECRET
  ? Buffer.from(process.env.SESSION_SECRET, "utf8")
  : crypto.randomBytes(32);

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function sign(purpose, payload) {
  return crypto.createHmac("sha256", SECRET).update(`${purpose}|${payload}`).digest("base64url");
}

function signedToken(purpose, subject, ttlMs) {
  const expiresAt = String(Date.now() + ttlMs);
  const payload = `${subject}.${expiresAt}`;
  return `${payload}.${sign(purpose, payload)}`;
}

// Returns the subject (user id) if the token is genuine and unexpired, otherwise null.
function readSignedToken(purpose, token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [subject, expiresAt, signature] = parts;
  const payload = `${subject}.${expiresAt}`;

  const expected = Buffer.from(sign(purpose, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  if (Number(expiresAt) <= Date.now()) return null;
  return subject;
}

export function createSessionToken(userId) {
  return signedToken("session", String(userId), SESSION_TTL_MS);
}

export function userIdFromSession(token) {
  const subject = readSignedToken("session", token);
  return subject ? Number(subject) : null;
}

export function createReportToken(userId) {
  return signedToken("report", String(userId), REPORT_TTL_MS);
}

export function userIdFromReportToken(token) {
  const subject = readSignedToken("report", token);
  return subject ? Number(subject) : null;
}

export function readSessionCookie(req) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

// HttpOnly keeps the token away from page scripts. SameSite=Strict blocks cross-site requests.
export function sessionCookieHeader(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookieHeader() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

// In-memory failed-attempt counter per client address, shared by login and signup.
const failures = new Map();

export function attemptAllowed(ip) {
  const entry = failures.get(ip);
  if (!entry) return true;
  if (Date.now() - entry.windowStart > LOGIN_WINDOW_MS) {
    failures.delete(ip);
    return true;
  }
  return entry.count < LOGIN_MAX_FAILURES;
}

export function recordFailure(ip) {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    failures.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

export function clearFailures(ip) {
  failures.delete(ip);
}

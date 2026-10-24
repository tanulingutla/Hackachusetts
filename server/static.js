// Serves the built frontend (dist/) so one process hosts both the pages and /api in production.
// In development Vite serves the pages, and dist/ may not exist. Then this returns false.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, "..", "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

// Page security headers. The CSP allows the Google Fonts the app loads and nothing else off-site.
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export const staticAvailable = fs.existsSync(path.join(DIST, "index.html"));

// Returns true when it answered the request.
export function serveStatic(req, res) {
  if (!staticAvailable || (req.method !== "GET" && req.method !== "HEAD")) return false;

  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = path.resolve(DIST, `.${pathname}`);

  // Never leave dist/, even with ../ in the URL.
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(404, SECURITY_HEADERS).end();
    return true;
  }

  const hasExtension = path.extname(pathname) !== "";
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // A missing file with an extension is a real 404. Anything else is an app route.
    if (hasExtension) {
      res.writeHead(404, SECURITY_HEADERS).end();
      return true;
    }
    file = path.join(DIST, "index.html");
  }

  const type = TYPES[path.extname(file)] ?? "application/octet-stream";
  const isAsset = pathname.startsWith("/assets/");
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "content-type": type,
    "cache-control": isAsset ? "public, max-age=31536000, immutable" : "no-cache",
  });
  if (req.method === "HEAD") return res.end(), true;
  fs.createReadStream(file).pipe(res);
  return true;
}

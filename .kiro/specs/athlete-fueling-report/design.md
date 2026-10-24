# Design: athlete fueling and recovery report

## Data flow

1. The Reports page calls GET /api/report-data with the session cookie.
2. server/index.js requireUserId() identifies the athlete. The server never accepts a user id from the client.
3. buildReport(row, { includeDaily: true }) runs trendsFor() for the last 28 days. It returns the fueling status, weekly rollups, cycle summary, and one row per day.
4. hasDemoData() checks meals and wearable_days for source = 'demo'.
5. src/lib/reportPdf.js builds the PDF text in the browser. SharePanel.jsx turns it into a Blob and downloads it.

## Why the PDF is built in the browser

- No new dependency. The writer is about 250 lines, uses the built-in Helvetica font, and writes ASCII only so byte offsets stay exact.
- The server returns data, not a file. This keeps the report logic in one place, the fueling rules.

## Units

- Storage is metric. Conversion happens in src/lib/units.js.
- The PDF converts kg to lb, cm to feet and inches, and per-kg values to per-lb values with perLb().
- Day-by-day grams and milligrams are still metric. This is a known gap.

## Share link

- The earlier share link (POST /api/report-link and GET /api/report with a token) still exists on the server. The Reports page no longer uses it.
- The public report page is still reachable with ?report=. Remove it if the PDF replaces it for good.

## Verification

- npx vite build passes.
- Generated a sample PDF from synthetic data. The file has 10 objects, 3 pages, and cross-reference offsets that match the object positions.
- GET /api/report-data returns 401 when signed out.
- Not yet verified: a signed-in download in a browser, and how the PDF looks when printed.

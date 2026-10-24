# WHY THO product context

WHY THO helps endurance athletes tell apart two things that look alike on a watch: overtraining and underfueling. Athletes log meals by voice or text, import or sync wearable data, and get a plain-language fueling check. Clinicians and coaches get a PDF report.

## Rules for every change

- Brand text is "WHY THO" in capitals. The project folder is named hackachusetts and the package is "why-tho".
- Units shown to users are US units: pounds, inches, feet, pounds per day for per-body-weight values. The server stores metric (kg, cm). Convert only in src/lib/units.js.
- Synthetic data is always tagged source = 'demo' and labeled as demo in any UI or report.
- Write for non-technical athletes. Avoid jargon on screen, and define a term the first time it appears.
- Never claim a diagnosis. Reports support clinical review. Use "flag for review", not "eating disorder".
- Do not use emojis in the UI. Activity icons are SVG pictograms in colored circles.
- Do not use third-party brand logos. Devices appear as text names only.
- Motion is light and CSS only, and it must respect prefers-reduced-motion.
- Charts are hand-built SVG. Do not add a chart library without asking.
- Dependencies are pinned. The PDF writer is dependency-free on purpose.

## Privacy and access

- Each account only reads its own data. The API enforces this.
- Passwords use scrypt. Sessions are HMAC-signed HttpOnly cookies.
- Report links are signed with a separate purpose and cannot be used to sign in.
- COROS tokens are encrypted with AES-256-GCM. Never print the TOKEN_ENCRYPTION_KEY from .env.

## Commands

- npm run dev: Vite on http://localhost:5174
- npm run api: API on 127.0.0.1:8787
- npx vite build: production build. Run it after any change to src.

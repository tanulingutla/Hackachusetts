# WHY THO

**Is it overtraining, or are you underfueling?**

Athletes of any sex, sport, and level often eat too little for the training they do, and many don't notice or don't prioritize it. The signs (tired legs, poor sleep, a high resting heart rate, a falling HRV) look just like overtraining on a watch. The usual fix for overtraining is rest. The fix for underfueling is food. Mixing them up costs athletes months of progress and can lead to injury and illness.

WHY THO puts the missing piece next to the watch data: what the athlete actually ate. It tells the two apart, explains the answer in plain language, and builds a PDF report for a coach, sports dietitian, or doctor.

## What it does

- **Log meals in plain words**, by voice or text. A local or hosted language model reads the sentence and picks the foods and amounts. Calories come from a food table, never from the model. If the model is unavailable, a rule-based parser takes over.
- **Import watch data** from a CSV export (sleep, resting heart rate, HRV, training minutes and calories, load). Impossible readings are dropped, not averaged in.
- **Weekly fueling check.** Over 7-day windows it checks energy availability, carbohydrate against training, protein, and sodium. One bad day never triggers a flag. Two flagged weeks in a row are marked persistent.
- **Training status on Home:** underfueled, possible overtraining, or normal, with the reasons.
- **Calendar, activities, and charts** for training and meals, with every chart explained in plain words.
- **RMR and body composition** for a sharper daily target.
- **Optional period tracking.** It turns on automatically for female profiles and is available to anyone.
- **PDF report** with the summary, the last 7 days in detail, weekly and day-by-day tables, and a glossary.
- **US units** throughout: pounds, inches, feet.

## Who it is for

Any athlete who trains regularly and doesn't track fueling closely: runners, cyclists, swimmers, triathletes, team-sport and strength athletes. The same report helps the people around them: coaches, sports dietitians, and physicians.

## How the logic works

The rules are in `src/lib/analytics.js` and written up in `.kiro/steering/fueling-logic.md`.

- Energy used = measured RMR + exercise energy + the thermic effect of protein.
- Underfueled if any of these holds across a 7-day window with at least 5 logged days: energy availability below 30 kcal per kg of fat-free mass; carbs below 80% of training guidance; protein below 1.2 g/kg; sodium below 1,500 mg a day on training days.
- Overtraining is only considered when fueling is fine. It needs two or more signals against the athlete's 3-week baseline: higher resting heart rate, lower HRV, much more training energy, a high acute-to-chronic load ratio, or shorter sleep.

These thresholds are common guidance from sports nutrition and low energy availability research. They are screening rules, not a diagnosis, and they haven't been validated by a clinician for this app. Every result is worded as "flag for review".

## Demo data

The repo contains no health data. **Profile > Load demo data** fills an account with 28 days of synthetic meals and watch data, and **Remove demo data** clears it. All demo rows are tagged `source = 'demo'` and labeled in the PDF.

## How Kiro was used

- **Steering** (`.kiro/steering/`): `product.md` holds the product rules (units, demo labeling, no diagnosis claims, accessibility and motion rules). `fueling-logic.md` loads automatically when the analytics file is open, so the fueling thresholds stay consistent.
- **Spec** (`.kiro/specs/athlete-fueling-report/`): requirements, design, and tasks for the PDF report, with a task list that records what is done and what is still unverified.
- **Hook** (`.kiro/hooks/build-on-save.json`): runs the production build when app code is saved.
- **Decisions made while building with Kiro:** a built-in SQLite database instead of a hosted one; hand-built SVG charts instead of a chart library; a dependency-free PDF writer; a local Ollama model for meal parsing so no meal text leaves the computer; and removing a half-tested live device sync rather than shipping it.

## Run it locally

You need Node.js 22 or newer.

```bash
npm install
npm run api     # API on http://127.0.0.1:8787
npm run dev     # app on http://localhost:5174 (second terminal)
```

Create an account on the home page, then load demo data from **Profile**.

### Optional: AI meal parsing

Without this, the app uses its rule-based parser.

1. Install [Ollama](https://ollama.com) and run `ollama pull llama3.2`.
2. Create a `.env` file in the project root:

```
LLM_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
LLM_MODEL=llama3.2
```

3. Restart `npm run api`.

Anthropic also works: set `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, and `LLM_MODEL`. Never commit the `.env` file.

## Privacy and security

- Passwords are hashed with scrypt. Sessions are signed, HttpOnly, SameSite=Strict cookies.
- Each account can only read its own data.
- The `data/` folder (database, imports) and `.env` are excluded from git.
- The PDF is built in the browser from data the signed-in athlete requests. Nothing is shared unless the athlete sends the file.

## Known limits

- **Not hosted.** It runs locally. The server needs a Node host with disk storage for the SQLite file.
- **No live device sync.** Every device imports from CSV. A COROS sync was built and removed because it was never tested end to end.
- **Not browser-tested end to end,** and no accessibility audit yet. No automated tests yet.
- **Food table is hand-built** and covers common foods only. Amounts like "a bowl" are flagged as vague so the athlete can confirm them.
- **Not medical advice.** The app flags patterns for review. It does not diagnose.

## Tech

React 18, Vite, Node's built-in HTTP server and `node:sqlite`. No other runtime dependencies.

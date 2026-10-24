---
inclusion: fileMatch
fileMatchPattern: "**/analytics.js"
---

# Fueling and training-status rules

These rules live in src/lib/analytics.js and the server mirror in server/index.js. Change them together. The project has no automated tests yet, so check changes by running the build and the demo accounts.

## Energy target

- Energy used = measured RMR + exercise energy + protein thermic effect (25% of protein kcal).
- Sleep is not added separately. RMR already covers 24 hours, so adding sleep would double count.
- Walking counts only when logged as a workout, because there is no step data.

## Underfueling (judged over 7-day windows)

- A window needs at least 5 logged days.
- Flags: energy availability below 30 kcal per kg fat-free mass; intake more than 10% below expenditure when fat-free mass is missing; carbs below 80% of training guidance on 3 or more training days; protein below 1.2 g/kg; sodium below 1500 mg a day on 3 or more training days.
- Any single flag means underfueled.
- Two windows in a row make it "persistent" and flag it for clinician review.

## Carbohydrate guidance (g per kg body weight)

- Rest day: 3. Up to 60 minutes: 5. Longer than 60 minutes: 6.

## Overtraining or normal (loadAssessment)

- Underfueling is checked first.
- Otherwise, two or more signals against a 3-week baseline mean overtraining: resting HR up 3 bpm or more, HRV down 10% or more, training energy up 25% or more, acute:chronic load ratio of 1.5 or more, or sleep down 0.5 hours or more.
- Otherwise the status is normal.

## Not allowed

- Do not force a status to get a demo result. Change the demo inputs instead, and keep them labeled as demo.
- Do not judge underfueling from one day.

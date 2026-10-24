# Requirements: athlete fueling and recovery report

## Problem

Endurance athletes can look fit and still be underfueled. Overtraining and underfueling look alike on a watch. Clinicians and coaches need a clear, shareable record without reading raw logs.

## User stories

1. As an athlete, I want to log meals in my own words so that I don't have to count calories by hand.
2. As an athlete, I want a weekly fueling check so that I know whether my intake covers my training.
3. As an athlete, I want each flag explained in plain language so that I understand what to change.
4. As a coach or clinician, I want a PDF with a summary, weekly trends, and day-by-day numbers so that I can review the athlete without signing in.
5. As a US athlete, I want weight, height, and per-body-weight values in pounds, inches, and feet so that the numbers match my scale and tape measure.
6. As a user, I want demo data clearly labeled so that nobody mistakes synthetic values for real measurements.

## Acceptance criteria

- The PDF states the fueling status and the reason for it in one sentence.
- Every flag in the PDF has a label and a detail with the threshold it crossed.
- Weight, height, and fat-free mass are shown in US units. Per-body-weight values are shown per pound.
- The PDF shows a demo-data warning when any row for the account has source = 'demo'.
- The PDF includes a glossary for energy availability, eaten below energy used, carbohydrate target, and recovery signals.
- The PDF never states a diagnosis.
- The report download requires a signed-in session. A signed-out request returns 401.
- The PDF opens in a standard PDF reader and has valid cross-reference offsets.

## Out of scope for this spec

- Live Garmin sync. Garmin is CSV import only for now.
- A clinician account type. Clinicians receive the PDF, not a login.

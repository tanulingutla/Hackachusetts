# Tasks: athlete fueling and recovery report

- [x] 1. Fueling rules: 7-day windows, energy availability, carbs, protein, sodium, persistent flag. (src/lib/analytics.js, server/index.js)
- [x] 2. Overtraining or normal status against a 3-week baseline, checked after underfueling. (src/lib/analytics.js)
- [x] 3. US units for profile and per-body-weight values. (src/lib/units.js)
- [x] 4. Report payload with optional day-by-day rows and demo flag. (server/index.js buildReport)
- [x] 5. Signed-in report endpoint, GET /api/report-data. (server/index.js)
- [x] 6. Dependency-free PDF writer with pagination and footers. (src/lib/reportPdf.js)
- [x] 7. Reports page downloads the PDF. (src/components/SharePanel.jsx)
- [x] 8. Sample PDF structure check. Temporary file removed.
- [ ] 9. Browser check: sign in, download the PDF, open it, confirm layout and wording.
- [ ] 10. Check the PDF prints on one page per section without clipped text.
- [ ] 11. Decide whether to remove the share-link endpoints and the public report page.
- [ ] 12. Convert day-by-day grams and milligrams to US units if the user wants full US units in the PDF.

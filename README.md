# App Review Sentiment Analytics Dashboard

A single-page, interactive dashboard analyzing sentiment across 35,934 Google Play Store reviews spanning 816 apps and 33 categories.

## What's real here
- Every number is computed live in the browser from the actual dataset — nothing is hardcoded.
- The category filter genuinely re-runs the aggregation (sentiment split, category rankings, correlation) on the filtered subset, not just re-showing pre-baked charts.
- The `r = 0.32` correlation and all KPIs match the analysis run earlier on this same data.

## Files
- `index.html` — the dashboard shell
- `app.js` — all filtering, computation, and chart-rendering logic
- `dataset.js` — the cleaned, joined dataset (reviews + app metadata), embedded as a JS variable
- `build_data.js` + `dataset.json` + the two raw CSVs — the data pipeline that produced `dataset.js`, kept here so you can regenerate it or show your work in an interview
- `lib/plotly.min.js` — Plotly.js bundled locally (not loaded from a CDN)

## Why the data is embedded instead of fetched at runtime
Loading two large CSVs via `fetch()` at runtime is exactly what caused the earlier HR dashboard's "0%" bug — silent failures on file:// paths and GitHub Pages routing. Instead, the join and cleaning happen once at build time (`node build_data.js`), and the result is embedded directly into the page as a JS variable. This means:
- It works by just double-clicking `index.html` — no local server needed, no CORS issues
- It also works identically once deployed to GitHub Pages
- All computation you see in the dashboard (filtering, aggregation, correlation) still happens live in the browser — only the CSV-parsing/joining step was moved to build time

If you ever update the source CSVs, just re-run `node build_data.js` (requires `npm install papaparse` once) to regenerate `dataset.js`.

## Run it locally
Just open `index.html` in a browser. No server, no build step required.

## Deploy to GitHub Pages
1. Create a new GitHub repo (e.g. `app-review-sentiment-dashboard`)
2. Upload all files **except** `dataset.json`, `build_data.js`, and the raw CSVs if you want to keep the repo lean (optional — feel free to keep them for transparency)
3. Settings → Pages → Deploy from branch → `main` → `/ (root)` → Save
4. Live in ~1-2 minutes at `https://your-username.github.io/app-review-sentiment-dashboard/`

## Verified
Tested with repeated tab-switching (5+ cycles) with zero console errors, and confirmed the category filter recalculates every KPI, chart, and the correlation coefficient correctly.

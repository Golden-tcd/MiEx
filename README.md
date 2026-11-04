# MiEx

A private, offline-capable personal expense tracker built with vanilla HTML, CSS and JavaScript. Track spending by category, set a monthly budget with alerts, browse your history, and back up your data — with no accounts and no servers.

**Live demo:** https://golden-tcd.github.io/MiEx/

## Features

- Add, search, edit and delete expenses (with confirmation before deleting)
- Categories: Feeding, Clothing, Transportation, Bills, and custom "Others"
- Doughnut chart by category and a 6-month spending trend chart
- Monthly budget with progress bar and overspend alerts
- Month-to-date insight versus the same days last month
- Filter by All Time, Week, Month, Year or a custom date range, and browse past periods
- **Backup & restore** (JSON), **CSV export**, and a "delete all my data" option
- 8 currencies (Naira, Cedi, Shilling, Rand, Dollar, Pound, Euro, Rupee)
- Light/dark mode (follows your phone by default)
- **Installable and fully offline** (service worker; fonts and Chart.js are bundled locally)
- Private by design: all data stays in the browser's `localStorage`; see [privacy.html](privacy.html)

## Tech stack

HTML5 · CSS3 (custom properties) · Vanilla JavaScript · [Chart.js](https://www.chartjs.org/) (bundled)

## Project structure

```
MiEx/
├── index.html
├── style.css
├── script.js
├── service-worker.js
├── manifest.json
├── privacy.html
├── icons/            app icons + manifest screenshots
└── vendor/
    ├── js/chart.umd.js
    └── fonts/        Quicksand + Nunito (woff2)
```

## Running locally

No build step. Serve the folder with any static server (a service worker needs `http://localhost` or HTTPS) and open `index.html`.

## Author

Built by Golden_TCD — building things that didn't exist yesterday.

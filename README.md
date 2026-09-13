# MiEx

A frontend-focused personal expense tracker built with vanilla HTML, CSS, and JavaScript. Track spending by category, view breakdown and trend charts, and browse your history by week, month, year, or a custom date range — all with a polished light/dark theme.

**Live demo:** https://golden-tcd.github.io/MiEx/

## Features

- Add expenses with name, amount, category, and date
- Categories: Feeding, Clothing, Transportation, Bills, and a custom "Others" option
- Interactive doughnut chart showing spending by category (Chart.js)
- Bar chart showing spending trend over the last 6 months
- Filter totals and expense list by **All Time**, **This Week**, **This Month**, **This Year**, or a **Custom Date Range**
- Browse history — jump back to any previous week, month, or year
- Confirmation prompt before deleting an expense
- Light/dark mode toggle with a custom animated background
- Data persists locally via `localStorage` — no backend required
- Fully responsive, glassmorphism-styled UI

## Tech Stack

- HTML5
- CSS3 (custom properties, `backdrop-filter`, gradients)
- Vanilla JavaScript
- [Chart.js](https://www.chartjs.org/) for data visualization

## Project Structure

```
MiEx/
├── index.html
├── style.css
└── script.js
```

## Running Locally

Clone the repo and open `index.html` in your browser — no build step or dependencies to install.

```bash
git clone https://github.com/Golden-tcd/MiEx.git
cd MiEx
```

Then just open `index.html` directly, or serve it with any static server.

## Author

Built by [Golden](https://github.com/Golden-tcd) — Computer Science student, Nigerian Army University Biu (NAUB).

# MiEx

A frontend personal expense tracker built with vanilla HTML, CSS, and JavaScript. Track spending by category, set a monthly budget with overspend alerts, search and edit past entries, and browse your history by week, month, year, or a custom date range — all wrapped in a light/dark themed UI.

**Live demo:** https://golden-tcd.github.io/MiEx/

## Features

- Add, search, and edit expenses (name, amount, category, date)
- Categories: Feeding, Clothing, Transportation, Bills, and a custom "Others" option
- Interactive doughnut chart showing spending by category, with percentages
- Bar chart showing spending trend over the last 6 months
- Monthly budget tracking with a progress bar and overspend alerts
- Dismissible month-over-month spending insight banner
- Filter totals and expense list by **All Time**, **This Week**, **This Month**, **This Year**, or a **Custom Date Range**
- Browse history — jump back to any previous week, month, or year
- Confirmation prompt before deleting an expense
- Personalized greeting and avatar (name set once, remembered locally)
- Balance visibility toggle (hide/reveal the total)
- Light/dark mode toggle
- Data persists locally via `localStorage` — no backend required
- Fully responsive UI

## Tech Stack

- HTML5
- CSS3 (custom properties, responsive layout)
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

Golden_TCD · building things that didn't exist yesterday

/* ===== Base tokens ===== */
:root {
  --navy: #1E2A3A;
  --sage: #7FB069;
  --coral: #FF6B6B;
  --text: #1E2A3A;
  --muted: #6B7684;
  --border: rgba(30, 42, 58, 0.12);
  --accent-light: #EEF3EC;
  --card-bg: rgba(255, 255, 255, 0.72);
  --card-border: rgba(255, 255, 255, 0.5);
  --radius: 16px;
  --shadow: 0 8px 30px rgba(30, 42, 58, 0.08);
}

body.dark {
  --text: #E8EAED;
  --muted: #98A2B3;
  --border: rgba(255, 255, 255, 0.08);
  --accent-light: #13221A;
  --card-bg: rgba(16, 19, 26, 0.55);
  --card-border: rgba(255, 255, 255, 0.06);
  --shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

* {
  box-sizing: border-box;
}

html, body {
  height: 100%;
}

body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--text);
  background-color: #FAFAF8; /* minimal glow backdrop - light */
  transition: color 0.65s ease-in-out, background-color 0.65s ease-in-out;
  -webkit-font-smoothing: antialiased;
}

body.dark {
  background-color: #0B0F17; /* minimal glow backdrop - dark */
}

/* ===== Minimal Glow background ===== */
.glow-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: -1;
  pointer-events: none;
  transition: opacity 0.9s ease-in-out;
}

.glow-bg-light { opacity: 1; }
body.dark .glow-bg-light { opacity: 0; }

.glow-bg-dark { opacity: 0; }
body.dark .glow-bg-dark { opacity: 1; }

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  will-change: transform, opacity;
  animation: pulseGlow 12s ease-in-out infinite alternate;
}

/* Light mode orbs — faint navy + sage tint */
.glow-orb-1 {
  width: 420px;
  height: 420px;
  top: -10%;
  right: -8%;
  background: radial-gradient(circle, rgba(30,42,58,0.09) 0%, transparent 70%);
}

.glow-orb-2 {
  width: 480px;
  height: 480px;
  bottom: -15%;
  left: -10%;
  background: radial-gradient(circle, rgba(127,176,105,0.10) 0%, transparent 70%);
  animation-delay: -6s;
}

/* Dark mode orbs — faint sage + coral tint */
.glow-orb-3 {
  width: 460px;
  height: 460px;
  top: -12%;
  right: -6%;
  background: radial-gradient(circle, rgba(127,176,105,0.14) 0%, transparent 70%);
}

.glow-orb-4 {
  width: 420px;
  height: 420px;
  bottom: -12%;
  left: -8%;
  background: radial-gradient(circle, rgba(255,107,107,0.09) 0%, transparent 70%);
  animation-delay: -6s;
}

@keyframes pulseGlow {
  0% { transform: scale(1) translate(0, 0); opacity: 0.7; }
  50% { transform: scale(1.15) translate(15px, -10px); opacity: 1; }
  100% { transform: scale(1) translate(0, 0); opacity: 0.7; }
}

@media (max-width: 640px) {
  .glow-orb { filter: blur(70px); }
}

/* ===== Layout ===== */
.app {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 18px 60px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--navy);
  color: #ffffff;
}

.app-header h1 {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
  color: var(--text);
}

.icon-btn {
  background: var(--card-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--card-border);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  font-size: 1.05rem;
  box-shadow: var(--shadow);
  transition: background-color 0.65s ease-in-out, border-color 0.65s ease-in-out;
}

/* ===== Period tabs ===== */
.period-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.period-btn {
  flex: 1;
  min-width: 80px;
  padding: 9px 10px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.65s ease-in-out, color 0.65s ease-in-out, border-color 0.65s ease-in-out;
}

.period-btn.active {
  background: var(--navy);
  color: #ffffff;
  border-color: var(--navy);
}

.period-value-select {
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 16px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.65s ease-in-out, border-color 0.65s ease-in-out, color 0.65s ease-in-out;
}

.custom-range {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.custom-range input[type="date"] {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
  transition: background-color 0.65s ease-in-out, border-color 0.65s ease-in-out, color 0.65s ease-in-out;
}

.range-sep {
  font-size: 0.8rem;
  color: var(--muted);
}

/* ===== Trend chart ===== */
.trend-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 22px;
  box-shadow: var(--shadow);
  transition: background-color 0.65s ease-in-out, border-color 0.65s ease-in-out, box-shadow 0.65s ease-in-out;
}

.trend-card h3 {
  margin-top: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}

/* ===== Confirm modal ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 20, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
}

.modal-box {
  background: var(--card-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 22px;
  max-width: 340px;
  width: 100%;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.modal-text {
  margin: 0 0 18px;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 500;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.modal-actions button {
  padding: 9px 16px;
  border-radius: 8px;
  border: none;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border) !important;
  color: var(--text);
}

.btn-danger {
  background: var(--coral);
  color: #ffffff;
}

/* ===== Footer ===== */
.app-footer {
  text-align: center;
  padding-top: 10px;
  font-size: 0.72rem;
  color: var(--muted);
  opacity: 0.6;
  letter-spacing: 0.02em;
  transition: color 0.65s ease-in-out;
}

/* ===== Cards (glass) ===== */
.balance-card {
  background: var(--navy);
  color: #ffffff;
  border-radius: var(--radius);
  padding: 26px;
  text-align: center;
  margin-bottom: 22px;
  box-shadow: 0 12px 32px rgba(30, 42, 58, 0.25);
}

.balance-label {
  margin: 0 0 6px;
  opacity: 0.75;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.balance-card h2 {
  margin: 0;
  font-size: 2.4rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.form-card, .list-card, .chart-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 22px;
  box-shadow: var(--shadow);
  transition: background-color 0.65s ease-in-out, border-color 0.65s ease-in-out, box-shadow 0.65s ease-in-out;
}

.form-card h3, .list-card h3, .chart-card h3 {
  margin-top: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}

/* ===== Form ===== */
#expenseForm {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

#expenseForm input,
#expenseForm select {
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.5);
  color: var(--text);
  font-family: inherit;
  font-size: 0.92rem;
  transition: background-color 0.65s ease-in-out, border-color 0.65s ease-in-out, color 0.65s ease-in-out;
}

body.dark #expenseForm input,
body.dark #expenseForm select {
  background: rgba(255, 255, 255, 0.04);
}

#expenseForm input::placeholder {
  color: var(--muted);
}

#expenseForm button {
  grid-column: span 2;
  padding: 13px;
  border: none;
  border-radius: 10px;
  background: var(--navy);
  color: white;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.2s, background-color 0.65s ease-in-out;
}

#expenseForm button:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

/* ===== Content grid ===== */
.content-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 6px 13px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.65s ease-in-out, color 0.65s ease-in-out, border-color 0.65s ease-in-out;
}

.filter-btn.active {
  background: var(--navy);
  color: white;
  border-color: var(--navy);
}

.expense-list {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  max-height: 400px;
  overflow-y: auto;
}

.expense-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 13px 2px;
  border-bottom: 1px solid var(--border);
  animation: fadeIn 0.65s ease-in-out;
}

.expense-item:last-child {
  border-bottom: none;
}

.expense-info {
  display: flex;
  flex-direction: column;
}

.expense-name {
  font-weight: 600;
}

.expense-meta {
  font-size: 0.78rem;
  color: var(--muted);
}

.expense-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.expense-amount {
  font-weight: 700;
  color: var(--navy);
  transition: color 0.65s ease-in-out;
}

body.dark .expense-amount {
  color: var(--sage);
}

.delete-btn {
  background: none;
  border: none;
  color: var(--coral);
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.75;
  transition: opacity 0.15s;
}

.delete-btn:hover {
  opacity: 1;
}

.category-tag {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 10px;
  background: var(--accent-light);
  color: var(--sage);
  font-size: 0.68rem;
  font-weight: 600;
  margin-top: 3px;
  width: fit-content;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  #expenseForm {
    grid-template-columns: 1fr;
  }
  #expenseForm button {
    grid-column: span 1;
  }
}

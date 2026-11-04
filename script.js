'use strict';

/* =====================================================================
   MiEx — personal expense tracker
   Everything runs in the browser; data is stored in localStorage only.
   ===================================================================== */

const APP_VERSION = '1.0.0';

/* ---------- Service worker (registered first so a later error can never block it) ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' })
      .catch((err) => console.warn('[MiEx] Service worker registration failed:', err));
  });
}

/* ---------- Small helpers ---------- */
const $ = (id) => document.getElementById(id);

const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, String(value)); return true; } catch (e) { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
};

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pad(n) { return String(n).padStart(2, '0'); }

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayISO() { return toISODate(new Date()); }

function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && y >= 1970 && y <= 2100;
}

function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function sumAmounts(list) {
  return Math.round(list.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
}

function generateId(taken) {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  while (taken && taken.has(id)) id += 1;
  return id;
}

/* ---------- Currency ---------- */
const CURRENCIES = {
  NGN: { symbol: '₦',   locale: 'en-NG', label: 'Nigerian Naira (₦)' },
  GHS: { symbol: 'GH₵', locale: 'en-GH', label: 'Ghanaian Cedi (GH₵)' },
  KES: { symbol: 'KSh ', locale: 'en-KE', label: 'Kenyan Shilling (KSh)' },
  ZAR: { symbol: 'R',   locale: 'en-ZA', label: 'South African Rand (R)' },
  USD: { symbol: '$',   locale: 'en-US', label: 'US Dollar ($)' },
  GBP: { symbol: '£',   locale: 'en-GB', label: 'British Pound (£)' },
  EUR: { symbol: '€',   locale: 'en-IE', label: 'Euro (€)' },
  INR: { symbol: '₹',   locale: 'en-IN', label: 'Indian Rupee (₹)' }
};

let currencyCode = CURRENCIES[store.get('currency')] ? store.get('currency') : 'NGN';

function currentCurrency() { return CURRENCIES[currencyCode] || CURRENCIES.NGN; }

function fmtNumber(n, minFrac = 2, maxFrac = 2) {
  try {
    return Number(n).toLocaleString(currentCurrency().locale, { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac });
  } catch (e) {
    return Number(n).toFixed(maxFrac);
  }
}

function money(n) { return currentCurrency().symbol + fmtNumber(n); }

function moneyCompact(n) {
  try {
    return currentCurrency().symbol + new Intl.NumberFormat(currentCurrency().locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch (e) {
    return currentCurrency().symbol + Math.round(n);
  }
}

/* ---------- Data: load / validate / save ---------- */
const MAIN_CATEGORIES = ['Feeding', 'Clothing', 'Transportation', 'Bills'];
const CHART_CATEGORIES = [...MAIN_CATEGORIES, 'Others'];

let startupNotice = '';

function sanitizeExpense(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name == null ? '' : raw.name).trim().slice(0, 100);
  const category = String(raw.category == null ? '' : raw.category).trim().slice(0, 40) || 'Others';
  const amount = typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount);
  if (!name || !isFinite(amount) || amount <= 0 || amount > 1e12 || !isValidISODate(raw.date)) return null;
  let id = Number(raw.id);
  if (!isFinite(id) || id <= 0) id = 0;
  return { id, name, amount: Math.round(amount * 100) / 100, category, date: raw.date };
}

function assignUniqueIds(list) {
  const taken = new Set();
  return list.map((e) => {
    let id = e.id;
    if (!id || taken.has(id)) id = generateId(taken);
    taken.add(id);
    return { ...e, id };
  });
}

function loadExpenses() {
  const raw = store.get('expenses');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('saved data is not a list');
    return assignUniqueIds(parsed.map(sanitizeExpense).filter(Boolean));
  } catch (err) {
    console.warn('[MiEx] Saved data could not be read, keeping a copy.', err);
    store.set('expenses_corrupt_backup', raw);
    startupNotice = 'Some saved data could not be read. A safe copy was kept.';
    return [];
  }
}

function loadBudget() {
  const v = parseFloat(store.get('monthlyBudget'));
  return isFinite(v) && v > 0 ? v : null;
}

let expenses = loadExpenses();
let monthlyBudget = loadBudget();

function saveExpenses() {
  if (!store.set('expenses', JSON.stringify(expenses))) {
    showToast('Could not save. Your device storage may be full.');
  }
}

/* ---------- App state ---------- */
let activeFilter = 'All';
let activePeriod = 'all';   // 'all' | 'week' | 'month' | 'year' | 'custom'
let periodValue = null;     // week: 'YYYY-MM-DD' (week start) | month: 'YYYY-MM' | year: 'YYYY'
let customFrom = null;
let customTo = null;
let chart = null;
let trendChart = null;
let pendingDeleteId = null;
let editingExpenseId = null;
let pendingImport = null;
let searchQuery = '';
let balanceHidden = store.get('balanceHidden') === 'true';

/* ---------- DOM ---------- */
const form = $('expenseForm');
const nameInput = $('name');
const amountInput = $('amount');
const categoryInput = $('category');
const customCategoryInput = $('customCategory');
const dateInput = $('date');
const expenseList = $('expenseList');
const balanceEl = $('balance');
const balanceLabel = $('balanceLabel');
const filters = $('filters');
const periodTabs = $('periodTabs');
const periodValueSelect = $('periodValueSelect');
const customRangeEl = $('customRange');
const customFromInput = $('customFrom');
const customToInput = $('customTo');
const darkModeToggle = $('darkModeToggle');
const settingsBtn = $('settingsBtn');
const greetingText = $('greetingText');
const avatarEl = $('avatar');
const insightBanner = $('insightBanner');
const insightText = $('insightText');
const insightDismissBtn = $('insightDismiss');
const toggleVisibilityBtn = $('toggleVisibility');
const searchInput = $('searchInput');
const budgetContent = $('budgetContent');
const editBudgetBtn = $('editBudgetBtn');
const toastEl = $('toast');
const metaTheme = document.querySelector('meta[name="theme-color"]');

const nameModal = $('nameModal');
const userNameInput = $('userNameInput');
const budgetModal = $('budgetModal');
const budgetInput = $('budgetInput');
const editModal = $('editModal');
const editNameInput = $('editName');
const editAmountInput = $('editAmount');
const editCategoryInput = $('editCategory');
const editCustomCategoryInput = $('editCustomCategory');
const editDateInput = $('editDate');
const confirmModal = $('confirmModal');
const settingsModal = $('settingsModal');
const importModal = $('importModal');
const clearModal = $('clearModal');

$('footerYear').textContent = new Date().getFullYear();

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(message, ms = 3400) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------- Modals ---------- */
const lastFocus = new Map();

function openModal(el, focusEl) {
  lastFocus.set(el, document.activeElement);
  el.style.display = 'flex';
  document.documentElement.classList.add('modal-open');
  if (focusEl) setTimeout(() => focusEl.focus(), 40);
}

function closeModal(el) {
  el.style.display = 'none';
  const prev = lastFocus.get(el);
  if (prev && typeof prev.focus === 'function') { try { prev.focus(); } catch (e) { /* ignore */ } }
  const anyOpen = Array.from(document.querySelectorAll('.modal-overlay')).some((m) => m.style.display !== 'none');
  if (!anyOpen) document.documentElement.classList.remove('modal-open');
}

function dismissModal(el) {
  if (el === confirmModal) pendingDeleteId = null;
  if (el === editModal) editingExpenseId = null;
  if (el === importModal) pendingImport = null;
  if (el === nameModal) store.set('nameAsked', '1');
  closeModal(el);
}

document.querySelectorAll('.modal-overlay').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) dismissModal(m); });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = Array.from(document.querySelectorAll('.modal-overlay')).filter((m) => m.style.display !== 'none');
  if (open.length) dismissModal(open[open.length - 1]);
});

/* ---------- Theme ---------- */
function isDark() { return document.documentElement.classList.contains('dark'); }

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  darkModeToggle.textContent = dark ? '☀️' : '🌙';
  if (metaTheme) metaTheme.setAttribute('content', dark ? '#0A0A0A' : '#F68B1E');
}

(function initTheme() {
  const saved = store.get('darkMode');
  const dark = saved === null
    ? !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    : saved === 'true';
  applyTheme(dark);
})();

darkModeToggle.addEventListener('click', () => {
  const dark = !isDark();
  applyTheme(dark);
  store.set('darkMode', dark);
  renderChart();
  renderTrendChart();
});

/* ---------- Name, greeting, avatar ---------- */
function getUserName() { return store.get('userName', ''); }

function updateAvatar() {
  const name = getUserName();
  avatarEl.textContent = name ? name.charAt(0).toUpperCase() : '?';
}

function setGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  const name = getUserName();
  greetingText.textContent = name ? `${greeting}, ${name} 👋` : `${greeting} 👋`;
}

function openNameModal() {
  userNameInput.value = getUserName();
  openModal(nameModal, userNameInput);
}

function saveUserName() {
  const val = userNameInput.value.trim().slice(0, 20);
  if (!val) { showToast('Type a name, or tap Skip.'); return; }
  store.set('userName', val);
  store.set('nameAsked', '1');
  closeModal(nameModal);
  setGreeting();
  updateAvatar();
}

avatarEl.addEventListener('click', openNameModal);
$('saveName').addEventListener('click', saveUserName);
$('skipName').addEventListener('click', () => dismissModal(nameModal));
userNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveUserName(); });

/* ---------- Balance visibility ---------- */
function updateEyeButton() {
  toggleVisibilityBtn.textContent = balanceHidden ? '🙈' : '👁️';
}

toggleVisibilityBtn.addEventListener('click', () => {
  balanceHidden = !balanceHidden;
  store.set('balanceHidden', balanceHidden);
  updateEyeButton();
  renderBalance();
});

/* ---------- Date helpers ---------- */
function monthKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`; }

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function weekKey(date) { return toISODate(weekStart(date)); }

function weekLabel(key) {
  const start = parseISODate(key);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const lastWeekRef = new Date();
  lastWeekRef.setDate(lastWeekRef.getDate() - 7);
  if (key === weekKey(new Date())) return 'This Week';
  if (key === weekKey(lastWeekRef)) return 'Last Week';
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function formatDateNice(str) {
  return parseISODate(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ---------- Period options ---------- */
function getMonthOptions() {
  const now = new Date();
  const keys = new Set();
  for (let i = 0; i < 12; i++) keys.add(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  expenses.forEach((e) => keys.add(monthKey(parseISODate(e.date))));
  return Array.from(keys).sort().reverse();
}

function getWeekOptions() {
  const now = new Date();
  const keys = new Set();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    keys.add(weekKey(d));
  }
  expenses.forEach((e) => keys.add(weekKey(parseISODate(e.date))));
  return Array.from(keys).sort().reverse();
}

function getYearOptions() {
  const keys = new Set([String(new Date().getFullYear())]);
  expenses.forEach((e) => keys.add(String(parseISODate(e.date).getFullYear())));
  return Array.from(keys).sort().reverse();
}

function refreshPeriodOptions(resetToDefault) {
  if (activePeriod === 'all' || activePeriod === 'custom') {
    periodValueSelect.style.display = 'none';
    periodValueSelect.innerHTML = '';
    periodValue = null;
    return;
  }

  let options;
  if (activePeriod === 'month') options = getMonthOptions().map((k) => ({ value: k, label: monthLabel(k) }));
  else if (activePeriod === 'week') options = getWeekOptions().map((k) => ({ value: k, label: weekLabel(k) }));
  else options = getYearOptions().map((k) => ({ value: k, label: k }));

  periodValueSelect.innerHTML = options
    .map((o) => `<option value="${escapeHTML(o.value)}">${escapeHTML(o.label)}</option>`)
    .join('');
  periodValueSelect.style.display = 'block';

  if (resetToDefault || !options.some((o) => o.value === periodValue)) {
    periodValue = options.length ? options[0].value : null;
  }
  periodValueSelect.value = periodValue;
}

/* ---------- Period filtering ---------- */
function isInActivePeriod(dateStr) {
  if (activePeriod === 'all') return true;
  if (activePeriod === 'custom') {
    if (!customFrom || !customTo) return true;
    return dateStr >= customFrom && dateStr <= customTo;
  }
  const d = parseISODate(dateStr);
  if (activePeriod === 'year') return String(d.getFullYear()) === periodValue;
  if (activePeriod === 'month') return monthKey(d) === periodValue;
  if (activePeriod === 'week') return weekKey(d) === periodValue;
  return true;
}

function getPeriodExpenses() {
  return expenses.filter((e) => isInActivePeriod(e.date));
}

function currentPeriodLabel() {
  if (activePeriod === 'all') return 'Total Spent';
  if (activePeriod === 'custom') {
    if (!customFrom || !customTo) return 'Total Spent (Custom Range)';
    return `Total Spent (${formatDateNice(customFrom)} – ${formatDateNice(customTo)})`;
  }
  let label = '';
  if (activePeriod === 'month') label = monthLabel(periodValue);
  else if (activePeriod === 'week') label = weekLabel(periodValue);
  else if (activePeriod === 'year') label = periodValue;
  return `Total Spent (${label})`;
}

/* ---------- Render: balance ---------- */
function renderBalance() {
  const total = sumAmounts(getPeriodExpenses());
  balanceEl.textContent = balanceHidden ? `${currentCurrency().symbol} ••••••` : money(total);
  balanceLabel.textContent = currentPeriodLabel();
}

/* ---------- Render: list ---------- */
function renderList() {
  const periodExpenses = getPeriodExpenses();

  let filtered;
  if (activeFilter === 'All') filtered = periodExpenses;
  else if (activeFilter === 'Others') filtered = periodExpenses.filter((e) => !MAIN_CATEGORIES.includes(e.category));
  else filtered = periodExpenses.filter((e) => e.category === activeFilter);

  if (searchQuery) filtered = filtered.filter((e) => e.name.toLowerCase().includes(searchQuery));

  if (filtered.length === 0) {
    let message = 'No expenses in this period.';
    if (searchQuery) message = 'No expenses match your search.';
    else if (expenses.length === 0) message = 'Nothing here yet. Add your first expense above.';
    expenseList.innerHTML = `<p class="empty-state">${escapeHTML(message)}</p>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  expenseList.innerHTML = sorted.map((e) => `
    <li class="expense-item" data-id="${e.id}" tabindex="0" aria-label="Edit ${escapeHTML(e.name)}, ${escapeHTML(money(e.amount))}">
      <div class="expense-info">
        <span class="expense-name">${escapeHTML(e.name)}</span>
        <span class="expense-meta">${escapeHTML(e.date)}</span>
        <span class="category-tag">${escapeHTML(e.category)}</span>
      </div>
      <div class="expense-right">
        <span class="expense-amount">${escapeHTML(money(e.amount))}</span>
        <button class="delete-btn" data-id="${e.id}" title="Delete" aria-label="Delete ${escapeHTML(e.name)}">✕</button>
      </div>
    </li>`).join('');
}

/* ---------- Render: charts ---------- */
function chartsAvailable() { return typeof Chart !== 'undefined'; }

function categoryTotals(list) {
  return CHART_CATEGORIES.map((cat) => {
    if (cat === 'Others') return sumAmounts(list.filter((e) => !MAIN_CATEGORIES.includes(e.category)));
    return sumAmounts(list.filter((e) => e.category === cat));
  });
}

function renderChart() {
  const legendEl = $('categoryLegend');
  if (chart) { chart.destroy(); chart = null; }

  const totals = categoryTotals(getPeriodExpenses());
  const grandTotal = totals.reduce((s, v) => s + v, 0);
  const dark = isDark();
  const catColors = dark
    ? ['#F2967F', '#BBA3F0', '#79D2D9', '#F6D06A', '#9089B0']
    : ['#F0836C', '#A98FE0', '#5FBFC7', '#F6C453', '#B9B2C4'];

  legendEl.innerHTML = CHART_CATEGORIES.map((label, i) => {
    const pct = grandTotal > 0 ? Math.round((totals[i] / grandTotal) * 100) : 0;
    return `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${catColors[i]}"></span>${escapeHTML(label)} ${pct}%</span>`;
  }).join('');

  if (!chartsAvailable()) return;

  try {
    chart = new Chart($('categoryChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: CHART_CATEGORIES,
        datasets: [{
          data: grandTotal > 0 ? totals : [1],
          backgroundColor: grandTotal > 0 ? catColors : [dark ? '#2A2724' : '#EFE9E0'],
          borderWidth: 3,
          borderColor: dark ? '#161616' : '#FFFFFF',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { display: false }, tooltip: { enabled: grandTotal > 0 } }
      },
      plugins: [{
        id: 'centerText',
        afterDraw: (inst) => {
          const { ctx, chartArea } = inst;
          if (!chartArea) return;
          const x = (chartArea.left + chartArea.right) / 2;
          const y = (chartArea.top + chartArea.bottom) / 2;
          const innerWidth = (chartArea.right - chartArea.left) * 0.68 * 0.82;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = dark ? '#F0EBE3' : '#2E2418';
          ctx.font = '700 14px Quicksand, sans-serif';
          let text = money(Math.round(grandTotal));
          if (ctx.measureText(text).width > innerWidth) text = moneyCompact(grandTotal);
          ctx.fillText(text, x, y - 6);
          ctx.font = '600 11px Nunito, sans-serif';
          ctx.fillStyle = dark ? '#9C9690' : '#8C7C6B';
          ctx.fillText('Total Spent', x, y + 12);
          ctx.restore();
        }
      }]
    });
  } catch (err) {
    console.warn('[MiEx] Could not draw the category chart:', err);
  }
}

function renderTrendChart() {
  if (trendChart) { trendChart.destroy(); trendChart = null; }
  if (!chartsAvailable()) return;

  const now = new Date();
  const keys = [];
  for (let i = 5; i >= 0; i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  const labels = keys.map((k) => {
    const [y, m] = k.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' });
  });
  const totals = keys.map((k) => sumAmounts(expenses.filter((e) => monthKey(parseISODate(e.date)) === k)));

  const dark = isDark();
  const tick = dark ? '#9C9690' : '#8C7C6B';

  try {
    trendChart = new Chart($('trendChart').getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data: totals, backgroundColor: dark ? '#FF9D45' : '#F68B1E', borderRadius: 6, maxBarThickness: 40 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => money(c.parsed.y) } }
        },
        scales: {
          x: { ticks: { color: tick, font: { family: 'Nunito' } }, grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { color: tick, font: { family: 'Nunito' }, maxTicksLimit: 6, callback: (v) => moneyCompact(v) },
            grid: { color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(46,36,24,0.06)' }
          }
        }
      }
    });
  } catch (err) {
    console.warn('[MiEx] Could not draw the trend chart:', err);
  }
}

/* ---------- Insight banner (month-to-date vs the same days last month) ---------- */
const INSIGHT_DISMISS_MS = 4 * 60 * 60 * 1000;

function isInsightDismissed() {
  try {
    const at = sessionStorage.getItem('insightDismissedAt');
    return !!at && (Date.now() - parseInt(at, 10)) < INSIGHT_DISMISS_MS;
  } catch (e) { return false; }
}

function renderInsight() {
  const now = new Date();
  const day = now.getDate();
  const thisKey = monthKey(now);
  const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const upToToday = (key) => sumAmounts(expenses.filter((e) => {
    const d = parseISODate(e.date);
    return monthKey(d) === key && d.getDate() <= day;
  }));

  const lastTotal = upToToday(lastKey);
  const thisTotal = upToToday(thisKey);

  if (lastTotal === 0 || isInsightDismissed()) { insightBanner.style.display = 'none'; return; }

  const diff = lastTotal - thisTotal;
  const amount = money(Math.abs(diff));
  insightBanner.style.display = 'flex';
  const icon = insightBanner.querySelector('.insight-icon');
  if (diff >= 0) {
    insightBanner.classList.remove('warn');
    icon.textContent = '🌿';
    insightText.textContent = `You're ${amount} below this time last month.`;
  } else {
    insightBanner.classList.add('warn');
    icon.textContent = '⚠️';
    insightText.textContent = `You're ${amount} above this time last month.`;
  }
}

insightDismissBtn.addEventListener('click', () => {
  try { sessionStorage.setItem('insightDismissedAt', String(Date.now())); } catch (e) { /* ignore */ }
  insightBanner.style.display = 'none';
});

/* ---------- Budget ---------- */
function spentThisMonth() {
  const key = monthKey(new Date());
  return sumAmounts(expenses.filter((e) => monthKey(parseISODate(e.date)) === key));
}

function renderBudget() {
  if (monthlyBudget === null) {
    budgetContent.innerHTML = '<p class="budget-empty-text">Set a monthly budget to track your spending goals.</p>';
    return;
  }
  const spent = spentThisMonth();
  const pct = Math.min(100, Math.round((spent / monthlyBudget) * 100));
  let stateClass = '';
  if (spent >= monthlyBudget) stateClass = 'danger';
  else if (pct >= 80) stateClass = 'warn';

  let alertHtml = '';
  if (spent >= monthlyBudget) {
    alertHtml = `<p class="budget-alert danger">You've exceeded your monthly budget by ${escapeHTML(money(spent - monthlyBudget))}.</p>`;
  } else if (pct >= 80) {
    alertHtml = `<p class="budget-alert warn">You've used ${pct}% of your monthly budget.</p>`;
  }

  budgetContent.innerHTML = `
    <div class="budget-stats"><span>${escapeHTML(money(spent))} spent</span><span>of ${escapeHTML(money(monthlyBudget))}</span></div>
    <div class="budget-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
      <div class="budget-progress-fill ${stateClass}" style="width:${pct}%"></div>
    </div>
    ${alertHtml}`;
}

function saveBudget() {
  const val = parseFloat(budgetInput.value);
  if (!isFinite(val) || val <= 0) { showToast('Enter a budget greater than zero.'); return; }
  monthlyBudget = Math.round(val * 100) / 100;
  store.set('monthlyBudget', monthlyBudget);
  closeModal(budgetModal);
  renderBudget();
}

editBudgetBtn.addEventListener('click', () => {
  budgetInput.value = monthlyBudget !== null ? monthlyBudget : '';
  openModal(budgetModal, budgetInput);
});
$('saveBudget').addEventListener('click', saveBudget);
budgetInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBudget(); });
$('clearBudget').addEventListener('click', () => {
  monthlyBudget = null;
  store.remove('monthlyBudget');
  closeModal(budgetModal);
  renderBudget();
});

/* ---------- Render all ---------- */
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
  renderTrendChart();
  renderInsight();
  renderBudget();
}

/* ---------- Add expense ---------- */
function readExpenseFields(nameEl, amountEl, catEl, customEl, dateEl) {
  const name = nameEl.value.trim();
  if (!name) return { error: 'Please enter a name for the expense.' };
  const amount = parseFloat(amountEl.value);
  if (!isFinite(amount) || amount <= 0) return { error: 'Enter an amount greater than zero.' };
  if (amount > 1e12) return { error: 'That amount is too large.' };
  if (!isValidISODate(dateEl.value)) return { error: 'Please pick a valid date.' };
  let category = catEl.value;
  if (category === 'Others') {
    const custom = customEl.value.trim();
    if (custom) category = custom.slice(0, 30);
  }
  return { ok: true, name: name.slice(0, 60), amount: Math.round(amount * 100) / 100, category, date: dateEl.value };
}

function toggleCustomCategory(selectEl, inputEl, required) {
  if (selectEl.value === 'Others') {
    inputEl.style.display = 'block';
    if (required) inputEl.required = true;
  } else {
    inputEl.style.display = 'none';
    inputEl.required = false;
    inputEl.value = '';
  }
}

categoryInput.addEventListener('change', () => toggleCustomCategory(categoryInput, customCategoryInput, true));
editCategoryInput.addEventListener('change', () => toggleCustomCategory(editCategoryInput, editCustomCategoryInput, false));

function resetAddForm() {
  form.reset();
  dateInput.value = todayISO();
  customCategoryInput.style.display = 'none';
  customCategoryInput.required = false;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = readExpenseFields(nameInput, amountInput, categoryInput, customCategoryInput, dateInput);
  if (!data.ok) { showToast(data.error); return; }

  const before = spentThisMonth();
  const taken = new Set(expenses.map((x) => x.id));
  expenses.push({ id: generateId(taken), name: data.name, amount: data.amount, category: data.category, date: data.date });
  saveExpenses();
  refreshPeriodOptions(false);
  renderAll();
  resetAddForm();

  if (monthlyBudget !== null) {
    const after = spentThisMonth();
    if (before < monthlyBudget && after >= monthlyBudget) showToast('⚠️ You have reached your monthly budget.');
    else if (before < monthlyBudget * 0.8 && after >= monthlyBudget * 0.8) showToast('Heads up: you have used 80% of your budget.');
    else showToast('Expense added ✓', 1800);
  } else {
    showToast('Expense added ✓', 1800);
  }
});

/* ---------- Edit / delete (tap an item to edit, ✕ to delete) ---------- */
function openEditModal(id) {
  const expense = expenses.find((x) => x.id === id);
  if (!expense) return;
  editingExpenseId = id;
  editNameInput.value = expense.name;
  editAmountInput.value = expense.amount;
  editDateInput.value = expense.date;
  if (MAIN_CATEGORIES.includes(expense.category)) {
    editCategoryInput.value = expense.category;
    editCustomCategoryInput.style.display = 'none';
    editCustomCategoryInput.value = '';
  } else {
    editCategoryInput.value = 'Others';
    editCustomCategoryInput.style.display = 'block';
    editCustomCategoryInput.value = expense.category;
  }
  openModal(editModal, editNameInput);
}

function closeEditModal() { editingExpenseId = null; closeModal(editModal); }

expenseList.addEventListener('click', (e) => {
  const del = e.target.closest('.delete-btn');
  if (del) {
    pendingDeleteId = Number(del.dataset.id);
    openModal(confirmModal);
    return;
  }
  const item = e.target.closest('.expense-item');
  if (item) openEditModal(Number(item.dataset.id));
});

expenseList.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('expense-item')) {
    e.preventDefault();
    openEditModal(Number(e.target.dataset.id));
  }
});

$('cancelDelete').addEventListener('click', () => dismissModal(confirmModal));
$('confirmDelete').addEventListener('click', () => {
  if (pendingDeleteId !== null) {
    expenses = expenses.filter((x) => x.id !== pendingDeleteId);
    saveExpenses();
    refreshPeriodOptions(false);
    renderAll();
    showToast('Expense deleted', 1800);
  }
  pendingDeleteId = null;
  closeModal(confirmModal);
});

$('cancelEdit').addEventListener('click', closeEditModal);
$('saveEdit').addEventListener('click', () => {
  if (editingExpenseId === null) return;
  const expense = expenses.find((x) => x.id === editingExpenseId);
  if (!expense) { closeEditModal(); return; }
  const data = readExpenseFields(editNameInput, editAmountInput, editCategoryInput, editCustomCategoryInput, editDateInput);
  if (!data.ok) { showToast(data.error); return; }
  expense.name = data.name;
  expense.amount = data.amount;
  expense.category = data.category;
  expense.date = data.date;
  saveExpenses();
  refreshPeriodOptions(false);
  renderAll();
  closeEditModal();
  showToast('Changes saved ✓', 1800);
});

/* ---------- Search, category filter ---------- */
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderList();
});

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.category;
  renderList();
});

/* ---------- Period tabs, history dropdown, custom range ---------- */
periodTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.period-btn');
  if (!btn) return;
  document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  activePeriod = btn.dataset.period;

  if (activePeriod === 'custom') {
    customRangeEl.style.display = 'flex';
    if (!customFrom || !customTo) {
      const today = new Date();
      const past = new Date();
      past.setDate(today.getDate() - 29);
      customTo = toISODate(today);
      customFrom = toISODate(past);
      customFromInput.value = customFrom;
      customToInput.value = customTo;
    }
  } else {
    customRangeEl.style.display = 'none';
  }
  refreshPeriodOptions(true);
  renderAll();
});

function handleCustomRangeChange() {
  if (customFromInput.value) customFrom = customFromInput.value;
  if (customToInput.value) customTo = customToInput.value;
  if (customFrom && customTo && customFrom > customTo) {
    [customFrom, customTo] = [customTo, customFrom];
    customFromInput.value = customFrom;
    customToInput.value = customTo;
  }
  renderAll();
}
customFromInput.addEventListener('change', handleCustomRangeChange);
customToInput.addEventListener('change', handleCustomRangeChange);

periodValueSelect.addEventListener('change', () => {
  periodValue = periodValueSelect.value;
  renderAll();
});

/* =====================================================================
   Backup, restore, CSV, currency, reset
   ===================================================================== */
function buildBackup() {
  return {
    app: 'MiEx',
    schema: 1,
    exportedAt: new Date().toISOString(),
    settings: { currency: currencyCode, monthlyBudget, userName: getUserName() },
    expenses: expenses.map((e) => ({ ...e }))
  };
}

function backupFilename(ext) { return `miex-backup-${todayISO()}.${ext}`; }

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function backupBlob() {
  return new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
}

function csvCell(value) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildCSV() {
  const rows = [['Date', 'Name', 'Category', 'Amount']];
  [...expenses].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .forEach((e) => rows.push([e.date, e.name, e.category, e.amount.toFixed(2)]));
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function parseBackupText(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error("That file isn't a valid MiEx backup."); }
  const list = Array.isArray(data) ? data : data && data.expenses;
  if (!Array.isArray(list)) throw new Error("That file doesn't look like a MiEx backup.");
  const clean = list.map(sanitizeExpense).filter(Boolean);
  const settings = {};
  const s = data && !Array.isArray(data) ? data.settings : null;
  if (s && typeof s === 'object') {
    if (CURRENCIES[s.currency]) settings.currency = s.currency;
    const b = parseFloat(s.monthlyBudget);
    if (isFinite(b) && b > 0) settings.monthlyBudget = Math.round(b * 100) / 100;
    if (typeof s.userName === 'string' && s.userName.trim()) settings.userName = s.userName.trim().slice(0, 20);
  }
  return { expenses: clean, skipped: list.length - clean.length, settings };
}

function expenseSignature(e) { return `${e.date}|${e.name.toLowerCase()}|${e.amount}|${e.category.toLowerCase()}`; }

function applyImport(mode) {
  if (!pendingImport) return;
  const incoming = pendingImport.expenses;
  let added = 0;

  if (mode === 'replace') {
    expenses = assignUniqueIds(incoming);
    added = expenses.length;
    const st = pendingImport.settings;
    if (st.currency) { currencyCode = st.currency; store.set('currency', currencyCode); }
    if (st.monthlyBudget) { monthlyBudget = st.monthlyBudget; store.set('monthlyBudget', monthlyBudget); }
    if (st.userName) { store.set('userName', st.userName); store.set('nameAsked', '1'); }
  } else {
    const seen = new Set(expenses.map(expenseSignature));
    const taken = new Set(expenses.map((e) => e.id));
    incoming.forEach((e) => {
      if (seen.has(expenseSignature(e))) return;
      seen.add(expenseSignature(e));
      const id = e.id && !taken.has(e.id) ? e.id : generateId(taken);
      taken.add(id);
      expenses.push({ ...e, id });
      added += 1;
    });
  }

  saveExpenses();
  pendingImport = null;
  closeModal(importModal);
  refreshPeriodOptions(false);
  syncCurrencyUI();
  setGreeting();
  updateAvatar();
  renderAll();
  showToast(added ? `Restored ${added} expense${added === 1 ? '' : 's'} ✓` : 'Nothing new to add — everything was already here.');
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}

async function handleImportFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('That file is too large to be a MiEx backup.'); return; }
  try {
    const parsed = parseBackupText(await readFileAsText(file));
    if (parsed.expenses.length === 0) { showToast('No valid expenses were found in that file.'); return; }
    pendingImport = parsed;
    const skipNote = parsed.skipped ? ` (${parsed.skipped} unreadable entr${parsed.skipped === 1 ? 'y' : 'ies'} skipped)` : '';
    $('importSummary').textContent =
      `Found ${parsed.expenses.length} expense${parsed.expenses.length === 1 ? '' : 's'}${skipNote}. ` +
      `"Merge" adds only what's missing. "Replace all" swaps your current data for this backup.`;
    closeModal(settingsModal);
    openModal(importModal);
  } catch (err) {
    showToast(err.message || "Couldn't read that backup.");
  }
}

$('exportJsonBtn').addEventListener('click', () => {
  if (expenses.length === 0) { showToast('Nothing to back up yet.'); return; }
  downloadBlob(backupFilename('json'), backupBlob());
  showToast('Backup saved to your downloads ✓');
});

$('exportCsvBtn').addEventListener('click', () => {
  if (expenses.length === 0) { showToast('Nothing to export yet.'); return; }
  downloadBlob(backupFilename('csv'), new Blob([buildCSV()], { type: 'text/csv;charset=utf-8' }));
  showToast('CSV saved to your downloads ✓');
});

const shareBtn = $('shareBackupBtn');
(function initShare() {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) shareBtn.style.display = '';
  } catch (e) { /* sharing files isn't supported here */ }
})();

shareBtn.addEventListener('click', async () => {
  if (expenses.length === 0) { showToast('Nothing to back up yet.'); return; }
  try {
    const file = new File([backupBlob()], backupFilename('json'), { type: 'application/json' });
    await navigator.share({ files: [file], title: 'MiEx backup' });
  } catch (err) {
    if (err && err.name !== 'AbortError') showToast("Couldn't open the share sheet.");
  }
});

const importFileInput = $('importFile');
$('importBtn').addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', () => {
  const file = importFileInput.files && importFileInput.files[0];
  importFileInput.value = '';
  handleImportFile(file);
});
$('importCancel').addEventListener('click', () => dismissModal(importModal));
$('importMerge').addEventListener('click', () => applyImport('merge'));
$('importReplace').addEventListener('click', () => applyImport('replace'));

/* ---------- Currency ---------- */
const currencySelect = $('currencySelect');
currencySelect.innerHTML = Object.keys(CURRENCIES)
  .map((code) => `<option value="${code}">${escapeHTML(CURRENCIES[code].label)}</option>`).join('');

function syncCurrencyUI() { currencySelect.value = currencyCode; }
syncCurrencyUI();

currencySelect.addEventListener('change', () => {
  currencyCode = CURRENCIES[currencySelect.value] ? currencySelect.value : 'NGN';
  store.set('currency', currencyCode);
  renderAll();
  showToast('Currency updated ✓', 1800);
});

/* ---------- Delete everything ---------- */
$('clearDataBtn').addEventListener('click', () => { closeModal(settingsModal); openModal(clearModal); });
$('clearCancel').addEventListener('click', () => closeModal(clearModal));
$('clearConfirm').addEventListener('click', () => {
  ['expenses', 'monthlyBudget', 'userName', 'nameAsked', 'balanceHidden', 'currency', 'darkMode',
   'installDismissedAt', 'expenses_corrupt_backup'].forEach((k) => store.remove(k));
  expenses = [];
  monthlyBudget = null;
  currencyCode = 'NGN';
  balanceHidden = false;
  activeFilter = 'All';
  searchQuery = '';
  searchInput.value = '';
  document.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.category === 'All'));
  syncCurrencyUI();
  updateEyeButton();
  setGreeting();
  updateAvatar();
  refreshPeriodOptions(false);
  renderAll();
  closeModal(clearModal);
  showToast('All data deleted.');
});

/* =====================================================================
   Settings screen + install support + app status
   ===================================================================== */
function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

let deferredInstallPrompt = null;
const installBanner = $('installBanner');
const installBtn = $('installBtn');
const installNote = $('installNote');
const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function installDismissedRecently() {
  const at = parseInt(store.get('installDismissedAt', '0'), 10);
  return !!at && Date.now() - at < INSTALL_DISMISS_MS;
}

function updateInstallUI() {
  if (isStandalone()) {
    installNote.textContent = "You're using the installed app. 🎉";
    installBtn.style.display = 'none';
    installBanner.style.display = 'none';
    return;
  }
  if (deferredInstallPrompt) {
    installNote.textContent = 'Add MiEx to your home screen for one-tap access, even offline.';
    installBtn.style.display = '';
    installBanner.style.display = installDismissedRecently() ? 'none' : 'flex';
    return;
  }
  installBtn.style.display = 'none';
  installBanner.style.display = 'none';
  installNote.textContent = isIOS()
    ? 'On iPhone/iPad: tap the Share button in Safari, then "Add to Home Screen".'
    : 'To install: open your browser menu and choose "Install app" or "Add to Home screen".';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallUI();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallUI();
  showToast('MiEx installed 🎉');
});

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  try {
    promptEvent.prompt();
    await promptEvent.userChoice;
  } catch (err) {
    console.warn('[MiEx] Install prompt failed:', err);
  }
  updateInstallUI();
}

installBtn.addEventListener('click', triggerInstall);
$('installBannerBtn').addEventListener('click', triggerInstall);
$('installBannerDismiss').addEventListener('click', () => {
  store.set('installDismissedAt', Date.now());
  installBanner.style.display = 'none';
});

async function refreshStatus() {
  $('stVersion').textContent = APP_VERSION;
  $('stMode').textContent = isStandalone() ? 'Installed app' : 'Browser tab';
  $('stOnline').textContent = navigator.onLine ? 'Online' : 'Offline';

  const offlineEl = $('stOffline');
  if (!('serviceWorker' in navigator) || !window.caches) { offlineEl.textContent = 'Not supported here'; return; }
  try {
    const cached = await caches.match('./index.html', { ignoreSearch: true });
    if (navigator.serviceWorker.controller && cached) offlineEl.textContent = 'Yes ✓';
    else if (cached || navigator.serviceWorker.controller) offlineEl.textContent = 'Almost - reopen the app once';
    else offlineEl.textContent = 'Not yet - stay online a moment';
  } catch (e) {
    offlineEl.textContent = 'Unknown';
  }
}

settingsBtn.addEventListener('click', () => {
  syncCurrencyUI();
  updateInstallUI();
  refreshStatus();
  openModal(settingsModal);
});
$('closeSettings').addEventListener('click', () => closeModal(settingsModal));

window.addEventListener('online', () => showToast('Back online', 1800));
window.addEventListener('offline', () => showToast("You're offline — MiEx still works.", 2600));

/* ---------- Start ---------- */
updateEyeButton();
setGreeting();
updateAvatar();
dateInput.value = todayISO();
updateInstallUI();
renderAll();

if (startupNotice) showToast(startupNotice, 6000);

// Shortcut from the app icon ("Add expense"): jump straight to the form
if (/[?&]action=add\b/.test(location.search)) {
  nameInput.scrollIntoView({ block: 'center' });
  setTimeout(() => nameInput.focus(), 200);
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
} else if (!getUserName() && !store.get('nameAsked')) {
  openNameModal();
}

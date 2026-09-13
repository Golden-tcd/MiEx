// ---------- State ----------
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let activeFilter = 'All';
let activePeriod = 'all';   // 'all' | 'week' | 'month' | 'year' | 'custom'
let periodValue = null;     // week: 'YYYY-MM-DD' (week start) | month: 'YYYY-MM' | year: 'YYYY'
let customFrom = null;
let customTo = null;
let chart;
let trendChart;
let pendingDeleteId = null;

// ---------- DOM Elements ----------
const form = document.getElementById('expenseForm');
const nameInput = document.getElementById('name');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const customCategoryInput = document.getElementById('customCategory');
const dateInput = document.getElementById('date');
const MAIN_CATEGORIES = ['Feeding', 'Clothing', 'Transportation', 'Bills'];

const expenseList = document.getElementById('expenseList');
const balanceEl = document.getElementById('balance');
const filters = document.getElementById('filters');
const periodTabs = document.getElementById('periodTabs');
const periodValueSelect = document.getElementById('periodValueSelect');
const customRangeEl = document.getElementById('customRange');
const customFromInput = document.getElementById('customFrom');
const customToInput = document.getElementById('customTo');
const balanceLabel = document.getElementById('balanceLabel');
const darkModeToggle = document.getElementById('darkModeToggle');
const footerYear = document.getElementById('footerYear');
const confirmModal = document.getElementById('confirmModal');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');

footerYear.textContent = new Date().getFullYear();

categoryInput.addEventListener('change', () => {
  if (categoryInput.value === 'Others') {
    customCategoryInput.style.display = 'block';
    customCategoryInput.required = true;
  } else {
    customCategoryInput.style.display = 'none';
    customCategoryInput.required = false;
    customCategoryInput.value = '';
  }
});

// Default date to today
dateInput.valueAsDate = new Date();

// ---------- Save to localStorage ----------
function saveExpenses() {
  localStorage.setItem('expenses', JSON.stringify(expenses));
}

// ---------- Date helpers ----------
function pad(n) {
  return n.toString().padStart(2, '0');
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function weekKey(date) {
  const s = weekStart(date);
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
}

function weekLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const thisWeekKey = weekKey(new Date());
  const lastWeekRef = new Date();
  lastWeekRef.setDate(lastWeekRef.getDate() - 7);
  const lastWeekKey = weekKey(lastWeekRef);

  if (key === thisWeekKey) return 'This Week';
  if (key === lastWeekKey) return 'Last Week';

  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

// ---------- Option builders ----------
function getMonthOptions() {
  const now = new Date();
  const keys = new Set();
  for (let i = 0; i < 12; i++) {
    keys.add(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  expenses.forEach(e => keys.add(monthKey(new Date(e.date + 'T00:00:00'))));
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
  expenses.forEach(e => keys.add(weekKey(new Date(e.date + 'T00:00:00'))));
  return Array.from(keys).sort().reverse();
}

function getYearOptions() {
  const now = new Date();
  const keys = new Set([String(now.getFullYear())]);
  expenses.forEach(e => keys.add(String(new Date(e.date + 'T00:00:00').getFullYear())));
  return Array.from(keys).sort().reverse();
}

// ---------- Period value dropdown ----------
function refreshPeriodOptions(resetToDefault) {
  if (activePeriod === 'all' || activePeriod === 'custom') {
    periodValueSelect.style.display = 'none';
    periodValueSelect.innerHTML = '';
    periodValue = null;
    return;
  }

  let options;
  if (activePeriod === 'month') {
    options = getMonthOptions().map(k => ({ value: k, label: monthLabel(k) }));
  } else if (activePeriod === 'week') {
    options = getWeekOptions().map(k => ({ value: k, label: weekLabel(k) }));
  } else {
    options = getYearOptions().map(k => ({ value: k, label: k }));
  }

  periodValueSelect.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  periodValueSelect.style.display = 'block';

  const stillValid = options.some(o => o.value === periodValue);
  if (resetToDefault || !stillValid) {
    periodValue = options.length ? options[0].value : null;
  }
  periodValueSelect.value = periodValue;
}

// ---------- Period Filtering ----------
function isInActivePeriod(dateStr) {
  if (activePeriod === 'all') return true;

  if (activePeriod === 'custom') {
    if (!customFrom || !customTo) return true;
    return dateStr >= customFrom && dateStr <= customTo;
  }

  const d = new Date(dateStr + 'T00:00:00');

  if (activePeriod === 'year') return String(d.getFullYear()) === periodValue;
  if (activePeriod === 'month') return monthKey(d) === periodValue;
  if (activePeriod === 'week') return weekKey(d) === periodValue;

  return true;
}

function getPeriodExpenses() {
  return expenses.filter(e => isInActivePeriod(e.date));
}

function formatDateNice(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function currentPeriodLabel() {
  if (activePeriod === 'all') return 'Total Expenses';
  if (activePeriod === 'custom') {
    if (!customFrom || !customTo) return 'Total Expenses (Custom Range)';
    return `Total Expenses (${formatDateNice(customFrom)} – ${formatDateNice(customTo)})`;
  }
  let valLabel = '';
  if (activePeriod === 'month') valLabel = monthLabel(periodValue);
  else if (activePeriod === 'week') valLabel = weekLabel(periodValue);
  else if (activePeriod === 'year') valLabel = periodValue;
  return `Total Expenses (${valLabel})`;
}

// ---------- Render Balance ----------
function renderBalance() {
  const periodExpenses = getPeriodExpenses();
  const total = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  balanceEl.textContent = `₦${total.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  balanceLabel.textContent = currentPeriodLabel();
}

// ---------- Render Expense List ----------
function renderList() {
  expenseList.innerHTML = '';

  const periodExpenses = getPeriodExpenses();

  let filtered;
  if (activeFilter === 'All') {
    filtered = periodExpenses;
  } else if (activeFilter === 'Others') {
    filtered = periodExpenses.filter(e => !MAIN_CATEGORIES.includes(e.category));
  } else {
    filtered = periodExpenses.filter(e => e.category === activeFilter);
  }

  if (filtered.length === 0) {
    expenseList.innerHTML = `<p style="color: var(--muted); text-align:center; padding: 20px 0;">No expenses in this period.</p>`;
    return;
  }

  [...filtered].reverse().forEach(expense => {
    const li = document.createElement('li');
    li.className = 'expense-item';
    li.innerHTML = `
      <div class="expense-info">
        <span class="expense-name">${expense.name}</span>
        <span class="expense-meta">${expense.date}</span>
        <span class="category-tag">${expense.category}</span>
      </div>
      <div class="expense-right">
        <span class="expense-amount">₦${expense.amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <button class="delete-btn" data-id="${expense.id}" title="Delete">✕</button>
      </div>
    `;
    expenseList.appendChild(li);
  });
}

// ---------- Render Chart ----------
function renderChart() {
  const periodExpenses = getPeriodExpenses();
  const categories = ['Feeding', 'Clothing', 'Transportation', 'Bills', 'Others'];
  const totals = categories.map(cat => {
    if (cat === 'Others') {
      return periodExpenses
        .filter(e => !MAIN_CATEGORIES.includes(e.category))
        .reduce((sum, e) => sum + e.amount, 0);
    }
    return periodExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
  });

  const ctx = document.getElementById('categoryChart').getContext('2d');

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: totals,
        backgroundColor: ['#1E2A3A', '#7FB069', '#5C7A99', '#D9A566', '#FF6B6B'],
        borderWidth: 2,
        borderColor: document.body.classList.contains('dark') ? '#10131a' : '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } }
      }
    }
  });
}

// ---------- Render Trend Chart ----------
function renderTrendChart() {
  const now = new Date();
  const monthKeys = [];
  for (let i = 5; i >= 0; i--) {
    monthKeys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }

  const labels = monthKeys.map(k => {
    const [y, m] = k.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' });
  });

  const totals = monthKeys.map(k =>
    expenses.filter(e => monthKey(new Date(e.date + 'T00:00:00')) === k)
      .reduce((sum, e) => sum + e.amount, 0)
  );

  const isDark = document.body.classList.contains('dark');
  const barColor = isDark ? '#7FB069' : '#1E2A3A';

  const ctx = document.getElementById('trendChart').getContext('2d');

  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: totals,
        backgroundColor: barColor,
        borderRadius: 6,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `₦${ctx.parsed.y.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => '₦' + v.toLocaleString() }
        }
      }
    }
  });
}

// ---------- Render All ----------
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
  renderTrendChart();
}

// ---------- Add Expense ----------
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const chosenCategory = categoryInput.value === 'Others' && customCategoryInput.value.trim()
    ? customCategoryInput.value.trim()
    : categoryInput.value;

  const newExpense = {
    id: Date.now(),
    name: nameInput.value.trim(),
    amount: parseFloat(amountInput.value),
    category: chosenCategory,
    date: dateInput.value
  };

  expenses.push(newExpense);
  saveExpenses();
  refreshPeriodOptions(false);
  renderAll();

  form.reset();
  dateInput.valueAsDate = new Date();
  customCategoryInput.style.display = 'none';
  customCategoryInput.required = false;
});

// ---------- Delete Expense (with confirm) ----------
expenseList.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    pendingDeleteId = Number(e.target.dataset.id);
    confirmModal.style.display = 'flex';
  }
});

cancelDeleteBtn.addEventListener('click', () => {
  pendingDeleteId = null;
  confirmModal.style.display = 'none';
});

confirmDeleteBtn.addEventListener('click', () => {
  if (pendingDeleteId !== null) {
    expenses = expenses.filter(exp => exp.id !== pendingDeleteId);
    saveExpenses();
    refreshPeriodOptions(false);
    renderAll();
  }
  pendingDeleteId = null;
  confirmModal.style.display = 'none';
});

confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) {
    pendingDeleteId = null;
    confirmModal.style.display = 'none';
  }
});

// ---------- Category Filter ----------
filters.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-btn')) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    activeFilter = e.target.dataset.category;
    renderList();
  }
});

// ---------- Period Tabs ----------
periodTabs.addEventListener('click', (e) => {
  if (e.target.classList.contains('period-btn')) {
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    activePeriod = e.target.dataset.period;

    if (activePeriod === 'custom') {
      customRangeEl.style.display = 'flex';
      if (!customFrom || !customTo) {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 29);
        customTo = today.toISOString().slice(0, 10);
        customFrom = past.toISOString().slice(0, 10);
        customFromInput.value = customFrom;
        customToInput.value = customTo;
      }
    } else {
      customRangeEl.style.display = 'none';
    }

    refreshPeriodOptions(true);
    renderAll();
  }
});

// ---------- Custom Range ----------
function handleCustomRangeChange() {
  if (customFromInput.value) customFrom = customFromInput.value;
  if (customToInput.value) customTo = customToInput.value;
  if (customFrom && customTo && customFrom > customTo) {
    // keep range valid — swap if user picks them backwards
    [customFrom, customTo] = [customTo, customFrom];
    customFromInput.value = customFrom;
    customToInput.value = customTo;
  }
  renderAll();
}

customFromInput.addEventListener('change', handleCustomRangeChange);
customToInput.addEventListener('change', handleCustomRangeChange);

// ---------- Period Value Dropdown ----------
periodValueSelect.addEventListener('change', () => {
  periodValue = periodValueSelect.value;
  renderAll();
});

// ---------- Dark Mode ----------
darkModeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  darkModeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  localStorage.setItem('darkMode', document.body.classList.contains('dark'));
  renderChart(); // refresh chart border color to match theme
  renderTrendChart(); // refresh bar color to match theme
});

// Load dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark');
  darkModeToggle.textContent = '☀️';
}

// ---------- Init ----------
renderAll();

// ---------- PWA: Register Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

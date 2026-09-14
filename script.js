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
let searchQuery = '';
let monthlyBudget = localStorage.getItem('monthlyBudget') ? parseFloat(localStorage.getItem('monthlyBudget')) : null;
let editingExpenseId = null;

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
const greetingText = document.getElementById('greetingText');
const insightBanner = document.getElementById('insightBanner');
const insightText = document.getElementById('insightText');
const insightDismissBtn = document.getElementById('insightDismiss');
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
let balanceHidden = localStorage.getItem('balanceHidden') === 'true';
toggleVisibilityBtn.textContent = balanceHidden ? '🙈' : '👁️';
const confirmModal = document.getElementById('confirmModal');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const avatarEl = document.getElementById('avatar');
const nameModal = document.getElementById('nameModal');
const userNameInput = document.getElementById('userNameInput');
const saveNameBtn = document.getElementById('saveName');

const searchInput = document.getElementById('searchInput');

const budgetContent = document.getElementById('budgetContent');
const editBudgetBtn = document.getElementById('editBudgetBtn');
const budgetModal = document.getElementById('budgetModal');
const budgetInput = document.getElementById('budgetInput');
const saveBudgetBtn = document.getElementById('saveBudget');
const clearBudgetBtn = document.getElementById('clearBudget');

const editModal = document.getElementById('editModal');
const editNameInput = document.getElementById('editName');
const editAmountInput = document.getElementById('editAmount');
const editCategoryInput = document.getElementById('editCategory');
const editCustomCategoryInput = document.getElementById('editCustomCategory');
const editDateInput = document.getElementById('editDate');
const cancelEditBtn = document.getElementById('cancelEdit');
const saveEditBtn = document.getElementById('saveEdit');

footerYear.textContent = new Date().getFullYear();

// ---------- User Name ----------
function getUserName() {
  return localStorage.getItem('userName') || '';
}

function openNameModal() {
  userNameInput.value = getUserName();
  nameModal.style.display = 'flex';
  userNameInput.focus();
}

function saveUserName() {
  const val = userNameInput.value.trim();
  if (val) {
    localStorage.setItem('userName', val);
    nameModal.style.display = 'none';
    setGreeting();
    updateAvatar();
  }
}

avatarEl.addEventListener('click', openNameModal);
saveNameBtn.addEventListener('click', saveUserName);
userNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveUserName();
});
nameModal.addEventListener('click', (e) => {
  // Only allow closing without a name if one is already saved
  if (e.target === nameModal && getUserName()) {
    nameModal.style.display = 'none';
  }
});

function updateAvatar() {
  const name = getUserName();
  avatarEl.textContent = name ? name.charAt(0).toUpperCase() : '?';
}

// ---------- Greeting ----------
function setGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  const name = getUserName();
  greetingText.textContent = name ? `${greeting}, ${name} 👋` : `${greeting} 👋`;
}

setGreeting();
updateAvatar();

// Prompt for a name on first visit
if (!getUserName()) {
  openNameModal();
}

// ---------- Balance Visibility Toggle ----------
toggleVisibilityBtn.addEventListener('click', () => {
  balanceHidden = !balanceHidden;
  localStorage.setItem('balanceHidden', balanceHidden);
  toggleVisibilityBtn.textContent = balanceHidden ? '🙈' : '👁️';
  renderBalance();
});

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

editCategoryInput.addEventListener('change', () => {
  if (editCategoryInput.value === 'Others') {
    editCustomCategoryInput.style.display = 'block';
  } else {
    editCustomCategoryInput.style.display = 'none';
    editCustomCategoryInput.value = '';
  }
});

// ---------- Search ----------
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderList();
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
  if (activePeriod === 'all') return 'Total Spent';
  if (activePeriod === 'custom') {
    if (!customFrom || !customTo) return 'Total Spent (Custom Range)';
    return `Total Spent (${formatDateNice(customFrom)} – ${formatDateNice(customTo)})`;
  }
  let valLabel = '';
  if (activePeriod === 'month') valLabel = monthLabel(periodValue);
  else if (activePeriod === 'week') valLabel = weekLabel(periodValue);
  else if (activePeriod === 'year') valLabel = periodValue;
  return `Total Spent (${valLabel})`;
}

// ---------- Render Balance ----------
function renderBalance() {
  const periodExpenses = getPeriodExpenses();
  const total = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  balanceEl.textContent = balanceHidden
    ? '₦ ••••••'
    : `₦${total.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  if (searchQuery) {
    filtered = filtered.filter(e => e.name.toLowerCase().includes(searchQuery));
  }

  if (filtered.length === 0) {
    const message = searchQuery ? 'No expenses match your search.' : 'No expenses in this period.';
    expenseList.innerHTML = `<p style="color: var(--muted); text-align:center; padding: 20px 0;">${message}</p>`;
    return;
  }

  [...filtered].reverse().forEach(expense => {
    const li = document.createElement('li');
    li.className = 'expense-item';
    li.dataset.id = expense.id;
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

  const grandTotal = totals.reduce((sum, v) => sum + v, 0);
  const isDark = document.body.classList.contains('dark');
  const catColors = isDark
    ? ['#F2967F', '#BBA3F0', '#79D2D9', '#F6D06A', '#9089B0']
    : ['#F0836C', '#A98FE0', '#5FBFC7', '#F6C453', '#B9B2C4'];

  const ctx = document.getElementById('categoryChart').getContext('2d');

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: totals,
        backgroundColor: catColors,
        borderWidth: 3,
        borderColor: isDark ? '#161616' : '#FFFFFF',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            color: isDark ? '#F0EBE3' : '#2E2418',
            generateLabels: (chartInstance) => {
              const data = chartInstance.data;
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const pct = grandTotal > 0 ? Math.round((value / grandTotal) * 100) : 0;
                return {
                  text: `${label}  ${pct}%`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].backgroundColor[i],
                  index: i
                };
              });
            }
          }
        }
      }
    },
    plugins: [{
      id: 'centerText',
      afterDraw: (chartInstance) => {
        const { ctx, chartArea } = chartInstance;
        if (!chartArea) return;
        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isDark ? '#F0EBE3' : '#2E2418';
        ctx.font = '700 14px Quicksand, sans-serif';
        ctx.fillText(`₦${grandTotal.toLocaleString('en-NG')}`, x, y - 6);
        ctx.font = '600 11px Nunito, sans-serif';
        ctx.fillStyle = isDark ? '#9C9690' : '#8C7C6B';
        ctx.fillText('Total Spent', x, y + 12);
        ctx.restore();
      }
    }]
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
  const barColor = isDark ? '#FF9D45' : '#F68B1E';

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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `₦${ctx.parsed.y.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: isDark ? '#9C9690' : '#8C7C6B', font: { family: 'Nunito' } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: isDark ? '#9C9690' : '#8C7C6B',
            font: { family: 'Nunito' },
            callback: (v) => '₦' + v.toLocaleString()
          },
          grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(46,36,24,0.06)' }
        }
      }
    }
  });
}

// ---------- Insight Banner ----------
const INSIGHT_DISMISS_DURATION = 4 * 60 * 60 * 1000; // 4 hours

function isInsightDismissed() {
  const dismissedAt = sessionStorage.getItem('insightDismissedAt');
  if (!dismissedAt) return false;
  return (Date.now() - parseInt(dismissedAt, 10)) < INSIGHT_DISMISS_DURATION;
}

function renderInsight() {
  const now = new Date();
  const thisMonthKey = monthKey(now);
  const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const thisMonthTotal = expenses
    .filter(e => monthKey(new Date(e.date + 'T00:00:00')) === thisMonthKey)
    .reduce((sum, e) => sum + e.amount, 0);

  const lastMonthTotal = expenses
    .filter(e => monthKey(new Date(e.date + 'T00:00:00')) === lastMonthKey)
    .reduce((sum, e) => sum + e.amount, 0);

  if (lastMonthTotal === 0 || isInsightDismissed()) {
    insightBanner.style.display = 'none';
    return;
  }

  const diff = lastMonthTotal - thisMonthTotal;
  const diffAbs = Math.abs(diff).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  insightBanner.style.display = 'flex';
  if (diff >= 0) {
    insightBanner.classList.remove('warn');
    insightBanner.querySelector('.insight-icon').textContent = '🌿';
    insightText.textContent = `You're ₦${diffAbs} below last month's spending.`;
  } else {
    insightBanner.classList.add('warn');
    insightBanner.querySelector('.insight-icon').textContent = '⚠️';
    insightText.textContent = `You're ₦${diffAbs} above last month's spending.`;
  }
}

insightDismissBtn.addEventListener('click', () => {
  sessionStorage.setItem('insightDismissedAt', Date.now().toString());
  insightBanner.style.display = 'none';
});

// ---------- Budget ----------
function renderBudget() {
  const now = new Date();
  const thisMonthKey = monthKey(now);
  const spent = expenses
    .filter(e => monthKey(new Date(e.date + 'T00:00:00')) === thisMonthKey)
    .reduce((sum, e) => sum + e.amount, 0);

  if (monthlyBudget === null || isNaN(monthlyBudget)) {
    budgetContent.innerHTML = `<p class="budget-empty-text">Set a monthly budget to track your spending goals.</p>`;
    return;
  }

  const pct = Math.min(100, Math.round((spent / monthlyBudget) * 100));
  let stateClass = '';
  if (spent >= monthlyBudget) stateClass = 'danger';
  else if (pct >= 80) stateClass = 'warn';

  const spentStr = spent.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const budgetStr = monthlyBudget.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let alertHtml = '';
  if (spent >= monthlyBudget) {
    const over = (spent - monthlyBudget).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    alertHtml = `<p class="budget-alert danger">You've exceeded your monthly budget by ₦${over}.</p>`;
  } else if (pct >= 80) {
    alertHtml = `<p class="budget-alert warn">You've used ${pct}% of your monthly budget.</p>`;
  }

  budgetContent.innerHTML = `
    <div class="budget-stats">
      <span>₦${spentStr} spent</span>
      <span>of ₦${budgetStr}</span>
    </div>
    <div class="budget-progress-track">
      <div class="budget-progress-fill ${stateClass}" style="width:${pct}%"></div>
    </div>
    ${alertHtml}
  `;
}

editBudgetBtn.addEventListener('click', () => {
  budgetInput.value = monthlyBudget !== null ? monthlyBudget : '';
  budgetModal.style.display = 'flex';
  budgetInput.focus();
});

saveBudgetBtn.addEventListener('click', () => {
  const val = parseFloat(budgetInput.value);
  if (!isNaN(val) && val > 0) {
    monthlyBudget = val;
    localStorage.setItem('monthlyBudget', val);
    budgetModal.style.display = 'none';
    renderBudget();
  }
});

clearBudgetBtn.addEventListener('click', () => {
  monthlyBudget = null;
  localStorage.removeItem('monthlyBudget');
  budgetModal.style.display = 'none';
  renderBudget();
});

budgetModal.addEventListener('click', (e) => {
  if (e.target === budgetModal) {
    budgetModal.style.display = 'none';
  }
});

// ---------- Render All ----------
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
  renderTrendChart();
  renderInsight();
  renderBudget();
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
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    pendingDeleteId = Number(deleteBtn.dataset.id);
    confirmModal.style.display = 'flex';
    return;
  }

  const item = e.target.closest('.expense-item');
  if (item) {
    openEditModal(Number(item.dataset.id));
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

// ---------- Edit Expense ----------
function openEditModal(id) {
  const expense = expenses.find(exp => exp.id === id);
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

  editModal.style.display = 'flex';
}

function closeEditModal() {
  editingExpenseId = null;
  editModal.style.display = 'none';
}

cancelEditBtn.addEventListener('click', closeEditModal);

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

saveEditBtn.addEventListener('click', () => {
  if (editingExpenseId === null) return;
  const expense = expenses.find(exp => exp.id === editingExpenseId);
  if (!expense) return;

  const chosenCategory = editCategoryInput.value === 'Others' && editCustomCategoryInput.value.trim()
    ? editCustomCategoryInput.value.trim()
    : editCategoryInput.value;

  expense.name = editNameInput.value.trim();
  expense.amount = parseFloat(editAmountInput.value);
  expense.category = chosenCategory;
  expense.date = editDateInput.value;

  saveExpenses();
  refreshPeriodOptions(false);
  renderAll();
  closeEditModal();
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

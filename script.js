// ---------- State ----------
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let activeFilter = 'All';
let activePeriod = 'all';
let chart;

// ---------- DOM Elements ----------
const form = document.getElementById('expenseForm');
const nameInput = document.getElementById('name');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const customCategoryInput = document.getElementById('customCategory');
const dateInput = document.getElementById('date');
const MAIN_CATEGORIES = ['Feeding', 'Clothing', 'Transportation', 'Bills'];

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
const expenseList = document.getElementById('expenseList');
const balanceEl = document.getElementById('balance');
const filters = document.getElementById('filters');
const periodTabs = document.getElementById('periodTabs');
const balanceLabel = document.getElementById('balanceLabel');
const darkModeToggle = document.getElementById('darkModeToggle');

// Default date to today
dateInput.valueAsDate = new Date();

// ---------- Save to localStorage ----------
function saveExpenses() {
  localStorage.setItem('expenses', JSON.stringify(expenses));
}

// ---------- Period Filtering ----------
function isInActivePeriod(dateStr) {
  if (activePeriod === 'all') return true;

  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();

  if (activePeriod === 'year') {
    return d.getFullYear() === now.getFullYear();
  }

  if (activePeriod === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  if (activePeriod === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return d >= startOfWeek && d <= endOfWeek;
  }

  return true;
}

function getPeriodExpenses() {
  return expenses.filter(e => isInActivePeriod(e.date));
}

const PERIOD_LABELS = {
  all: 'Total Expenses',
  week: 'Total Expenses (This Week)',
  month: 'Total Expenses (This Month)',
  year: 'Total Expenses (This Year)'
};

// ---------- Render Balance ----------
function renderBalance() {
  const periodExpenses = getPeriodExpenses();
  const total = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  balanceEl.textContent = `₦${total.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  balanceLabel.textContent = PERIOD_LABELS[activePeriod];
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
    expenseList.innerHTML = `<p style="color: var(--muted); text-align:center; padding: 20px 0;">No expenses yet.</p>`;
    return;
  }

  // Show most recent first
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

// ---------- Render All ----------
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
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
  renderAll();

  form.reset();
  dateInput.valueAsDate = new Date();
  customCategoryInput.style.display = 'none';
  customCategoryInput.required = false;
});

// ---------- Delete Expense ----------
expenseList.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const id = Number(e.target.dataset.id);
    expenses = expenses.filter(exp => exp.id !== id);
    saveExpenses();
    renderAll();
  }
});

// ---------- Filter ----------
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
    renderAll();
  }
});

// ---------- Dark Mode ----------
darkModeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  darkModeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  localStorage.setItem('darkMode', document.body.classList.contains('dark'));
});

// Load dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark');
  darkModeToggle.textContent = '☀️';
}

// ---------- Init ----------
renderAll();

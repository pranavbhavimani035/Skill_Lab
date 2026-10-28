import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api/expenses';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Utilities', 'General'];

const CATEGORY_COLORS = {
  Food: '#f59e0b',
  Transport: '#3b82f6',
  Entertainment: '#a78bfa',
  Utilities: '#34d399',
  General: '#f87171',
};

const CATEGORY_ICONS = {
  Food: '🍔',
  Transport: '🚗',
  Entertainment: '🎬',
  Utilities: '⚡',
  General: '🛒',
};

const EMPTY_FORM = { title: '', amount: '', category: 'Food' };

// ─── Utility Helpers ──────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n);

const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtDateShort = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const badgeClass = (cat) => `badge badge-${cat.toLowerCase()}`;

const catDotStyle = (cat) => ({
  backgroundColor: CATEGORY_COLORS[cat] || '#64748b',
});

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Custom tooltip rendered inside the Recharts PieChart */
const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    return (
      <div
        style={{
          background: '#1e1e2a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '0.8125rem',
        }}
      >
        <p style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 2 }}>
          {CATEGORY_ICONS[name]} {name}
        </p>
        <p style={{ color: CATEGORY_COLORS[name] || '#94a3b8', fontWeight: 700 }}>
          {fmt(value)}
        </p>
      </div>
    );
  }
  return null;
};

/** Custom Legend renderer */
const CustomLegend = ({ payload }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: '8px 16px',
      marginTop: 12,
    }}
  >
    {payload.map((entry) => (
      <div
        key={entry.value}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.75rem',
          color: '#94a3b8',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: entry.color,
          }}
        />
        {entry.value}
      </div>
    ))}
  </div>
);

/** Toast notification element */
const Toast = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map((t) => (
      <div key={t.id} className={`toast toast-${t.type}`}>
        <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>{t.message}</span>
      </div>
    ))}
  </div>
);

// ─── Main App Component ───────────────────────────────────────────────────────
export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'history'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [toasts, setToasts] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // ── Fetch all expenses ─────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(API_BASE);
      setExpenses(data);
    } catch {
      addToast('Failed to load expenses. Is the server running?', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // ── Computed Stats (useMemo) ───────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!expenses.length) return { total: 0, daily: 0, monthly: 0, count: 0 };

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const count = expenses.length;

    const dates = expenses.map((e) => new Date(e.createdAt).getTime());
    const earliest = Math.min(...dates);
    const latest = Math.max(...dates);

    const daySpan = Math.max(
      1,
      Math.round((latest - earliest) / (1000 * 60 * 60 * 24))
    );
    const monthSpan = Math.max(1, daySpan / 30);

    return {
      total,
      daily: total / daySpan,
      monthly: total / monthSpan,
      count,
    };
  }, [expenses]);

  // ── Pie Chart Data (useMemo) ───────────────────────────────────────────────
  const pieData = useMemo(() => {
    const agg = {};
    expenses.forEach((e) => {
      agg[e.category] = (agg[e.category] || 0) + e.amount;
    });
    return Object.entries(agg)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // ── Filtered Expenses (useMemo) ────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    if (categoryFilter === 'All') return expenses;
    return expenses.filter((e) => e.category === categoryFilter);
  }, [expenses, categoryFilter]);

  // ── Recent 5 ──────────────────────────────────────────────────────────────
  const recentFive = useMemo(() => expenses.slice(0, 5), [expenses]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleEdit = (expense) => {
    setForm({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
    });
    setEditingId(expense._id);
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      addToast('Title cannot be empty.', 'error');
      return;
    }
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast('Amount must be a positive number.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { title: trimmedTitle, amount: parsedAmount, category: form.category };

      if (editingId) {
        const { data } = await axios.put(`${API_BASE}/${editingId}`, payload);
        setExpenses((prev) =>
          prev.map((e) => (e._id === editingId ? data : e))
        );
        addToast(`"${data.title}" updated successfully!`, 'success');
      } else {
        const { data } = await axios.post(API_BASE, payload);
        setExpenses((prev) => [data, ...prev]);
        addToast(`"${data.title}" added!`, 'success');
      }
      resetForm();
    } catch (err) {
      const msg =
        err.response?.data?.errors?.join(', ') ||
        err.response?.data?.message ||
        'Something went wrong.';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await axios.delete(`${API_BASE}/${id}`);
      setExpenses((prev) => prev.filter((e) => e._id !== id));
      if (editingId === id) resetForm();
      addToast(`"${title}" deleted.`, 'info');
    } catch {
      addToast('Failed to delete expense.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper">
      <Toast toasts={toasts} />

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-icon">💸</div>
          <div>
            <div className="header-title">Expense Tracker</div>
            <div className="header-subtitle">Personal Finance Dashboard</div>
          </div>
        </div>

        <nav className="header-nav" aria-label="Main Navigation">
          <button
            id="nav-dashboard"
            className={`nav-btn${view === 'dashboard' ? ' active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            id="nav-history"
            className={`nav-btn${view === 'history' ? ' active' : ''}`}
            onClick={() => setView('history')}
          >
            ☰ Full History
          </button>
        </nav>
      </header>

      {/* ── Main ── */}
      <main className="main-content">
        {/* ── Stats Cards ── */}
        <section className="stats-grid" aria-label="Summary Statistics">
          <div
            className="stat-card"
            style={{ '--card-accent': 'linear-gradient(90deg, #6366f1, #a78bfa)' }}
          >
            <div className="stat-icon" style={{ '--icon-bg': 'rgba(99,102,241,0.15)' }}>
              💰
            </div>
            <div className="stat-label">Total Spent</div>
            <div className="stat-value">{fmt(stats.total)}</div>
            <div className="stat-sub">{stats.count} transaction{stats.count !== 1 ? 's' : ''}</div>
          </div>

          <div
            className="stat-card"
            style={{ '--card-accent': 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
          >
            <div className="stat-icon" style={{ '--icon-bg': 'rgba(245,158,11,0.15)' }}>
              📅
            </div>
            <div className="stat-label">Daily Average</div>
            <div className="stat-value">{fmt(stats.daily)}</div>
            <div className="stat-sub">per day</div>
          </div>

          <div
            className="stat-card"
            style={{ '--card-accent': 'linear-gradient(90deg, #34d399, #10b981)' }}
          >
            <div className="stat-icon" style={{ '--icon-bg': 'rgba(52,211,153,0.15)' }}>
              📆
            </div>
            <div className="stat-label">Monthly Average</div>
            <div className="stat-value">{fmt(stats.monthly)}</div>
            <div className="stat-sub">per month</div>
          </div>

          <div
            className="stat-card"
            style={{ '--card-accent': 'linear-gradient(90deg, #f87171, #ef4444)' }}
          >
            <div className="stat-icon" style={{ '--icon-bg': 'rgba(248,113,113,0.15)' }}>
              🏷️
            </div>
            <div className="stat-label">Top Category</div>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>
              {pieData[0]
                ? `${CATEGORY_ICONS[pieData[0].name]} ${pieData[0].name}`
                : '—'}
            </div>
            <div className="stat-sub">
              {pieData[0] ? fmt(pieData[0].value) : 'No data yet'}
            </div>
          </div>
        </section>

        {/* ── Dashboard View ── */}
        {view === 'dashboard' && (
          <section className="dashboard-grid">
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Add / Edit Form */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <span className="card-title-icon">
                      {editingId ? '✏️' : '➕'}
                    </span>
                    {editingId ? 'Edit Expense' : 'Add New Expense'}
                  </h2>
                  {editingId && (
                    <button
                      id="btn-cancel-edit"
                      className="btn btn-secondary btn-sm"
                      onClick={resetForm}
                    >
                      ✕ Cancel
                    </button>
                  )}
                </div>
                <div className="card-body">
                  <form id="expense-form" onSubmit={handleSubmit} className="form-stack" noValidate>
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-title">
                        Item Title
                      </label>
                      <input
                        id="input-title"
                        className="form-input"
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleFormChange}
                        placeholder="e.g. Morning Coffee"
                        maxLength={100}
                        required
                        autoComplete="off"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="input-amount">
                        Amount (₹)
                      </label>
                      <input
                        id="input-amount"
                        className="form-input"
                        type="number"
                        name="amount"
                        value={form.amount}
                        onChange={handleFormChange}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="input-category">
                        Category
                      </label>
                      <select
                        id="input-category"
                        className="form-select"
                        name="category"
                        value={form.category}
                        onChange={handleFormChange}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {CATEGORY_ICONS[cat]} {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-actions">
                      <button
                        id="btn-submit-expense"
                        type="submit"
                        className={`btn btn-primary${editingId ? ' editing' : ''}`}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <span className="spinner" />
                            {editingId ? 'Saving…' : 'Adding…'}
                          </>
                        ) : editingId ? (
                          '💾 Save Changes'
                        ) : (
                          '➕ Add Expense'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Recent History */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <span className="card-title-icon">🕒</span>
                    Recent Transactions
                  </h2>
                  <span
                    style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}
                  >
                    Last 5
                  </span>
                </div>
                <div className="card-body" style={{ padding: '8px 0' }}>
                  {loading ? (
                    <div className="loading-overlay">
                      <span className="spinner" />
                      Loading…
                    </div>
                  ) : recentFive.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-state-icon">🧾</span>
                      <p className="empty-state-text">No expenses yet</p>
                      <p className="empty-state-sub">Add your first expense above</p>
                    </div>
                  ) : (
                    <div className="recent-list">
                      {recentFive.map((exp) => (
                        <div key={exp._id} className="recent-item">
                          <div className="recent-item-left">
                            <div
                              className="recent-cat-dot"
                              style={catDotStyle(exp.category)}
                            />
                            <div className="recent-item-info">
                              <div className="recent-item-title">{exp.title}</div>
                              <div className="recent-item-meta">
                                {CATEGORY_ICONS[exp.category]} {exp.category} ·{' '}
                                {fmtDateShort(exp.createdAt)}
                              </div>
                            </div>
                          </div>
                          <div className="recent-item-right">
                            <div className="recent-item-amount">{fmt(exp.amount)}</div>
                            <div className="recent-actions">
                              <button
                                id={`btn-edit-recent-${exp._id}`}
                                className="btn btn-ghost btn-ghost-edit btn-icon"
                                onClick={() => handleEdit(exp)}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                id={`btn-delete-recent-${exp._id}`}
                                className="btn btn-ghost btn-ghost-delete btn-icon"
                                onClick={() => handleDelete(exp._id, exp.title)}
                                disabled={deletingId === exp._id}
                                title="Delete"
                              >
                                {deletingId === exp._id ? (
                                  <span className="spinner" style={{ width: 12, height: 12 }} />
                                ) : (
                                  '🗑️'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column – Chart */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <span className="card-title-icon">🥧</span>
                  Spending by Category
                </h2>
                {pieData.length > 0 && (
                  <span
                    style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}
                  >
                    {pieData.length} categor{pieData.length > 1 ? 'ies' : 'y'}
                  </span>
                )}
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="loading-overlay" style={{ height: 300 }}>
                    <span className="spinner" />
                    Loading chart…
                  </div>
                ) : pieData.length === 0 ? (
                  <div className="chart-empty">
                    <span className="chart-empty-icon">📊</span>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      No data to display
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={75}
                            outerRadius={120}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={CATEGORY_COLORS[entry.name] || '#64748b'}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                          <Legend content={<CustomLegend />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Category Breakdown list */}
                    <div className="divider" />
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      {pieData.map((item) => {
                        const pct = stats.total
                          ? ((item.value / stats.total) * 100).toFixed(1)
                          : 0;
                        return (
                          <div
                            key={item.name}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                            }}
                          >
                            <span style={{ fontSize: '1rem' }}>
                              {CATEGORY_ICONS[item.name]}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.8rem',
                                  marginBottom: 4,
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                <span>{item.name}</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                  {fmt(item.value)}
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 4,
                                  background: 'var(--color-surface-3)',
                                  borderRadius: 4,
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${pct}%`,
                                    background: CATEGORY_COLORS[item.name],
                                    borderRadius: 4,
                                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                  }}
                                />
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                minWidth: 36,
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Full History View ── */}
        {view === 'history' && (
          <section aria-label="Full Expense History">
            <div className="history-controls">
              <div className="history-controls-left">
                <select
                  id="filter-category"
                  className="filter-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="All">🗂 All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </option>
                  ))}
                </select>
                <span className="result-count">
                  {filteredExpenses.length} result{filteredExpenses.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {categoryFilter !== 'All' && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Total:{' '}
                    <strong style={{ color: 'var(--color-text-primary)' }}>
                      {fmt(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
                    </strong>
                  </span>
                )}
                <button
                  id="btn-clear-filter"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCategoryFilter('All')}
                  style={{ display: categoryFilter === 'All' ? 'none' : 'inline-flex' }}
                >
                  ✕ Clear
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading-overlay">
                <span className="spinner" />
                Loading expenses…
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div
                className="card"
                style={{ textAlign: 'center', padding: '60px 24px' }}
              >
                <div className="empty-state">
                  <span className="empty-state-icon">🔍</span>
                  <p className="empty-state-text">No expenses found</p>
                  <p className="empty-state-sub">
                    {categoryFilter !== 'All'
                      ? `No "${categoryFilter}" expenses recorded.`
                      : 'Start by adding your first expense on the dashboard.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="expense-table" id="expense-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((exp) => (
                      <tr key={exp._id}>
                        <td className="td-date">{fmtDate(exp.createdAt)}</td>
                        <td className="td-title">{exp.title}</td>
                        <td>
                          <span className={badgeClass(exp.category)}>
                            {CATEGORY_ICONS[exp.category]} {exp.category}
                          </span>
                        </td>
                        <td className="td-amount">{fmt(exp.amount)}</td>
                        <td className="td-actions">
                          <div className="action-group">
                            <button
                              id={`btn-edit-${exp._id}`}
                              className="btn btn-ghost btn-ghost-edit btn-sm"
                              onClick={() => handleEdit(exp)}
                              title="Edit expense"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              id={`btn-delete-${exp._id}`}
                              className="btn btn-ghost btn-ghost-delete btn-sm"
                              onClick={() => handleDelete(exp._id, exp.title)}
                              disabled={deletingId === exp._id}
                              title="Delete expense"
                            >
                              {deletingId === exp._id ? (
                                <span className="spinner" style={{ width: 10, height: 10 }} />
                              ) : (
                                '🗑️ Delete'
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

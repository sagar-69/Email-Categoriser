import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Mail, RefreshCw, Moon, Sun, Download, Filter,
  AlertTriangle, CheckCircle, Clock, XCircle, Inbox, Loader2, Search,
  ToggleLeft, ToggleRight, Briefcase, Brain
} from 'lucide-react';
import ClassificationModeModal from './ClassificationModeModal';
import HRDashboard from './HRDashboard';

// ── Config / Constants (matches Python backend settings.py) ─────────
const EMAIL_TYPE_DISPLAY = {
  SALES: 'Sales',
  SUPPORT: 'Support',
  SPAM: 'Spam',
  MARKETING: 'Marketing',
  GENERAL: 'General',
  INTERNAL: 'Internal',
};

const ACTION_DISPLAY = {
  ACTION_REQUIRED: 'Action Required',
  AWAITING_REPLY: 'Awaiting Reply',
  FYI: 'FYI',
  REFERENCE: 'Reference',
};

const DEPT_DISPLAY = {
  HR_ADMIN: 'HR & Admin',
  INTERNAL_PROJECT: 'Internal Project',
  EXTERNAL_CLIENT: 'External / Client',
  IT_SYSTEMS: 'IT & Systems',
  FINANCE: 'Finance',
};

const PRIORITY_DISPLAY = {
  URGENT: 'Urgent',
  STANDARD: 'Standard',
  LOW_PRIORITY: 'Low Priority',
};

const EMAIL_TYPE_COLOURS = {
  SALES: '#2E86DE',
  SUPPORT: '#E55039',
  SPAM: '#888780',
  MARKETING: '#F6B93B',
  GENERAL: '#1D9E75',
  INTERNAL: '#7F77DD',
};

const ACTION_COLOURS = {
  ACTION_REQUIRED: '#D85A30',
  AWAITING_REPLY: '#BA7517',
  FYI: '#378ADD',
  REFERENCE: '#639922',
};

const DEPT_COLOURS = {
  HR_ADMIN: '#D4537E',
  INTERNAL_PROJECT: '#378ADD',
  EXTERNAL_CLIENT: '#D85A30',
  IT_SYSTEMS: '#639922',
  FINANCE: '#7F77DD',
};

const PRIORITY_COLOURS = {
  URGENT: '#E24B4A',
  STANDARD: '#888780',
  LOW_PRIORITY: '#1D9E75',
};

const TAG_BG = {
  light: {
    SALES: 'bg-blue-100 text-blue-800 border-blue-200',
    SUPPORT: 'bg-red-100 text-red-800 border-red-200',
    SPAM: 'bg-gray-100 text-gray-700 border-gray-200',
    MARKETING: 'bg-amber-100 text-amber-800 border-amber-200',
    GENERAL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    INTERNAL: 'bg-violet-100 text-violet-800 border-violet-200',
    ACTION_REQUIRED: 'bg-orange-100 text-orange-800 border-orange-200',
    AWAITING_REPLY: 'bg-amber-100 text-amber-800 border-amber-200',
    FYI: 'bg-sky-100 text-sky-800 border-sky-200',
    REFERENCE: 'bg-green-100 text-green-800 border-green-200',
    HR_ADMIN: 'bg-pink-100 text-pink-800 border-pink-200',
    INTERNAL_PROJECT: 'bg-blue-100 text-blue-800 border-blue-200',
    EXTERNAL_CLIENT: 'bg-orange-100 text-orange-800 border-orange-200',
    IT_SYSTEMS: 'bg-green-100 text-green-800 border-green-200',
    FINANCE: 'bg-violet-100 text-violet-800 border-violet-200',
    URGENT: 'bg-red-100 text-red-800 border-red-200',
    STANDARD: 'bg-gray-100 text-gray-700 border-gray-200',
    LOW_PRIORITY: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  dark: {
    SALES: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
    SUPPORT: 'bg-red-900/40 text-red-300 border-red-700/50',
    SPAM: 'bg-stone-800 text-stone-400 border-stone-700',
    MARKETING: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
    GENERAL: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
    INTERNAL: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
    ACTION_REQUIRED: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
    AWAITING_REPLY: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
    FYI: 'bg-sky-900/40 text-sky-300 border-sky-700/50',
    REFERENCE: 'bg-green-900/40 text-green-300 border-green-700/50',
    HR_ADMIN: 'bg-pink-900/40 text-pink-300 border-pink-700/50',
    INTERNAL_PROJECT: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
    EXTERNAL_CLIENT: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
    IT_SYSTEMS: 'bg-green-900/40 text-green-300 border-green-700/50',
    FINANCE: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
    URGENT: 'bg-red-900/40 text-red-300 border-red-700/50',
    STANDARD: 'bg-stone-800 text-stone-400 border-stone-700',
    LOW_PRIORITY: 'bg-stone-800 text-stone-500 border-stone-700',
  }
};

// ── API helpers ─────────────────────────────────────────────────────
const API_BASE = '/api';

async function fetchEmails(mode = 'standard') {
  const url = mode === 'hr' ? `${API_BASE}/emails?mode=hr` : `${API_BASE}/emails`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiMarkRead(emailId) {
  const res = await fetch(`${API_BASE}/emails/${emailId}/read`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`Failed to mark read: ${res.status}`);
  return res.json();
}

async function fetchUnreadCounts() {
  const res = await fetch(`${API_BASE}/unread-count`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Components ──────────────────────────────────────────────────────

const Tag = ({ label, value, darkMode }) => {
  const key = value;
  const classes = TAG_BG[darkMode ? 'dark' : 'light'][key] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border ${classes}`}>
      {label}
    </span>
  );
};

const MetricCard = ({ label, value, icon: Icon, colorClass, darkMode }) => (
  <div className={`rounded-xl p-4 border transition-colors ${darkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
    <div className="flex items-center justify-between mb-2">
      <span className={`text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>{label}</span>
      <Icon className={`w-4 h-4 ${colorClass}`} />
    </div>
    <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
  </div>
);

const FilterSelect = ({ label, options, selected, onChange, darkMode }) => (
  <div className="mb-4">
    <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>
      {label}
    </label>
    <div className={`rounded-lg border p-2 max-h-32 overflow-y-auto ${darkMode ? 'bg-stone-900 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
      {Object.entries(options).map(([key, display]) => (
        <label key={key} className="flex items-center gap-2 py-1 cursor-pointer hover:opacity-80">
          <input
            type="checkbox"
            checked={selected.includes(key)}
            onChange={() => {
              if (selected.includes(key)) {
                onChange(selected.filter(k => k !== key));
              } else {
                onChange([...selected, key]);
              }
            }}
            className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
          />
          <span className={`text-sm ${darkMode ? 'text-stone-300' : 'text-stone-600'}`}>{display}</span>
        </label>
      ))}
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label, darkMode }) => {
  if (!active || !payload) return null;
  return (
    <div className={`rounded-lg border shadow-lg px-3 py-2 ${darkMode ? 'bg-stone-900 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}>
      {label && <p className="text-sm font-medium mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ── Main Dashboard ──────────────────────────────────────────────────

export default function InboxDashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [data, setData] = useState([]);
  const [hrData, setHrData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [sortBy, setSortBy] = useState('Priority (urgent first)');
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, standard: 0, hr: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  // Classification mode state
  const [showModal, setShowModal] = useState(false);
  const [classificationMode, setClassificationMode] = useState('standard');

  // Filters
  const [selEmailType, setSelEmailType] = useState(Object.keys(EMAIL_TYPE_DISPLAY));
  const [selAction, setSelAction] = useState(Object.keys(ACTION_DISPLAY));
  const [selDept, setSelDept] = useState(Object.keys(DEPT_DISPLAY));
  const [selPriority, setSelPriority] = useState(Object.keys(PRIORITY_DISPLAY));

  // Check sessionStorage on mount for classification mode
  useEffect(() => {
    const stored = sessionStorage.getItem('classification_mode');
    if (stored) {
      setClassificationMode(stored);
    } else {
      setShowModal(true);
    }
  }, []);

  // Modal callback
  const handleModeSelect = useCallback((mode, remember) => {
    const selected = mode || 'standard';
    setClassificationMode(selected);
    setShowModal(false);
    if (remember && mode) {
      sessionStorage.setItem('classification_mode', selected);
    }
  }, []);

  // Fetch ALL emails (both modes) from the API
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stdEmails, hrEmails, counts] = await Promise.all([
        fetchEmails('standard'),
        fetchEmails('hr'),
        fetchUnreadCounts(),
      ]);
      setData(stdEmails);
      setHrData(hrEmails);
      setUnreadCounts(counts);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Toggle mode handler
  const handleToggleMode = useCallback(() => {
    const newMode = classificationMode === 'standard' ? 'hr' : 'standard';
    setClassificationMode(newMode);
    sessionStorage.setItem('classification_mode', newMode);
  }, [classificationMode]);

  // Theme helpers
  const bgMain = darkMode ? 'bg-stone-950' : 'bg-stone-50';
  const bgCard = darkMode ? 'bg-stone-900' : 'bg-white';
  const textMain = darkMode ? 'text-stone-100' : 'text-stone-900';
  const textSub = darkMode ? 'text-stone-400' : 'text-stone-500';
  const borderCol = darkMode ? 'border-stone-800' : 'border-stone-200';
  const chartGrid = darkMode ? '#292524' : '#e7e5e4';
  const chartText = darkMode ? '#a8a29e' : '#57534e';

  // Filtered data (hide read emails)
  const filtered = useMemo(() => {
    return data.filter(d => {
      // Skip read emails
      if (d.is_read) return false;
      const matchesTags = selEmailType.includes(d.email_type_label) &&
                          selAction.includes(d.action_label) &&
                          selDept.includes(d.dept_label) &&
                          selPriority.includes(d.priority_label);
      if (!matchesTags) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (d.subject && d.subject.toLowerCase().includes(q)) ||
        (d.sender && d.sender.toLowerCase().includes(q)) ||
        (d.reason && d.reason.toLowerCase().includes(q))
      );
    });
  }, [data, selEmailType, selAction, selDept, selPriority, searchQuery]);

  // Sorted data
  const sorted = useMemo(() => {
    const df = [...filtered];
    if (sortBy === 'Priority (urgent first)') {
      const order = { URGENT: 0, STANDARD: 1, LOW_PRIORITY: 2 };
      df.sort((a, b) => (order[a.priority_label] ?? 99) - (order[b.priority_label] ?? 99));
    } else if (sortBy === 'Most recent') {
      df.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
    } else {
      const order = { ACTION_REQUIRED: 0, AWAITING_REPLY: 1, FYI: 2, REFERENCE: 3 };
      df.sort((a, b) => (order[a.action_label] ?? 99) - (order[b.action_label] ?? 99));
    }
    return df;
  }, [filtered, sortBy]);

  // Chart data preparations
  const emailTypeData = useMemo(() => {
    const counts = {};
    filtered.forEach(d => counts[d.email_type_label] = (counts[d.email_type_label] || 0) + 1);
    return Object.entries(EMAIL_TYPE_DISPLAY).map(([key, label]) => ({
      name: label,
      value: counts[key] || 0,
      key,
    })).filter(d => d.value > 0);
  }, [filtered]);

  const actionData = useMemo(() => {
    const counts = {};
    filtered.forEach(d => counts[d.action_label] = (counts[d.action_label] || 0) + 1);
    return Object.entries(ACTION_DISPLAY).map(([key, label]) => ({
      name: label,
      value: counts[key] || 0,
      key,
    })).filter(d => d.value > 0);
  }, [filtered]);

  const deptData = useMemo(() => {
    const counts = {};
    filtered.forEach(d => counts[d.dept_label] = (counts[d.dept_label] || 0) + 1);
    return Object.entries(DEPT_DISPLAY).map(([key, label]) => ({
      name: label,
      value: counts[key] || 0,
      key,
    })).filter(d => d.value > 0);
  }, [filtered]);

  const priorityData = useMemo(() => {
    const counts = {};
    filtered.forEach(d => counts[d.priority_label] = (counts[d.priority_label] || 0) + 1);
    return Object.entries(PRIORITY_DISPLAY).map(([key, label]) => ({
      name: label,
      value: counts[key] || 0,
      key,
    })).filter(d => d.value > 0);
  }, [filtered]);

  // Pie chart data
  const pieData = useMemo(() => emailTypeData, [emailTypeData]);

  // Timeline data
  const timelineData = useMemo(() => {
    const daily = {};
    filtered.forEach(d => {
      const date = new Date(d.received_at).toISOString().split('T')[0];
      if (!daily[date]) daily[date] = { date, URGENT: 0, STANDARD: 0, LOW_PRIORITY: 0 };
      daily[date][d.priority_label]++;
    });
    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // All emails matching filters (including read) — used for "Total emails" metric
  const allMatchingFilters = useMemo(() => {
    return data.filter(d => {
      const matchesTags = selEmailType.includes(d.email_type_label) &&
                          selAction.includes(d.action_label) &&
                          selDept.includes(d.dept_label) &&
                          selPriority.includes(d.priority_label);
      if (!matchesTags) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (d.subject && d.subject.toLowerCase().includes(q)) ||
        (d.sender && d.sender.toLowerCase().includes(q)) ||
        (d.reason && d.reason.toLowerCase().includes(q))
      );
    });
  }, [data, selEmailType, selAction, selDept, selPriority, searchQuery]);

  // Stats
  const total = allMatchingFilters.length;
  const spamCount = filtered.filter(d => d.email_type_label === 'SPAM').length;
  const urgentCount = filtered.filter(d => d.priority_label === 'URGENT').length;
  const actionCount = filtered.filter(d => d.action_label === 'ACTION_REQUIRED').length;
  const awaitingCount = filtered.filter(d => d.action_label === 'AWAITING_REPLY').length;
  const failedCount = filtered.filter(d => d.status === 'failed').length;
  const unreadCount = filtered.length;

  // Mark email as read (optimistic UI)
  const handleMarkRead = useCallback(async (emailId) => {
    // Optimistic update — immediately mark as read in local state
    setData(prev => prev.map(e => e.id === emailId ? { ...e, is_read: 1 } : e));
    setHrData(prev => prev.map(e => e.id === emailId ? { ...e, is_read: 1 } : e));
    setUnreadCounts(prev => ({
      total: Math.max(0, prev.total - 1),
      standard: Math.max(0, prev.standard - 1),
      hr: Math.max(0, prev.hr - 1),
    }));
    try {
      await apiMarkRead(emailId);
    } catch (err) {
      console.error('Failed to mark email as read:', err);
      // Revert on failure
      loadAllData();
    }
  }, [loadAllData]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Trigger Python pipeline to fetch & classify in current mode
      const res = await fetch(`${API_BASE}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: classificationMode, reclassify_all: false }),
      });
      if (!res.ok) {
        throw new Error(`Classification failed: ${res.status}`);
      }
    } catch (err) {
      console.error("Network error during classification", err);
      setError(`Refresh failed: ${err.message}. Ensure backend is running.`);
    }
    // Always reload ALL data from SQLite afterwards
    await loadAllData();
  }, [loadAllData, classificationMode]);

  const handleExport = useCallback(() => {
    const headers = ['subject', 'sender', 'email_type_label', 'action_label', 'dept_label', 'priority_label', 'reason', 'received_at'];
    const csv = [
      headers.join(','),
      ...sorted.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inbox_intel_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted]);

  // Error state
  if (error && data.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bgMain}`}>
        <div className={`rounded-xl border p-8 max-w-md text-center ${bgCard} ${borderCol}`}>
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className={`text-lg font-bold mb-2 ${textMain}`}>Cannot connect to API</h2>
          <p className={`text-sm mb-4 ${textSub}`}>
            Make sure the FastAPI server is running:<br />
            <code className="text-xs bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded mt-2 inline-block">
              uvicorn api.server:app --port 8000
            </code>
          </p>
          <button onClick={handleRefresh} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors">
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgMain} transition-colors duration-300`}>
      {/* Classification Mode Modal */}
      <ClassificationModeModal
        isOpen={showModal}
        onSelect={handleModeSelect}
        darkMode={darkMode}
      />

      {/* Mode Toggle Banner */}
      <div className={`w-full px-6 py-3 border-b flex items-center justify-between transition-colors ${
        classificationMode === 'hr'
          ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700'
          : darkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'
      }`}>
        <div className="flex items-center gap-3">
          {classificationMode === 'hr'
            ? <Briefcase className="w-5 h-5 text-amber-600" />
            : <Brain className={`w-5 h-5 ${darkMode ? 'text-stone-400' : 'text-stone-500'}`} />
          }
          <span className={`text-sm font-semibold ${
            classificationMode === 'hr'
              ? 'text-amber-800 dark:text-amber-300'
              : darkMode ? 'text-stone-300' : 'text-stone-600'
          }`}>
            {classificationMode === 'hr'
              ? 'HR Classification Mode: ACTIVE'
              : 'Standard Classification Mode'
            }
          </span>
        </div>
        <button
          onClick={handleToggleMode}
          className="flex items-center gap-2 transition-colors"
          title={`Switch to ${classificationMode === 'hr' ? 'Standard' : 'HR'} mode`}
        >
          {classificationMode === 'hr'
            ? <ToggleRight className="w-8 h-8 text-amber-600" />
            : <ToggleLeft className={`w-8 h-8 ${darkMode ? 'text-stone-500' : 'text-stone-400'}`} />
          }
        </button>
      </div>

      {/* Conditional Rendering: HR Mode vs Standard Mode */}
      {classificationMode === 'hr' ? (
        <>
          {/* HR Mode Header */}
          <div className="px-6 pt-6 pb-2 flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold flex items-center gap-2 ${textMain}`}>
                <Briefcase className="w-7 h-7 text-amber-500" />
                HR Intelligence
              </h1>
              <p className={`text-sm mt-1 ${textSub}`}>HR email classification dashboard — Powered by local AI</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg border transition-colors ${darkMode ? 'bg-stone-800 border-stone-700 text-yellow-400' : 'bg-white border-stone-200 text-stone-600'}`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Loading state for HR */}
          {loading && hrData.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className={`w-8 h-8 animate-spin ${darkMode ? 'text-stone-400' : 'text-stone-500'}`} />
              <span className={`ml-3 text-lg ${textSub}`}>Loading HR emails...</span>
            </div>
          )}

          {/* HR Dashboard */}
          {(!loading || hrData.length > 0) && (
            <HRDashboard emails={hrData} darkMode={darkMode} onMarkRead={handleMarkRead} />
          )}
        </>
      ) : (
      <div className="flex">
        {/* ── Sidebar ── */}
        <aside className={`w-64 h-screen sticky top-0 border-r p-5 overflow-y-auto ${borderCol} ${bgCard}`}>
          <div className="flex items-center gap-2 mb-6">
            <Mail className="w-6 h-6 text-sky-500" />
            <h2 className={`font-bold text-lg ${textMain}`}>Filters</h2>
          </div>

          <FilterSelect label="Email type" options={EMAIL_TYPE_DISPLAY} selected={selEmailType} onChange={setSelEmailType} darkMode={darkMode} />
          <FilterSelect label="Action intent" options={ACTION_DISPLAY} selected={selAction} onChange={setSelAction} darkMode={darkMode} />
          <FilterSelect label="Department" options={DEPT_DISPLAY} selected={selDept} onChange={setSelDept} darkMode={darkMode} />
          <FilterSelect label="Priority" options={PRIORITY_DISPLAY} selected={selPriority} onChange={setSelPriority} darkMode={darkMode} />

          <div className={`mt-6 pt-4 border-t ${borderCol}`}>
            <p className={`text-sm ${textSub}`}>Showing: <span className={textMain}>{filtered.length}</span> of {data.length} emails</p>
            <p className={`text-xs mt-1 ${textSub}`}>Last sync: {lastSync ? lastSync.toLocaleTimeString() : '—'}</p>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`text-2xl font-bold flex items-center gap-2 ${textMain}`}>
                <Inbox className="w-7 h-7 text-sky-500" />
                Inbox Intelligence
              </h1>
              <p className={`text-sm mt-1 ${textSub}`}>Smart email classification dashboard — Live data from SQLite</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg border transition-colors ${darkMode ? 'bg-stone-800 border-stone-700 text-yellow-400' : 'bg-white border-stone-200 text-stone-600'}`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Banner Error (if data already exists but a background operation failed) */}
          {error && data.length > 0 && (
            <div className="mb-6 p-4 rounded-lg bg-red-100 text-red-800 border border-red-200 flex items-center justify-between">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900 transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && data.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className={`w-8 h-8 animate-spin ${darkMode ? 'text-stone-400' : 'text-stone-500'}`} />
              <span className={`ml-3 text-lg ${textSub}`}>Loading emails from database...</span>
            </div>
          )}

          {/* Content (shown when data is loaded) */}
          {data.length > 0 && (
            <>
              {/* Metrics */}
              <div className="grid grid-cols-7 gap-4 mb-6">
                <MetricCard label="Total emails" value={total} icon={Inbox} colorClass="text-sky-500" darkMode={darkMode} />
                <MetricCard label="Unread" value={unreadCount} icon={Mail} colorClass="text-indigo-500" darkMode={darkMode} />
                <MetricCard label="Spam" value={spamCount} icon={AlertTriangle} colorClass="text-red-500" darkMode={darkMode} />
                <MetricCard label="Urgent" value={urgentCount} icon={AlertTriangle} colorClass="text-red-500" darkMode={darkMode} />
                <MetricCard label="Action req" value={actionCount} icon={CheckCircle} colorClass="text-green-500" darkMode={darkMode} />
                <MetricCard label="Awaiting" value={awaitingCount} icon={Clock} colorClass="text-amber-500" darkMode={darkMode} />
                <MetricCard label="Failed" value={failedCount} icon={XCircle} colorClass="text-stone-500" darkMode={darkMode} />
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                {/* Email Type Bar */}
                <div className={`rounded-xl border p-4 ${bgCard} ${borderCol}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Email Type</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={emailTypeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {emailTypeData.map((entry, i) => (
                          <Cell key={i} fill={EMAIL_TYPE_COLOURS[entry.key]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Action Intent Bar */}
                <div className={`rounded-xl border p-4 ${bgCard} ${borderCol}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Action Intent</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={actionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {actionData.map((entry, i) => (
                          <Cell key={i} fill={ACTION_COLOURS[entry.key]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Department Bar */}
                <div className={`rounded-xl border p-4 ${bgCard} ${borderCol}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Department</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deptData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {deptData.map((entry, i) => (
                          <Cell key={i} fill={DEPT_COLOURS[entry.key]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Priority Donut */}
                <div className={`rounded-xl border p-4 ${bgCard} ${borderCol}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Priority</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke={darkMode ? '#1c1917' : '#ffffff'}
                        strokeWidth={2}
                      >
                        {priorityData.map((entry, i) => (
                          <Cell key={i} fill={PRIORITY_COLOURS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className={darkMode ? 'fill-stone-200' : 'fill-stone-800'} style={{ fontSize: 22, fontWeight: 'bold' }}>
                        {total}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Charts Row 2: Pie Chart + Timeline */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Pie Chart - Email Type Distribution */}
                <div className={`rounded-xl border p-4 ${bgCard} ${borderCol}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Email Type Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="35%"
                        cy="50%"
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        stroke={darkMode ? '#1c1917' : '#ffffff'}
                        strokeWidth={2}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: chartText }}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={EMAIL_TYPE_COLOURS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                      <Legend
                        verticalAlign="middle"
                        align="right"
                        layout="vertical"
                        iconType="circle"
                        wrapperStyle={{ color: chartText, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Timeline Stacked Bar */}
                <div className={`rounded-xl border p-4 ${bgCard} ${borderCol}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Emails by Day</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                      <Legend wrapperStyle={{ color: chartText, fontSize: 12 }} />
                      <Bar dataKey="URGENT" stackId="a" fill={PRIORITY_COLOURS.URGENT} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="STANDARD" stackId="a" fill={PRIORITY_COLOURS.STANDARD} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="LOW_PRIORITY" stackId="a" fill={PRIORITY_COLOURS.LOW_PRIORITY} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Email List Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold ${textMain}`}>Emails</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className={`w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${textSub}`} />
                    <input
                      type="text"
                      placeholder="Search emails..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`pl-9 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-sky-500 ${darkMode ? 'bg-stone-900 border-stone-700 text-stone-200 placeholder-stone-500' : 'bg-white border-stone-200 text-stone-700 placeholder-stone-400'}`}
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className={`text-sm rounded-lg border px-3 py-1.5 ${darkMode ? 'bg-stone-900 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-700'}`}
                  >
                    <option>Priority (urgent first)</option>
                    <option>Most recent</option>
                    <option>Action required first</option>
                  </select>
                  <button
                    onClick={handleExport}
                    className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${darkMode ? 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Email Cards */}
              <div className="space-y-3">
                {sorted.slice(0, 100).map((row) => {
                  const isRead = !!row.is_read;
                  return (
                    <div
                      key={row.id}
                      onClick={() => !isRead && handleMarkRead(row.id)}
                      className={`rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer ${bgCard} ${borderCol} ${
                        isRead ? 'opacity-70' : `border-l-4 ${row.priority_label === 'URGENT' ? 'border-l-red-500' : 'border-l-sky-500'}`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`text-xs mb-1 ${textSub}`}>{row.sender} · {row.sender_email}</div>
                        {!isRead && (
                          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${row.priority_label === 'URGENT' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-sky-500'}`} title="Unread" />
                        )}
                      </div>
                      <div className={`text-sm mb-1 ${textMain} ${isRead ? 'font-normal' : 'font-semibold'}`}>{row.subject}</div>
                      {row.snippet && <div className={`text-sm mb-2 line-clamp-2 ${darkMode ? 'text-stone-400' : 'text-stone-600'}`}>{row.snippet}</div>}
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Tag label={EMAIL_TYPE_DISPLAY[row.email_type_label] || row.email_type_label} value={row.email_type_label} darkMode={darkMode} />
                        <Tag label={ACTION_DISPLAY[row.action_label] || row.action_label} value={row.action_label} darkMode={darkMode} />
                        <Tag label={DEPT_DISPLAY[row.dept_label] || row.dept_label} value={row.dept_label} darkMode={darkMode} />
                        <Tag label={PRIORITY_DISPLAY[row.priority_label] || row.priority_label} value={row.priority_label} darkMode={darkMode} />
                      </div>
                      <div className={`text-xs ${textSub}`}>{row.reason}</div>
                    </div>
                  );
                })}
                {sorted.length === 0 && (
                  <div className={`text-center py-12 ${textSub}`}>No emails match the selected filters.</div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      )}
    </div>
  );
}

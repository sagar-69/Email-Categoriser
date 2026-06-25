import React, { useState, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Mail, RefreshCw, Moon, Sun, Download, Filter,
  AlertTriangle, CheckCircle, Clock, XCircle, Inbox, Loader2, Search,
  ToggleLeft, ToggleRight, Briefcase, Brain, LogIn, ChevronDown, UserCircle, LogOut, Plus, Trash2,
  FileSpreadsheet, FileText, Sparkles, Copy, Cpu
} from 'lucide-react';
import ClassificationModeModal from './ClassificationModeModal';
import HRDashboard from './HRDashboard';
import { apiFetch, setToken } from './App';

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

const normalizeLabel = (value) => String(value || '').trim().toUpperCase();

const matchesSelected = (selected, value) => {
  if (selected.length === 0) return false;
  return selected.includes(normalizeLabel(value));
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

// ── API helpers (JWT-authenticated) ──────────────────────────────────
const API_BASE = '/api';

function buildQuery(params) {
  const filtered = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (filtered.length === 0) return '';
  return '?' + filtered.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

async function refreshTokenForAccount(ownerEmail) {
  if (!ownerEmail) return false;
  const tokenRes = await fetch(`${API_BASE}/auth/token?email=${encodeURIComponent(ownerEmail)}`, { method: 'POST' });
  if (!tokenRes.ok) return false;
  const tokenData = await tokenRes.json();
  if (!tokenData.token) return false;
  setToken(tokenData.token);
  return true;
}

async function apiFetchWithAccountRetry(url, options = {}, ownerEmail = null) {
  let res = await apiFetch(url, options);
  if (res.status === 401 && ownerEmail && await refreshTokenForAccount(ownerEmail)) {
    res = await apiFetch(url, options);
  }
  return res;
}

async function fetchEmails(mode = 'standard', ownerEmail = null) {
  const query = buildQuery({ mode: mode === 'hr' ? 'hr' : undefined, owner_email: ownerEmail });
  const res = await apiFetchWithAccountRetry(`${API_BASE}/emails${query}`, {}, ownerEmail);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data || json;
}

async function apiMarkRead(emailId, ownerEmail = null) {
  const res = await apiFetchWithAccountRetry(`${API_BASE}/emails/${emailId}/read`, { method: 'PATCH' }, ownerEmail);
  if (!res.ok) throw new Error(`Failed to mark read: ${res.status}`);
  return res.json();
}

async function fetchUnreadCounts(ownerEmail = null) {
  const query = buildQuery({ owner_email: ownerEmail });
  const res = await apiFetchWithAccountRetry(`${API_BASE}/unread-count${query}`, {}, ownerEmail);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fetchModels(ownerEmail = null) {
  const res = await apiFetchWithAccountRetry(`${API_BASE}/models`, {}, ownerEmail);
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(details || `Model API error: ${res.status}`);
  }
  return res.json();
}

async function fetchReplySuggestions(emailId, modelName = null, ownerEmail = null) {
  const query = modelName ? `?model_name=${encodeURIComponent(modelName)}` : '';
  const res = await apiFetchWithAccountRetry(`${API_BASE}/emails/${emailId}/reply-suggestions${query}`, { method: 'POST' }, ownerEmail);
  if (!res.ok) throw new Error(`Reply API error: ${res.status}`);
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

const FilterSelect = ({ label, options, selected, onChange, darkMode }) => {
  const optionKeys = Object.keys(options);
  const allSelected = selected.length === optionKeys.length;

  const toggleOption = (key) => {
    onChange(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key];
    });
  };

  return (
    <div className="mb-4">
      <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>
        {label}
      </label>
      <div className={`rounded-lg border p-2 max-h-40 overflow-y-auto ${darkMode ? 'bg-stone-900 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
        <label className={`flex items-center gap-2 py-1.5 mb-1 border-b cursor-pointer hover:opacity-80 ${darkMode ? 'border-stone-800' : 'border-stone-200'}`}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onChange(allSelected ? [] : optionKeys)}
            className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
          />
          <span className={`text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>All</span>
        </label>
        {Object.entries(options).map(([key, display]) => (
          <label key={key} className="flex items-center gap-2 py-1 cursor-pointer hover:opacity-80">
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={() => toggleOption(key)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className={`text-sm ${darkMode ? 'text-stone-300' : 'text-stone-600'}`}>{display}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

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

export default function InboxDashboard({ ownerEmail, ownerAccount, accounts = [], onSelectAccount, onLogin, onRemoveAccount }) {
  const [darkMode, setDarkMode] = useState(false);
  const [data, setData] = useState([]);
  const [hrData, setHrData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [sortBy, setSortBy] = useState('Priority (urgent first)');
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, standard: 0, hr: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Model switching state
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelError, setModelError] = useState('');

  // Auto-reply state
  const [replyLoading, setReplyLoading] = useState({});
  const [replySuggestions, setReplySuggestions] = useState({});
  const [copiedReply, setCopiedReply] = useState(null);

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

  // Load available Ollama models
  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    setModelError('');
    fetchModels(ownerEmail).then(data => {
      if (cancelled) return;
      setAvailableModels(data.models || []);
      setSelectedModel(data.current || selectedModel || '');
    }).catch((err) => {
      if (cancelled) return;
      setAvailableModels([]);
      setModelError(err.message || 'Could not load models');
    }).finally(() => {
      if (!cancelled) setModelsLoading(false);
    });
    return () => { cancelled = true; };
  }, [ownerEmail]);

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
  const loadAllData = useCallback(async ({ preserveError = false } = {}) => {
    setLoading(true);
    if (!preserveError) setError(null);
    try {
      const [stdEmails, hrEmails, counts] = await Promise.all([
        fetchEmails('standard', ownerEmail),
        fetchEmails('hr', ownerEmail),
        fetchUnreadCounts(ownerEmail),
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
  }, [ownerEmail]);

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
      const matchesTags = matchesSelected(selEmailType, d.email_type_label) &&
                          matchesSelected(selAction, d.action_label) &&
                          matchesSelected(selDept, d.dept_label) &&
                          matchesSelected(selPriority, d.priority_label);
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
      df.sort((a, b) => {
        const priorityDiff = (order[normalizeLabel(a.priority_label)] ?? 99) - (order[normalizeLabel(b.priority_label)] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.received_at) - new Date(a.received_at);
      });
    } else if (sortBy === 'Most recent') {
      df.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
    } else {
      const order = { ACTION_REQUIRED: 0, AWAITING_REPLY: 1, FYI: 2, REFERENCE: 3 };
      df.sort((a, b) => {
        const actionDiff = (order[normalizeLabel(a.action_label)] ?? 99) - (order[normalizeLabel(b.action_label)] ?? 99);
        if (actionDiff !== 0) return actionDiff;
        return new Date(b.received_at) - new Date(a.received_at);
      });
    }
    return df;
  }, [filtered, sortBy]);

  // Chart data preparations
  const emailTypeData = useMemo(() => {
    const counts = {};
    filtered.forEach(d => {
      const key = normalizeLabel(d.email_type_label);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(EMAIL_TYPE_DISPLAY).map(([key, label]) => ({
      name: label,
      value: counts[key] || 0,
      key,
    })).filter(d => d.value > 0);
  }, [filtered]);

  const actionData = useMemo(() => {
    const counts = {};
    filtered.forEach(d => {
      const key = normalizeLabel(d.action_label);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(ACTION_DISPLAY).map(([key, label]) => ({
      name: label,
      value: counts[key] || 0,
      key,
    })).filter(d => d.value > 0);
  }, [filtered]);

  const deptData = useMemo(() => {
    const counts = {};
    filtered.forEach(d => {
      const key = normalizeLabel(d.dept_label);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(DEPT_DISPLAY).map(([key, label]) => ({
      name: label,
      value: counts[key] || 0,
      key,
    })).filter(d => d.value > 0);
  }, [filtered]);

  const priorityData = useMemo(() => {
    const counts = {};
    filtered.forEach(d => {
      const key = normalizeLabel(d.priority_label);
      counts[key] = (counts[key] || 0) + 1;
    });
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
      const priority = normalizeLabel(d.priority_label);
      if (daily[date][priority] !== undefined) daily[date][priority]++;
    });
    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // All emails matching filters (including read) — used for "Total emails" metric
  const allMatchingFilters = useMemo(() => {
    return data.filter(d => {
      const matchesTags = matchesSelected(selEmailType, d.email_type_label) &&
                          matchesSelected(selAction, d.action_label) &&
                          matchesSelected(selDept, d.dept_label) &&
                          matchesSelected(selPriority, d.priority_label);
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
      await apiMarkRead(emailId, ownerEmail);
    } catch (err) {
      console.error('Failed to mark email as read:', err);
      // Revert on failure
      loadAllData();
    }
  }, [loadAllData, ownerEmail]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    let refreshFailed = false;
    try {
      // Trigger Python pipeline to fetch & classify in current mode (with selected model)
      const res = await apiFetchWithAccountRetry(`${API_BASE}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: classificationMode,
          reclassify_all: false,
          owner_email: ownerEmail,
          model_name: selectedModel || null,
        }),
      }, ownerEmail);
      if (!res.ok) {
        const details = await res.text().catch(() => '');
        throw new Error(details || `Classification failed: ${res.status}`);
      }
      const result = await res.json();
      if (result.status === 'error') {
        throw new Error(result.message || 'Classification failed.');
      }
    } catch (err) {
      console.error("Network error during classification", err);
      refreshFailed = true;
      setError(`Refresh failed: ${err.message}. Ensure backend, Gmail auth, and Ollama are running.`);
    }
    // Always reload ALL data from SQLite afterwards
    await loadAllData({ preserveError: refreshFailed });
  }, [loadAllData, classificationMode, ownerEmail, selectedModel]);

  // Auto-reply handler
  const handleSuggestReplies = useCallback(async (emailId) => {
    setReplyLoading(prev => ({ ...prev, [emailId]: true }));
    try {
      const data = await fetchReplySuggestions(emailId, selectedModel || null, ownerEmail);
      setReplySuggestions(prev => ({ ...prev, [emailId]: data.suggestions }));
    } catch (err) {
      console.error('Failed to fetch reply suggestions:', err);
      setReplySuggestions(prev => ({ ...prev, [emailId]: ['Failed to generate suggestions. Try again.'] }));
    } finally {
      setReplyLoading(prev => ({ ...prev, [emailId]: false }));
    }
  }, [selectedModel, ownerEmail]);

  const handleCopyReply = useCallback((text, replyKey) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReply(replyKey);
      setTimeout(() => setCopiedReply(null), 2000);
    });
  }, []);

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

  const handleExportExcel = useCallback(() => {
    const headers = ['subject', 'sender', 'email_type_label', 'action_label', 'dept_label', 'priority_label', 'reason', 'received_at'];
    const exportData = sorted.map(row => {
      const obj = {};
      headers.forEach(h => obj[h] = row[h]);
      return obj;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Emails");
    XLSX.writeFile(workbook, "inbox_intel_export.xlsx");
  }, [sorted]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF('landscape');
    const headers = [['Subject', 'Sender', 'Type', 'Action', 'Department', 'Priority', 'Reason', 'Received']];
    const exportData = sorted.map(row => [
      row.subject,
      row.sender,
      row.email_type_label,
      row.action_label,
      row.dept_label,
      row.priority_label,
      row.reason,
      row.received_at
    ]);
    
    autoTable(doc, {
      head: headers,
      body: exportData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [14, 165, 233] }, // Tailwind sky-500
    });
    
    doc.save("inbox_intel_export.pdf");
  }, [sorted]);

  const ModelSwitcher = ({ accent = 'sky' }) => {
    const accentText = accent === 'amber'
      ? darkMode ? 'text-amber-300' : 'text-amber-700'
      : darkMode ? 'text-sky-300' : 'text-sky-700';
    const accentBg = accent === 'amber'
      ? darkMode ? 'bg-amber-900/30' : 'bg-amber-50'
      : darkMode ? 'bg-sky-900/30' : 'bg-sky-50';
    const activeDot = accent === 'amber' ? 'bg-amber-500' : 'bg-sky-500';

    return (
      <div className="relative">
        <button
          onClick={() => setShowModelMenu(!showModelMenu)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
            darkMode
              ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
          }`}
          title="Select Ollama model"
        >
          <Cpu className="w-4 h-4" />
          <span className="max-w-[140px] truncate">
            {modelsLoading ? 'Loading models...' : selectedModel || 'Select model'}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
        </button>
        {showModelMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
            <div className={`absolute right-0 top-full mt-1 w-72 rounded-xl border shadow-xl z-50 overflow-hidden ${darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'}`}>
              <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-stone-500 border-b border-stone-700' : 'text-stone-400 border-b border-stone-100'}`}>Ollama Models</div>
              <div className="py-1 max-h-56 overflow-y-auto">
                {modelsLoading && (
                  <div className={`px-3 py-3 text-sm flex items-center gap-2 ${textSub}`}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading local models...
                  </div>
                )}
                {!modelsLoading && availableModels.length === 0 && (
                  <div className={`px-3 py-3 text-sm ${textSub}`}>
                    {modelError ? 'No models loaded. Check Ollama and try refreshing.' : 'No local models found.'}
                  </div>
                )}
                {availableModels.map(m => (
                  <button
                    key={m.name}
                    onClick={() => { setSelectedModel(m.name); setShowModelMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                      m.name === selectedModel
                        ? `${accentBg} ${accentText}`
                        : darkMode ? 'text-stone-300 hover:bg-stone-700' : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span className="truncate">{m.name}</span>
                    {m.name === selectedModel && <span className={`w-2 h-2 rounded-full ${activeDot} flex-shrink-0`} />}
                  </button>
                ))}
              </div>
              {modelError && (
                <div className={`px-3 py-2 text-xs border-t ${darkMode ? 'border-stone-700 text-stone-500' : 'border-stone-100 text-stone-400'}`}>
                  {modelError}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // Error state
  if (error && data.length === 0 && hrData.length === 0) {
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

      {/* Mode Toggle Banner + Account Switcher */}
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
        <div className="flex items-center gap-4">
          {/* Account Switcher */}
          <div className="relative">
            <button
              onClick={() => { setShowAccountMenu(!showAccountMenu); }}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-sm transition-all duration-200 ${
                darkMode
                  ? 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-700 hover:border-stone-600'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:border-stone-300'
              }`}
            >
              {ownerAccount?.picture ? (
                <img
                  src={ownerAccount.picture}
                  alt={ownerAccount.name || ownerEmail}
                  className="w-6 h-6 rounded-full object-cover ring-2 ring-sky-500/30"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                  {(ownerEmail || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="max-w-[160px] truncate font-medium">
                {ownerAccount?.name || ownerEmail || 'No account'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAccountMenu ? 'rotate-180' : ''}`} />
            </button>
            {showAccountMenu && (
              <>
                {/* Backdrop to close menu */}
                <div className="fixed inset-0 z-40" onClick={() => { setShowAccountMenu(false); }} />
                <div className={`absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden transition-all ${
                  darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'
                }`}
                  style={{ animation: 'dropdownSlide 0.2s ease-out' }}
                >
                  <div className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] ${
                    darkMode ? 'text-stone-500 border-b border-stone-700/50' : 'text-stone-400 border-b border-stone-100'
                  }`}>Linked Accounts</div>
                  <div className="py-1">
                    {accounts.map(acct => {
                      const email = acct.email;
                      const isActive = email === ownerEmail;
                      return (
                        <div
                          key={email}
                          className={`flex items-center justify-between px-3 py-2 mx-1.5 my-0.5 rounded-xl transition-all duration-200 cursor-pointer group ${
                            isActive
                              ? darkMode ? 'bg-sky-900/25' : 'bg-sky-50'
                              : darkMode ? 'hover:bg-stone-700/60' : 'hover:bg-stone-50'
                          }`}
                          onClick={() => { onSelectAccount(email); setShowAccountMenu(false); }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {acct.picture ? (
                              <img
                                src={acct.picture}
                                alt={acct.name || email}
                                className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 transition-all ${
                                  isActive ? 'ring-sky-500/50' : 'ring-transparent'
                                }`}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isActive
                                  ? 'bg-gradient-to-br from-sky-400 to-indigo-500 text-white'
                                  : darkMode ? 'bg-stone-600 text-stone-300' : 'bg-stone-200 text-stone-600'
                              }`}>{email[0].toUpperCase()}</div>
                            )}
                            <div className="min-w-0 flex-1">
                              {acct.name && (
                                <div className={`text-sm font-medium truncate ${
                                  isActive
                                    ? darkMode ? 'text-sky-300' : 'text-sky-700'
                                    : darkMode ? 'text-stone-200' : 'text-stone-800'
                                }`}>{acct.name}</div>
                              )}
                              <div className={`text-xs truncate ${
                                isActive
                                  ? darkMode ? 'text-sky-400/70' : 'text-sky-600/70'
                                  : darkMode ? 'text-stone-500' : 'text-stone-400'
                              }`}>{email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isActive && (
                              <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.5)]" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveAccount(email);
                                setShowAccountMenu(false);
                              }}
                              className={`p-1.5 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                                darkMode ? 'text-stone-500 hover:text-red-400 hover:bg-red-400/10' : 'text-stone-400 hover:text-red-500 hover:bg-red-50'
                              }`}
                              title="Remove account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`border-t mx-3 ${
                    darkMode ? 'border-stone-700/50' : 'border-stone-100'
                  }`}>
                    <button
                      onClick={() => { onLogin(); setShowAccountMenu(false); }}
                      className={`w-full text-left px-3 py-2.5 my-1 mx-0 rounded-xl flex items-center gap-2.5 text-sm font-medium transition-all duration-200 ${
                        darkMode ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        darkMode ? 'bg-emerald-400/10' : 'bg-emerald-50'
                      }`}>
                        <Plus className="w-4 h-4" />
                      </div>
                      Add Account
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Mode Toggle */}
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
              <ModelSwitcher accent="amber" />
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

          {/* Banner Error for HR mode */}
          {error && (
            <div className="mx-6 mt-4 p-4 rounded-lg bg-red-100 text-red-800 border border-red-200 flex items-center justify-between">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900 transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Loading state for HR */}
          {loading && hrData.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className={`w-8 h-8 animate-spin ${darkMode ? 'text-stone-400' : 'text-stone-500'}`} />
              <span className={`ml-3 text-lg ${textSub}`}>Loading HR emails...</span>
            </div>
          )}

          {/* HR Dashboard */}
          {(!loading || hrData.length > 0) && (
            <HRDashboard
              emails={hrData}
              darkMode={darkMode}
              onMarkRead={handleMarkRead}
              onSuggestReplies={handleSuggestReplies}
              replyLoading={replyLoading}
              replySuggestions={replySuggestions}
              copiedReply={copiedReply}
              onCopyReply={handleCopyReply}
            />
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
              <ModelSwitcher accent="sky" />
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
                <MetricCard label="Others" value={failedCount} icon={XCircle} colorClass="text-stone-500" darkMode={darkMode} />
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
                  <div className={`flex items-center rounded-lg border overflow-hidden ${darkMode ? 'border-stone-700' : 'border-stone-200'}`}>
                    <button
                      onClick={handleExport}
                      title="Export CSV"
                      className={`flex items-center justify-center px-3 py-1.5 transition-colors border-r ${darkMode ? 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleExportExcel}
                      title="Export Excel"
                      className={`flex items-center justify-center px-3 py-1.5 transition-colors border-r ${darkMode ? 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-500" />
                    </button>
                    <button
                      onClick={handleExportPDF}
                      title="Export PDF"
                      className={`flex items-center justify-center px-3 py-1.5 transition-colors ${darkMode ? 'bg-stone-900 text-stone-300 hover:bg-stone-800' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
                    >
                      <FileText className="w-4 h-4 text-red-600 dark:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Email Cards */}
              <div className="space-y-3">
                {sorted.slice(0, 100).map((row) => {
                  const isRead = !!row.is_read;
                  const hasReplies = replySuggestions[row.id];
                  const isLoadingReply = replyLoading[row.id];
                  return (
                    <div
                      key={row.id}
                      className={`rounded-xl border p-4 transition-all hover:shadow-md ${bgCard} ${borderCol} ${
                        isRead ? 'opacity-70' : `border-l-4 ${row.priority_label === 'URGENT' ? 'border-l-red-500' : 'border-l-sky-500'}`
                      }`}
                    >
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => !isRead && handleMarkRead(row.id)}>
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
                      <div className="flex items-center justify-between">
                        <div className={`text-xs ${textSub}`}>{row.reason}</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSuggestReplies(row.id); }}
                          disabled={isLoadingReply}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            darkMode
                              ? 'bg-violet-900/30 border-violet-700/50 text-violet-300 hover:bg-violet-900/50'
                              : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
                          } disabled:opacity-50`}
                          title="Generate AI reply suggestions"
                        >
                          {isLoadingReply ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {isLoadingReply ? 'Thinking...' : 'Suggest Replies'}
                        </button>
                      </div>
                      {/* Auto-Reply Suggestions */}
                      {hasReplies && (
                        <div className={`mt-3 pt-3 border-t space-y-2 ${darkMode ? 'border-stone-700' : 'border-stone-200'}`}>
                          <div className={`text-xs font-semibold flex items-center gap-1.5 ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>
                            <Sparkles className="w-3 h-3" /> AI Reply Suggestions
                          </div>
                          {hasReplies.map((reply, idx) => {
                            const replyKey = `${row.id}-${idx}`;
                            return (
                              <div
                                key={idx}
                                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                  copiedReply === replyKey
                                    ? darkMode ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
                                    : darkMode ? 'bg-stone-800/50 border-stone-700 hover:bg-stone-800' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                                }`}
                                onClick={(e) => { e.stopPropagation(); handleCopyReply(reply, replyKey); }}
                                title="Click to copy"
                              >
                                <div className={`text-xs flex-1 ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>{reply}</div>
                                <Copy className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                                  copiedReply === replyKey
                                    ? 'text-emerald-500'
                                    : darkMode ? 'text-stone-500' : 'text-stone-400'
                                }`} />
                              </div>
                            );
                          })}
                          {copiedReply && copiedReply.startsWith(row.id) && (
                            <div className="text-xs text-emerald-500 font-medium">✓ Copied to clipboard!</div>
                          )}
                        </div>
                      )}
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

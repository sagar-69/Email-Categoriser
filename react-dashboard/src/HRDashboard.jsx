import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Calendar, DollarSign, Users, LogOut, FileText, Inbox, Mail,
  Search, Download, FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import HREmailCard from './HREmailCard';
import HRCategoryChart, { HR_COLOURS, HR_LABELS } from './HRCategoryChart';

const HR_CATEGORIES = [
  { id: 'LEAVE_OD',     label: 'Leave & OD',     color: '#3b82f6', icon: Calendar },
  { id: 'PAYROLL_COMP', label: 'Payroll & Comp', color: '#10b981', icon: DollarSign },
  { id: 'RECRUITMENT',  label: 'Recruitment',    color: '#f59e0b', icon: Users },
  { id: 'OFFBOARDING',  label: 'Offboarding',    color: '#ef4444', icon: LogOut },
  { id: 'HR_ADMIN',     label: 'HR Admin',       color: '#8b5cf6', icon: FileText },
];

const normalizeLabel = (value) => String(value || '').trim().toUpperCase();

const parseEmailTime = (value) => {
  if (!value) return 0;

  const raw = String(value).trim();
  const candidates = [
    raw,
    raw.replace(/\s*\([^)]*\)\s*$/, ''),
    raw.replace(/,\s*/, ', '),
  ];

  for (const candidate of candidates) {
    const time = Date.parse(candidate);
    if (!Number.isNaN(time)) return time;
  }

  const match = raw.match(/(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[+-]\d{4})?)/);
  if (match) {
    const time = Date.parse(match[1]);
    if (!Number.isNaN(time)) return time;
  }

  return 0;
};

const compareNewestFirst = (a, b) => {
  const receivedDiff = parseEmailTime(b.received_at) - parseEmailTime(a.received_at);
  if (receivedDiff !== 0) return receivedDiff;

  const classifiedDiff = parseEmailTime(b.classified_at) - parseEmailTime(a.classified_at);
  if (classifiedDiff !== 0) return classifiedDiff;

  return String(b.id || '').localeCompare(String(a.id || ''));
};

/**
 * HRDashboard — Full HR mode dashboard with metrics, charts, filters, and email list.
 *
 * Props:
 *   emails:    array of HR-classified emails
 *   darkMode:  boolean
 *   onRefresh: function
 *   loading:   boolean
 */
export default function HRDashboard({
  emails,
  darkMode,
  onMarkRead,
  onSuggestReplies,
  replyLoading = {},
  replySuggestions = {},
  copiedReply,
  onCopyReply,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(
    HR_CATEGORIES.map(c => c.id)
  );
  const [sortBy, setSortBy] = useState('Urgent First');

  // Theme helpers
  const bgCard = darkMode ? 'bg-stone-900' : 'bg-white';
  const borderCol = darkMode ? 'border-stone-800' : 'border-stone-200';
  const textMain = darkMode ? 'text-stone-100' : 'text-stone-900';
  const textSub = darkMode ? 'text-stone-400' : 'text-stone-500';

  // Filtered emails (hide read emails)
  const filtered = useMemo(() => {
    return emails.filter(email => {
      // Skip read emails
      if (email.is_read) return false;
      if (!selectedCategories.includes(normalizeLabel(email.hr_category))) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (email.subject && email.subject.toLowerCase().includes(q)) ||
        (email.sender && email.sender.toLowerCase().includes(q)) ||
        (email.hr_reasoning && email.hr_reasoning.toLowerCase().includes(q))
      );
    });
  }, [emails, selectedCategories, searchQuery]);

  // All HR emails matching filters (including read) — for "Total HR" metric
  const allHrFiltered = useMemo(() => {
    return emails.filter(email => {
      if (!selectedCategories.includes(normalizeLabel(email.hr_category))) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (email.subject && email.subject.toLowerCase().includes(q)) ||
        (email.sender && email.sender.toLowerCase().includes(q)) ||
        (email.hr_reasoning && email.hr_reasoning.toLowerCase().includes(q))
      );
    });
  }, [emails, selectedCategories, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const counts = {};
    HR_CATEGORIES.forEach(c => counts[c.id] = 0);
    filtered.forEach(e => {
      const category = normalizeLabel(e.hr_category);
      if (counts[category] !== undefined) counts[category]++;
    });
    return { total: allHrFiltered.length, unread: filtered.length, ...counts };
  }, [filtered, allHrFiltered]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    if (sortBy === 'Urgent First') {
      const priorityOrder = { URGENT: 0, STANDARD: 1, LOW_PRIORITY: 2 };
      rows.sort((a, b) => {
        const priorityDiff = (priorityOrder[normalizeLabel(a.priority_label)] ?? 99) - (priorityOrder[normalizeLabel(b.priority_label)] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return compareNewestFirst(a, b);
      });
    } else if (sortBy === 'Most Recent First') {
      rows.sort(compareNewestFirst);
    } else if (sortBy === 'Action Required First') {
      const actionOrder = { ACTION_REQUIRED: 0, AWAITING_REPLY: 1, FYI: 2, REFERENCE: 3 };
      rows.sort((a, b) => {
        const actionDiff = (actionOrder[normalizeLabel(a.action_label)] ?? 99) - (actionOrder[normalizeLabel(b.action_label)] ?? 99);
        if (actionDiff !== 0) return actionDiff;
        return compareNewestFirst(a, b);
      });
    }
    return rows;
  }, [filtered, sortBy]);

  // Pie chart data
  const chartData = useMemo(() => {
    return HR_CATEGORIES.map(c => ({
      name: c.label,
      value: stats[c.id] || 0,
      key: c.id,
      color: c.color,
    }));
  }, [stats]);

  // Timeline data (emails by day, stacked by HR category)
  const timelineData = useMemo(() => {
    const byDate = {};
    filtered.forEach(e => {
      if (!e.received_at) return;
      const d = e.received_at.slice(0, 10);
      if (!byDate[d]) {
        byDate[d] = { date: d };
        HR_CATEGORIES.forEach(c => byDate[d][c.id] = 0);
      }
      const category = normalizeLabel(e.hr_category);
      if (category && byDate[d][category] !== undefined) {
        byDate[d][category]++;
      }
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // Custom tooltip for timeline chart
  const CustomTooltip = ({ active, payload, label }) => {
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

  // Toggle category filter
  const toggleCategory = (catId) => {
    setSelectedCategories(prev => (
      prev.includes(catId)
        ? prev.filter(c => c !== catId)
        : [...prev, catId]
    ));
  };

  // Export CSV
  const handleExport = () => {
    const headers = ['subject', 'sender', 'sender_email', 'hr_category', 'hr_confidence', 'hr_reasoning', 'received_at'];
    const csv = [
      headers.join(','),
      ...sorted.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inbox_intel_hr_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const headers = ['subject', 'sender', 'sender_email', 'hr_category', 'hr_confidence', 'hr_reasoning', 'received_at'];
    const exportData = sorted.map(row => {
      const obj = {};
      headers.forEach(h => obj[h] = row[h]);
      return obj;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'HR Emails');
    XLSX.writeFile(workbook, 'inbox_intel_hr_export.xlsx');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const headers = [['Subject', 'Sender', 'Category', 'Confidence', 'Reasoning', 'Received']];
    const exportData = sorted.map(row => [
      row.subject,
      row.sender,
      row.hr_category,
      row.hr_confidence,
      row.hr_reasoning,
      row.received_at,
    ]);

    autoTable(doc, {
      head: headers,
      body: exportData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 158, 11] },
    });

    doc.save('inbox_intel_hr_export.pdf');
  };

  return (
    <div className="flex">
      {/* ── HR Sidebar ── */}
      <aside className={`w-64 h-screen sticky top-0 border-r p-5 overflow-y-auto ${borderCol} ${bgCard}`}>
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-6 h-6 text-amber-500" />
          <h2 className={`font-bold text-lg ${textMain}`}>HR Categories</h2>
        </div>

        <div className={`rounded-lg border p-2 ${darkMode ? 'bg-stone-900 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
          <label className={`flex items-center gap-2 py-1.5 mb-1 border-b cursor-pointer hover:opacity-80 ${darkMode ? 'border-stone-800' : 'border-stone-200'}`}>
            <input
              type="checkbox"
              checked={selectedCategories.length === HR_CATEGORIES.length}
              onChange={() => setSelectedCategories(
                selectedCategories.length === HR_CATEGORIES.length
                  ? []
                  : HR_CATEGORIES.map(c => c.id)
              )}
              className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            />
            <span className={`text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>
              All
            </span>
          </label>
          {HR_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <label key={cat.id} className="flex items-center gap-2 py-1.5 cursor-pointer hover:opacity-80">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                />
                <Icon className="w-4 h-4" style={{ color: cat.color }} />
                <span className={`text-sm ${darkMode ? 'text-stone-300' : 'text-stone-600'}`}>
                  {cat.label}
                </span>
                <span className={`ml-auto text-xs font-medium ${textSub}`}>
                  {stats[cat.id] || 0}
                </span>
              </label>
            );
          })}
        </div>

        <div className={`mt-6 pt-4 border-t ${borderCol}`}>
          <p className={`text-sm ${textSub}`}>
            Showing: <span className={textMain}>{filtered.length}</span> of {emails.length} HR emails
          </p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 p-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {/* Total */}
          <div className={`rounded-xl p-4 border transition-colors ${bgCard} ${borderCol}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${textSub}`}>Total HR</span>
              <Inbox className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-indigo-500">{stats.total}</div>
          </div>

          {/* Unread */}
          <div className={`rounded-xl p-4 border transition-colors ${bgCard} ${borderCol}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${textSub}`}>Unread</span>
              <Mail className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-sky-500">{stats.unread}</div>
          </div>

          {/* Category cards */}
          {HR_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.id} className={`rounded-xl p-4 border transition-colors ${bgCard} ${borderCol}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm ${textSub}`}>{cat.label}</span>
                  <Icon className="w-4 h-4" style={{ color: cat.color }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: cat.color }}>
                  {stats[cat.id] || 0}
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Pie Chart */}
          <div className={`rounded-xl border p-4 ${bgCard} ${borderCol}`}>
            <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>HR Category Distribution</h3>
            <HRCategoryChart data={chartData} darkMode={darkMode} />
          </div>

          {/* Emails by Day Timeline */}
          <div className={`rounded-xl border p-4 ${bgCard} ${borderCol}`}>
            <h3 className={`text-sm font-semibold mb-3 ${textMain}`}>Emails by Day</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#44403c' : '#e7e5e4'} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: darkMode ? '#a8a29e' : '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: darkMode ? '#a8a29e' : '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: darkMode ? '#a8a29e' : '#78716c', fontSize: 12 }} />
                {HR_CATEGORIES.map((cat, i) => (
                  <Bar
                    key={cat.id}
                    dataKey={cat.id}
                    name={cat.label}
                    stackId="a"
                    fill={cat.color}
                    radius={i === HR_CATEGORIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Email List Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${textMain}`}>HR Classified Emails</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${textSub}`} />
              <input
                type="text"
                placeholder="Search HR emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-9 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  darkMode
                    ? 'bg-stone-900 border-stone-700 text-stone-200 placeholder-stone-500'
                    : 'bg-white border-stone-200 text-stone-700 placeholder-stone-400'
                }`}
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`text-sm rounded-lg border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                darkMode
                  ? 'bg-stone-900 border-stone-700 text-stone-200'
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <option>Urgent First</option>
              <option>Most Recent First</option>
              <option>Action Required First</option>
            </select>
            <div className={`flex items-center rounded-lg border overflow-hidden ${darkMode ? 'border-stone-700' : 'border-stone-200'}`}>
              <button
                onClick={handleExport}
                title="Export CSV"
                className={`flex items-center justify-center px-3 py-1.5 transition-colors border-r ${
                  darkMode
                    ? 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportExcel}
                title="Export Excel"
                className={`flex items-center justify-center px-3 py-1.5 transition-colors border-r ${
                  darkMode
                    ? 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-500" />
              </button>
              <button
                onClick={handleExportPDF}
                title="Export PDF"
                className={`flex items-center justify-center px-3 py-1.5 transition-colors ${
                  darkMode
                    ? 'bg-stone-900 text-stone-300 hover:bg-stone-800'
                    : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <FileText className="w-4 h-4 text-red-600 dark:text-red-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Email Cards */}
        <div className="space-y-3">
          {sorted.slice(0, 100).map((email) => (
            <HREmailCard
              key={email.id}
              email={email}
              darkMode={darkMode}
              onMarkRead={onMarkRead}
              onSuggestReplies={onSuggestReplies}
              replyLoading={replyLoading[email.id]}
              replySuggestions={replySuggestions[email.id]}
              copiedReply={copiedReply}
              onCopyReply={onCopyReply}
            />
          ))}
          {sorted.length === 0 && (
            <div className={`text-center py-12 ${textSub}`}>
              No HR emails match the selected filters.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

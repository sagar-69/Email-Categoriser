import React, { useState, useMemo } from 'react';
import {
  Calendar, DollarSign, Users, LogOut, FileText, Inbox, Mail,
  Search, Download,
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

/**
 * HRDashboard — Full HR mode dashboard with metrics, charts, filters, and email list.
 *
 * Props:
 *   emails:    array of HR-classified emails
 *   darkMode:  boolean
 *   onRefresh: function
 *   loading:   boolean
 */
export default function HRDashboard({ emails, darkMode, onMarkRead }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(
    HR_CATEGORIES.map(c => c.id)
  );

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
      if (!selectedCategories.includes(email.hr_category)) return false;
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
      if (!selectedCategories.includes(email.hr_category)) return false;
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
      if (counts[e.hr_category] !== undefined) counts[e.hr_category]++;
    });
    return { total: allHrFiltered.length, unread: filtered.length, ...counts };
  }, [filtered, allHrFiltered]);

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
      if (e.hr_category && byDate[d][e.hr_category] !== undefined) {
        byDate[d][e.hr_category]++;
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
    if (selectedCategories.includes(catId)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catId));
    } else {
      setSelectedCategories([...selectedCategories, catId]);
    }
  };

  // Export CSV
  const handleExport = () => {
    const headers = ['subject', 'sender', 'sender_email', 'hr_category', 'hr_confidence', 'hr_reasoning', 'received_at'];
    const csv = [
      headers.join(','),
      ...filtered.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inbox_intel_hr_export.csv';
    a.click();
    URL.revokeObjectURL(url);
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
            <button
              onClick={handleExport}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                darkMode
                  ? 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Email Cards */}
        <div className="space-y-3">
          {filtered.slice(0, 100).map((email) => (
            <HREmailCard key={email.id} email={email} darkMode={darkMode} onMarkRead={onMarkRead} />
          ))}
          {filtered.length === 0 && (
            <div className={`text-center py-12 ${textSub}`}>
              No HR emails match the selected filters.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const HR_COLOURS = {
  LEAVE_OD:     '#3b82f6',
  PAYROLL_COMP: '#10b981',
  RECRUITMENT:  '#f59e0b',
  OFFBOARDING:  '#ef4444',
  HR_ADMIN:     '#8b5cf6',
};

const HR_LABELS = {
  LEAVE_OD:     'Leave & OD',
  PAYROLL_COMP: 'Payroll & Comp',
  RECRUITMENT:  'Recruitment',
  OFFBOARDING:  'Offboarding',
  HR_ADMIN:     'HR Admin',
};

const CustomTooltip = ({ active, payload, darkMode }) => {
  if (!active || !payload) return null;
  return (
    <div className={`rounded-lg border shadow-lg px-3 py-2 ${darkMode ? 'bg-stone-900 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.payload.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

/**
 * HRCategoryChart — Recharts Pie chart for HR category distribution.
 *
 * Props:
 *   data:     array of { name, value, key, color }
 *   darkMode: boolean
 */
export default function HRCategoryChart({ data, darkMode }) {
  const chartText = darkMode ? '#a8a29e' : '#57534e';

  // Filter out zero-value entries
  const filteredData = data.filter(d => d.value > 0);

  if (filteredData.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[280px] text-sm ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>
        No HR data to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={filteredData}
          cx="40%"
          cy="50%"
          outerRadius={100}
          innerRadius={45}
          paddingAngle={3}
          dataKey="value"
          stroke={darkMode ? '#1c1917' : '#ffffff'}
          strokeWidth={2}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={{ stroke: chartText }}
        >
          {filteredData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
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
  );
}

export { HR_COLOURS, HR_LABELS };

import React from 'react';
import { Calendar, DollarSign, Users, LogOut, FileText, CheckCircle } from 'lucide-react';

const HR_CATEGORY_CONFIG = {
  LEAVE_OD:     { label: 'Leave & OD',     color: '#3b82f6', icon: Calendar },
  PAYROLL_COMP: { label: 'Payroll & Comp', color: '#10b981', icon: DollarSign },
  RECRUITMENT:  { label: 'Recruitment',    color: '#f59e0b', icon: Users },
  OFFBOARDING:  { label: 'Offboarding',    color: '#ef4444', icon: LogOut },
  HR_ADMIN:     { label: 'HR Admin',       color: '#8b5cf6', icon: FileText },
};

/**
 * HREmailCard — Renders an individual email card in HR mode.
 *
 * Props:
 *   email:    object with hr_category, hr_confidence, hr_reasoning, subject, sender, etc.
 *   darkMode: boolean
 */
export default function HREmailCard({ email, darkMode }) {
  const cat = HR_CATEGORY_CONFIG[email.hr_category] || HR_CATEGORY_CONFIG.HR_ADMIN;
  const Icon = cat.icon;
  const confidence = parseFloat(email.hr_confidence) || 0;

  const bgCard = darkMode ? 'bg-stone-900' : 'bg-white';
  const borderCol = darkMode ? 'border-stone-800' : 'border-stone-200';
  const textMain = darkMode ? 'text-stone-100' : 'text-stone-900';
  const textSub = darkMode ? 'text-stone-400' : 'text-stone-500';

  return (
    <div className={`rounded-xl border p-4 transition-colors hover:shadow-md ${bgCard} ${borderCol}`}>
      <div className="flex items-start justify-between gap-4">
        {/* Left: Email content */}
        <div className="flex-1 min-w-0">
          <div className={`text-xs mb-1 ${textSub}`}>
            {email.sender} · {email.sender_email}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`text-sm font-semibold truncate ${textMain}`}>
              {email.subject}
            </div>
            {confidence > 0.8 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                <CheckCircle className="w-3 h-3" />
                High Confidence
              </span>
            )}
          </div>
          {email.snippet && (
            <div className={`text-sm mb-2 line-clamp-1 ${darkMode ? 'text-stone-400' : 'text-stone-600'}`}>
              {email.snippet}
            </div>
          )}
          {email.hr_reasoning && (
            <div className={`text-xs italic ${textSub}`}>
              {email.hr_reasoning}
            </div>
          )}
        </div>

        {/* Right: Category badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border"
          style={{
            backgroundColor: `${cat.color}15`,
            color: cat.color,
            borderColor: `${cat.color}30`,
          }}
        >
          <Icon className="w-3.5 h-3.5" />
          {cat.label}
        </div>
      </div>
    </div>
  );
}

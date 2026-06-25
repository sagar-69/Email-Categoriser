import React from 'react';
import {
  Calendar, DollarSign, Users, LogOut, FileText,
  CheckCircle, Sparkles, Loader2, Copy,
} from 'lucide-react';

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
 *   email:      object with hr_category, hr_confidence, hr_reasoning, subject, sender, etc.
 *   darkMode:   boolean
 *   onMarkRead: (emailId) => void — called when an unread email is clicked
 */
export default function HREmailCard({
  email,
  darkMode,
  onMarkRead,
  onSuggestReplies,
  replyLoading = false,
  replySuggestions,
  copiedReply,
  onCopyReply,
}) {
  const cat = HR_CATEGORY_CONFIG[email.hr_category] || HR_CATEGORY_CONFIG.HR_ADMIN;
  const Icon = cat.icon;
  const confidence = parseFloat(email.hr_confidence) || 0;
  const isRead = !!email.is_read;

  const bgCard = darkMode ? 'bg-stone-900' : 'bg-white';
  const borderCol = darkMode ? 'border-stone-800' : 'border-stone-200';
  const textMain = darkMode ? 'text-stone-100' : 'text-stone-900';
  const textSub = darkMode ? 'text-stone-400' : 'text-stone-500';

  const handleClick = () => {
    if (!isRead && onMarkRead) {
      onMarkRead(email.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer ${bgCard} ${borderCol} ${
        isRead ? 'opacity-70' : 'border-l-4 border-l-amber-500'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Email content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className={`text-xs mb-1 ${textSub}`}>
              {email.sender} · {email.sender_email}
            </div>
            {!isRead && (
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 ml-2" title="Unread" />
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`text-sm truncate ${textMain} ${isRead ? 'font-normal' : 'font-semibold'}`}>
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

        {/* Right: Category and actions */}
        <div className="flex flex-col items-end gap-2">
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
          {onSuggestReplies && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSuggestReplies(email.id);
              }}
              disabled={replyLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                darkMode
                  ? 'bg-violet-900/30 border-violet-700/50 text-violet-300 hover:bg-violet-900/50'
                  : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
              } disabled:opacity-50`}
              title="Generate AI reply suggestions"
            >
              {replyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {replyLoading ? 'Thinking...' : 'Suggest Replies'}
            </button>
          )}
        </div>
      </div>

      {replySuggestions && (
        <div className={`mt-3 pt-3 border-t space-y-2 ${darkMode ? 'border-stone-700' : 'border-stone-200'}`}>
          <div className={`text-xs font-semibold flex items-center gap-1.5 ${darkMode ? 'text-violet-300' : 'text-violet-700'}`}>
            <Sparkles className="w-3 h-3" /> AI Reply Suggestions
          </div>
          {replySuggestions.map((reply, idx) => {
            const replyKey = `${email.id}-${idx}`;
            return (
              <div
                key={idx}
                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  copiedReply === replyKey
                    ? darkMode ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
                    : darkMode ? 'bg-stone-800/50 border-stone-700 hover:bg-stone-800' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCopyReply) onCopyReply(reply, replyKey);
                }}
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
          {copiedReply && copiedReply.startsWith(email.id) && (
            <div className="text-xs text-emerald-500 font-medium">Copied to clipboard.</div>
          )}
        </div>
      )}
    </div>
  );
}

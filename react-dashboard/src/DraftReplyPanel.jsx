/**
 * DraftReplyPanel — human-in-the-loop reply composer (v2).
 *
 * Rendered inside each email card for non-SPAM emails.
 * Flow: steer → generate → edit (with diff highlighting) → send → countdown → undo
 *
 * Props:
 *   email       — the email row object (id, subject, sender_email, dept_label, etc.)
 *   darkMode    — boolean
 *   ownerEmail  — optional, multi-account
 *   selectedModel — optional Ollama model override
 *   onSent      — optional callback after the delayed send is confirmed
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Undo2, Loader2, RefreshCw,
  ChevronDown, ChevronUp, Check
} from 'lucide-react';

const API_BASE = '';
const TOKEN_KEY = 'inbox_intel_jwt';

// Quick-intent chips: label → instruction sent to the LLM
const QUICK_INTENTS = [
  { label: 'Accept',           value: 'agree to what\'s being asked' },
  { label: 'Decline politely', value: 'politely decline' },
  { label: 'Ask for more time', value: 'ask for a short extension, propose next week' },
  { label: 'Need more info',   value: 'ask clarifying questions before committing' },
];


// ── Helper: fetch with JWT ──────────────────────────────────────────────────

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshTokenForAccount(ownerEmail) {
  if (!ownerEmail) return false;
  const res = await fetch(`${API_BASE}/api/auth/token?email=${encodeURIComponent(ownerEmail)}`, {
    method: 'POST',
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (!data.token) return false;
  localStorage.setItem(TOKEN_KEY, data.token);
  return true;
}

async function apiFetch(url, options = {}, ownerEmail = null) {
  if (ownerEmail) {
    await refreshTokenForAccount(ownerEmail);
  }
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };
  let res = await fetch(url, { ...options, headers });
  if (res.status === 401 && ownerEmail && await refreshTokenForAccount(ownerEmail)) {
    res = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...getAuthHeaders(),
      },
    });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}


// ── Diff highlighting ───────────────────────────────────────────────────────

function DiffHighlight({ original, edited, darkMode }) {
  if (!original || original === edited) return null;

  const parts = diffWordsLocal(original, edited);
  return (
    <div className={`text-sm whitespace-pre-wrap leading-relaxed p-3 rounded-lg border ${
      darkMode
        ? 'bg-stone-800/50 border-stone-700 text-stone-300'
        : 'bg-stone-50 border-stone-200 text-stone-700'
    }`}>
      {parts.map((part, i) => {
        if (part.removed) return null; // hide removed text
        if (part.added) {
          return (
            <span
              key={i}
              className={`rounded px-0.5 ${
                darkMode
                  ? 'bg-emerald-900/50 text-emerald-300'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </div>
  );
}

function tokenizeForDiff(text) {
  return String(text || '').match(/\s+|[^\s]+/g) || [];
}

function diffWordsLocal(original, edited) {
  const a = tokenizeForDiff(original);
  const b = tokenizeForDiff(edited);
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const parts = [];
  const push = (value, kind = 'same') => {
    if (!value) return;
    const last = parts[parts.length - 1];
    const added = kind === 'added';
    const removed = kind === 'removed';
    if (last && !!last.added === added && !!last.removed === removed) {
      last.value += value;
    } else {
      parts.push({ value, added, removed });
    }
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(a[i], 'removed');
      i += 1;
    } else {
      push(b[j], 'added');
      j += 1;
    }
  }
  while (i < a.length) {
    push(a[i], 'removed');
    i += 1;
  }
  while (j < b.length) {
    push(b[j], 'added');
    j += 1;
  }
  return parts;
}


// ── Main component ──────────────────────────────────────────────────────────

export default function DraftReplyPanel({
  email,
  darkMode = false,
  ownerEmail = null,
  selectedModel = null,
  onSent,
}) {
  // Panel visibility
  const [expanded, setExpanded] = useState(false);

  // Steering
  const [instruction, setInstruction] = useState('');

  // Draft state
  const [originalDraft, setOriginalDraft] = useState('');
  const [editedText, setEditedText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const [error, setError] = useState('');

  // Send state
  const [sendState, setSendState] = useState('idle');
  // idle | countdown | sent | cancelled | failed
  const [countdown, setCountdown] = useState(0);
  const [queueId, setQueueId] = useState(null);
  const countdownRef = useRef(null);
  const sentNotifiedRef = useRef(false);

  const notifySent = useCallback(() => {
    if (sentNotifiedRef.current) return;
    sentNotifiedRef.current = true;
    if (onSent) onSent(email.id);
  }, [email.id, onSent]);

  useEffect(() => {
    sentNotifiedRef.current = false;
  }, [email.id]);

  // ── Generate reply ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (instr) => {
    // Confirm before overwriting edits
    if (hasEdited && editedText !== originalDraft) {
      if (!window.confirm('You have unsaved edits. Regenerate and discard them?')) return;
    }

    setGenerating(true);
    const finalInstruction = instr || instruction || null;

    try {
      const query = new URLSearchParams();
      if (selectedModel) query.set('model_name', selectedModel);
      if (ownerEmail) query.set('owner_email', ownerEmail);
      const qs = query.toString() ? `?${query.toString()}` : '';

      const data = await apiFetch(
        `${API_BASE}/api/emails/${email.id}/generate-reply${qs}`,
        {
          method: 'POST',
          body: JSON.stringify({ instruction: finalInstruction }),
        },
        ownerEmail
      );

      setOriginalDraft(data.draft);
      setEditedText(data.draft);
      setHasEdited(false);
      setSendState('idle');
      setError('');
    } catch (err) {
      console.error('Reply generation failed:', err);
      setError(err.message || 'Reply generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [email.id, instruction, selectedModel, ownerEmail, hasEdited, editedText, originalDraft]);


  // ── Send (queue) ────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (ownerEmail) query.set('owner_email', ownerEmail);
      const qs = query.toString() ? `?${query.toString()}` : '';

      const data = await apiFetch(
        `${API_BASE}/api/emails/${email.id}/queue-send${qs}`,
        {
          method: 'POST',
          body: JSON.stringify({
            text: editedText,
            original_draft: originalDraft,
          }),
        },
        ownerEmail
      );

      setQueueId(data.queue_id);
      setCountdown(data.delay_seconds);
      setSendState('countdown');
      setError('');

      // Start countdown timer
      let remaining = data.delay_seconds;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          pollSendStatus(data.queue_id);
        }
      }, 1000);

    } catch (err) {
      console.error('Queue send failed:', err);
      setError(err.message || 'Send failed.');
      setSendState('failed');
    }
  }, [email.id, editedText, originalDraft, ownerEmail]);

  const pollSendStatus = useCallback(async (id) => {
    const startedAt = Date.now();
    const timeoutMs = 10000;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const data = await apiFetch(
          `${API_BASE}/api/pending-sends/${id}`,
          { method: 'GET' },
          ownerEmail
        );
        if (data.status === 'sent') {
          setSendState('sent');
          setQueueId(null);
          setError('');
          notifySent();
          return;
        }
        if (data.status === 'failed') {
          setSendState('failed');
          setError('The delayed send failed. The Gmail draft may still be available.');
          return;
        }
        if (data.status === 'cancelled') {
          setSendState('idle');
          setQueueId(null);
          return;
        }
      } catch (err) {
        console.error('Send status check failed:', err);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setSendState('failed');
    setError('Could not confirm whether Gmail sent the draft. Check Gmail drafts/sent mail before retrying.');
  }, [notifySent, ownerEmail]);


  // ── Undo (cancel) ──────────────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    try {
      await apiFetch(
        `${API_BASE}/api/pending-sends/${queueId}/cancel`,
        { method: 'POST' },
        ownerEmail
      );
      setSendState('idle');
      setQueueId(null);
      setError('');
    } catch (err) {
      console.error('Cancel failed:', err);
      // If 409 it was already sent
      setSendState('sent');
      setError('Undo window already closed.');
      notifySent();
    }
  }, [notifySent, queueId, ownerEmail]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);


  // ── Styles ────────────────────────────────────────────────────────────

  const borderCol = darkMode ? 'border-stone-700' : 'border-stone-200';
  const bgPanel = darkMode ? 'bg-stone-800/30' : 'bg-stone-50/80';
  const textMain = darkMode ? 'text-stone-200' : 'text-stone-800';
  const textSub = darkMode ? 'text-stone-400' : 'text-stone-500';
  const inputBg = darkMode
    ? 'bg-stone-800 border-stone-600 text-stone-200 placeholder:text-stone-500'
    : 'bg-white border-stone-300 text-stone-800 placeholder:text-stone-400';
  const chipBase = darkMode
    ? 'bg-stone-700/50 border-stone-600 text-stone-300 hover:bg-stone-700'
    : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-100';
  const primaryBtn = darkMode
    ? 'bg-violet-600 hover:bg-violet-500 text-white'
    : 'bg-violet-600 hover:bg-violet-700 text-white';
  const dangerBtn = darkMode
    ? 'bg-amber-700 hover:bg-amber-600 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white';
  const originalEmailText = email.body_preview || email.snippet || '';


  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className={`mt-3 pt-3 border-t ${borderCol}`}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
          darkMode
            ? 'text-violet-400 hover:text-violet-300'
            : 'text-violet-600 hover:text-violet-700'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Draft Reply
        {expanded
          ? <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
        }
      </button>

      {expanded && (
        <div className={`mt-3 space-y-3 p-3 rounded-lg ${bgPanel} ${borderCol} border`}>

          {/* ── Steering input ────────────────────────────────────── */}
          <div>
            <label className={`text-xs font-medium block mb-1.5 ${textSub}`}>
              Steer the reply (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. say no politely, ask for Monday"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                disabled={generating || sendState === 'countdown'}
                className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-colors ${inputBg} focus:outline-none focus:ring-2 focus:ring-violet-500/50`}
                onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
              />
              <button
                onClick={() => handleGenerate()}
                disabled={generating || sendState === 'countdown'}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${primaryBtn} disabled:opacity-50`}
              >
                {generating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting...</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Draft reply</>
                }
              </button>
            </div>

            {/* Quick-intent chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_INTENTS.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => {
                    setInstruction(chip.value);
                    handleGenerate(chip.value);
                  }}
                  disabled={generating || sendState === 'countdown'}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all ${chipBase} disabled:opacity-50`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {originalEmailText && (
            <div>
              <label className={`text-xs font-medium block mb-1.5 ${textSub}`}>
                Original email
              </label>
              <div className={`text-sm whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto p-3 rounded-lg border ${
                darkMode
                  ? 'bg-stone-900/60 border-stone-700 text-stone-300'
                  : 'bg-white border-stone-200 text-stone-700'
              }`}>
                {originalEmailText}
              </div>
            </div>
          )}

          {/* ── Draft editor ──────────────────────────────────────── */}
          {error && (
            <div className={`text-xs rounded-lg border px-3 py-2 ${
              darkMode
                ? 'bg-red-950/40 border-red-800 text-red-300'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {error}
            </div>
          )}

          {originalDraft && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-medium ${textSub}`}>
                    Draft reply {hasEdited && '· edits highlighted below'}
                  </label>
                  <button
                    onClick={() => handleGenerate()}
                    disabled={generating || sendState === 'countdown'}
                    className={`flex items-center gap-1 text-xs ${textSub} hover:${textMain} transition-colors disabled:opacity-50`}
                    title="Regenerate"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </button>
                </div>

                <textarea
                  value={editedText}
                  onChange={e => {
                    setEditedText(e.target.value);
                    setHasEdited(true);
                  }}
                  disabled={sendState === 'countdown' || sendState === 'sent'}
                  rows={6}
                  className={`w-full text-sm px-3 py-2 rounded-lg border resize-y transition-colors ${inputBg} focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-60`}
                />
              </div>

              {/* Diff highlight (only when user has edited) */}
              {hasEdited && editedText !== originalDraft && (
                <div>
                  <label className={`text-xs font-medium block mb-1.5 ${textSub}`}>
                    Changes from AI draft
                  </label>
                  <DiffHighlight
                    original={originalDraft}
                    edited={editedText}
                    darkMode={darkMode}
                  />
                </div>
              )}

              {/* ── Action bar ──────────────────────────────────────── */}
              <div className="flex items-center justify-between">
                {sendState === 'idle' && (
                  <button
                    onClick={handleSend}
                    disabled={!editedText.trim()}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${primaryBtn} disabled:opacity-50`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                )}

                {sendState === 'countdown' && (
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${textMain}`}>
                      Saved as Gmail draft · Sending in {countdown}s...
                    </span>
                    <button
                      onClick={handleUndo}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${dangerBtn}`}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Undo
                    </button>
                  </div>
                )}

                {sendState === 'sent' && (
                  <div className="flex items-center gap-1.5 text-emerald-500 text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Sent ✓
                  </div>
                )}

                {sendState === 'failed' && (
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-sm">Send failed</span>
                    <button
                      onClick={handleSend}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${primaryBtn}`}
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div /> {/* spacer */}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

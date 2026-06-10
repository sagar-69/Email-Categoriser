import React, { useState } from 'react';
import { Mail, Shield, Cpu, Lock, Trash2, X } from 'lucide-react';

/**
 * AccountSelector — Full-page login screen with animated effects.
 *
 * Props:
 *   accounts:        { email, name, picture }[] — linked accounts
 *   onLogin:         () => void — trigger Google OAuth login
 *   onSelect:        (email) => void — select an account
 *   onRemove:        (email) => void — remove an account
 *   selectedAccount: string | null
 */
export default function AccountSelector({ accounts, onLogin, onSelect, onRemove, selectedAccount }) {
  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="login-grid" />
      </div>

      <div className="login-container">
        {/* Logo / Branding */}
        <div className="login-brand">
          <div className="login-logo">
            <div className="login-logo-inner">
              <Mail className="login-logo-icon" />
            </div>
            <div className="login-logo-ring" />
          </div>
          <h1 className="login-title">Inbox Intel</h1>
          <p className="login-subtitle">
            Privacy-first AI email classification — powered by local LLM
          </p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          {/* Card Header */}
          <div className="login-card-header">
            <h2 className="login-card-title">Connect Your Gmail</h2>
            <p className="login-card-desc">
              Sign in with Google to start classifying your emails with local AI.
            </p>
          </div>

          {/* Existing accounts */}
          {accounts.length > 0 && (
            <div className="login-accounts">
              <p className="login-accounts-label">Linked Accounts</p>
              <div className="login-accounts-list">
                {accounts.map((acct, idx) => {
                  const email = acct.email;
                  return (
                    <div
                      key={email}
                      className={`login-account-row ${selectedAccount === email ? 'active' : ''}`}
                      style={{ animationDelay: `${idx * 0.08}s` }}
                      onClick={() => onSelect(email)}
                    >
                      <div className="login-account-info">
                        {acct.picture ? (
                          <img
                            src={acct.picture}
                            alt={acct.name || email}
                            className="login-account-avatar"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={`login-account-avatar-fallback ${selectedAccount === email ? 'active' : ''}`}>
                            {email[0].toUpperCase()}
                          </div>
                        )}
                        <div className="login-account-text">
                          {acct.name && <span className="login-account-name">{acct.name}</span>}
                          <span className="login-account-email">{email}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(email); }}
                        className="login-remove-btn"
                        title="Remove account"
                      >
                        <Trash2 className="login-remove-icon" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Login Button */}
          <div className="login-button-area">
            <button onClick={onLogin} className="login-google-btn">
              <div className="login-google-btn-shine" />
              <svg className="login-google-icon" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{accounts.length > 0 ? 'Add Another Account' : 'Sign in with Google'}</span>
            </button>
          </div>
        </div>

        {/* Trust badges */}
        <div className="login-badges">
          <div className="login-badge">
            <div className="login-badge-icon green">
              <Lock className="w-5 h-5" />
            </div>
            <span className="login-badge-text">Read-only access</span>
          </div>
          <div className="login-badge">
            <div className="login-badge-icon blue">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="login-badge-text">Local AI only</span>
          </div>
          <div className="login-badge">
            <div className="login-badge-icon purple">
              <Shield className="w-5 h-5" />
            </div>
            <span className="login-badge-text">Zero data sharing</span>
          </div>
        </div>

        <p className="login-footer">
          Your emails never leave your machine. All AI processing is local via Ollama.
        </p>
      </div>

      <style>{`
        /* ── Login Page Layout ──────────────────────────────────────────── */
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #0a0a0f;
        }

        /* ── Animated Background ───────────────────────────────────────── */
        .login-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: orbFloat 12s ease-in-out infinite;
        }

        .login-orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #3b82f6 0%, transparent 70%);
          top: -200px; left: -100px;
          animation-delay: 0s;
        }

        .login-orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
          bottom: -150px; right: -100px;
          animation-delay: -4s;
          animation-duration: 15s;
        }

        .login-orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
          top: 50%; left: 60%;
          animation-delay: -8s;
          animation-duration: 18s;
        }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: gridPan 20s linear infinite;
        }

        @keyframes gridPan {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }

        /* ── Container ─────────────────────────────────────────────────── */
        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          padding: 0 24px;
          animation: fadeSlideUp 0.8s ease-out;
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Brand / Logo ──────────────────────────────────────────────── */
        .login-brand {
          text-align: center;
          margin-bottom: 40px;
        }

        .login-logo {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        .login-logo-inner {
          width: 80px; height: 80px;
          border-radius: 20px;
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 20px 40px rgba(99, 102, 241, 0.3);
          position: relative;
          z-index: 1;
          animation: logoPulse 3s ease-in-out infinite;
        }

        @keyframes logoPulse {
          0%, 100% { box-shadow: 0 20px 40px rgba(99, 102, 241, 0.3); }
          50% { box-shadow: 0 20px 60px rgba(99, 102, 241, 0.5); }
        }

        .login-logo-icon {
          width: 40px; height: 40px;
          color: white;
        }

        .login-logo-ring {
          position: absolute;
          width: 100px; height: 100px;
          border-radius: 24px;
          border: 2px solid rgba(99, 102, 241, 0.2);
          animation: ringPulse 3s ease-in-out infinite;
        }

        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0; }
        }

        .login-title {
          font-size: 2rem;
          font-weight: 800;
          color: white;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }

        .login-subtitle {
          font-size: 0.875rem;
          color: #78716c;
          margin: 0;
        }

        /* ── Card ──────────────────────────────────────────────────────── */
        .login-card {
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(28, 25, 23, 0.8);
          backdrop-filter: blur(20px);
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          overflow: hidden;
          animation: cardEntry 0.9s ease-out 0.2s both;
        }

        @keyframes cardEntry {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .login-card-header {
          padding: 28px 28px 20px;
        }

        .login-card-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: white;
          margin: 0 0 6px;
        }

        .login-card-desc {
          font-size: 0.875rem;
          color: #78716c;
          margin: 0;
          line-height: 1.5;
        }

        /* ── Accounts List ─────────────────────────────────────────────── */
        .login-accounts {
          padding: 0 28px 20px;
        }

        .login-accounts-label {
          font-size: 0.7rem;
          color: #57534e;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
          margin: 0 0 12px;
        }

        .login-accounts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .login-account-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: accountSlideIn 0.5s ease-out both;
        }

        @keyframes accountSlideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .login-account-row:hover {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          transform: translateX(4px);
        }

        .login-account-row.active {
          border-color: rgba(56, 189, 248, 0.3);
          background: rgba(56, 189, 248, 0.08);
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.05);
        }

        .login-account-row.removing {
          animation: accountRemove 0.4s ease-in forwards;
        }

        @keyframes accountRemove {
          to { opacity: 0; transform: translateX(60px) scale(0.95); height: 0; padding: 0; margin: 0; overflow: hidden; }
        }

        .login-account-info {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .login-account-avatar {
          width: 40px; height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255,255,255,0.1);
          flex-shrink: 0;
          transition: border-color 0.3s;
        }

        .login-account-row.active .login-account-avatar {
          border-color: rgba(56, 189, 248, 0.4);
        }

        .login-account-avatar-fallback {
          width: 40px; height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 700;
          background: #292524;
          color: #a8a29e;
          border: 2px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          transition: all 0.3s;
        }

        .login-account-avatar-fallback.active {
          background: #0ea5e9;
          color: white;
          border-color: rgba(56, 189, 248, 0.4);
        }

        .login-account-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .login-account-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #e7e5e4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .login-account-email {
          font-size: 0.75rem;
          color: #78716c;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Remove Button ─────────────────────────────────────────────── */
        .login-remove-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #57534e;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.25s;
          flex-shrink: 0;
          font-weight: 500;
        }

        .login-remove-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .login-remove-btn.confirming {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.2);
          animation: confirmShake 0.3s ease-out;
        }

        @keyframes confirmShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }

        .login-remove-icon {
          width: 14px; height: 14px;
        }

        /* ── Google Button ─────────────────────────────────────────────── */
        .login-button-area {
          padding: 0 28px 28px;
        }

        .login-google-btn {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 14px 24px;
          border-radius: 14px;
          border: none;
          background: white;
          color: #1c1917;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }

        .login-google-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }

        .login-google-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .login-google-btn-shine {
          position: absolute;
          top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          transform: skewX(-25deg);
          animation: btnShine 4s ease-in-out infinite;
        }

        @keyframes btnShine {
          0%, 80%, 100% { left: -100%; }
          40% { left: 150%; }
        }

        .login-google-icon {
          width: 20px; height: 20px;
          flex-shrink: 0;
        }

        /* ── Trust Badges ──────────────────────────────────────────────── */
        .login-badges {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 32px;
          animation: fadeSlideUp 0.8s ease-out 0.5s both;
        }

        .login-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 8px;
        }

        .login-badge-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          transition: all 0.3s;
        }

        .login-badge-icon.green { color: #34d399; }
        .login-badge-icon.blue { color: #38bdf8; }
        .login-badge-icon.purple { color: #a78bfa; }

        .login-badge:hover .login-badge-icon {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }

        .login-badge:hover .login-badge-icon.green { background: rgba(52, 211, 153, 0.1); border-color: rgba(52, 211, 153, 0.2); }
        .login-badge:hover .login-badge-icon.blue { background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.2); }
        .login-badge:hover .login-badge-icon.purple { background: rgba(167, 139, 250, 0.1); border-color: rgba(167, 139, 250, 0.2); }

        .login-badge-text {
          font-size: 0.75rem;
          color: #57534e;
        }

        /* ── Footer ────────────────────────────────────────────────────── */
        .login-footer {
          text-align: center;
          font-size: 0.75rem;
          color: #44403c;
          margin-top: 24px;
          animation: fadeSlideUp 0.8s ease-out 0.7s both;
        }
      `}</style>
    </div>
  );
}

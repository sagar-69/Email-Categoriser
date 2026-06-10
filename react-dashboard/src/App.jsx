import { useState, useEffect, useCallback } from 'react';
import InboxDashboard from './InboxDashboard';
import AccountSelector from './AccountSelector';
import ConfirmRemoveModal from './ConfirmRemoveModal';

function App() {
  // accounts is now an array of { email, name, picture } objects
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountToRemove, setAccountToRemove] = useState(null);

  // Check URL params for auth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authEmail = params.get('auth_email');
    const authError = params.get('auth_error');

    if (authEmail) {
      setSelectedAccount(authEmail);
      localStorage.setItem('inbox_intel_account', authEmail);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (authError) {
      console.error('Auth error:', authError);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load accounts from backend (now returns objects with email, name, picture)
  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch('/api/auth/accounts');
      if (res.ok) {
        const data = await res.json();
        const accountList = data.accounts || [];
        setAccounts(accountList);

        // If no account selected, try localStorage or use first account
        if (!selectedAccount) {
          const stored = localStorage.getItem('inbox_intel_account');
          const emails = accountList.map(a => a.email);
          if (stored && emails.includes(stored)) {
            setSelectedAccount(stored);
          } else if (accountList.length > 0) {
            setSelectedAccount(accountList[0].email);
            localStorage.setItem('inbox_intel_account', accountList[0].email);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSelectAccount = useCallback((email) => {
    setSelectedAccount(email);
    localStorage.setItem('inbox_intel_account', email);
  }, []);

  const handleLogin = useCallback(() => {
    window.location.href = '/api/auth/login';
  }, []);

  const requestRemoveAccount = useCallback((email) => {
    const acct = accounts.find(a => a.email === email);
    if (acct) {
      setAccountToRemove(acct);
    }
  }, [accounts]);

  const confirmRemoveAccount = useCallback(async () => {
    if (!accountToRemove) return;
    const email = accountToRemove.email;
    try {
      const res = await fetch(`/api/auth/accounts/${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (res.ok) {
        const newAccounts = accounts.filter(a => a.email !== email);
        setAccounts(newAccounts);
        if (selectedAccount === email) {
          if (newAccounts.length > 0) {
            setSelectedAccount(newAccounts[0].email);
            localStorage.setItem('inbox_intel_account', newAccounts[0].email);
          } else {
            setSelectedAccount(null);
            localStorage.removeItem('inbox_intel_account');
          }
        }
      }
    } catch (err) {
      console.error('Failed to remove account:', err);
    } finally {
      setAccountToRemove(null);
    }
  }, [accounts, selectedAccount, accountToRemove]);

  // Find the currently selected account object
  const selectedAccountObj = accounts.find(a => a.email === selectedAccount) || null;

  // Show login screen if no accounts exist
  if (!loadingAccounts && accounts.length === 0) {
    return (
      <AccountSelector
        accounts={[]}
        onLogin={handleLogin}
        onSelect={() => {}}
        onRemove={() => {}}
        selectedAccount={null}
      />
    );
  }

  return (
    <div className="w-full min-h-screen">
      <InboxDashboard
        ownerEmail={selectedAccount}
        ownerAccount={selectedAccountObj}
        accounts={accounts}
        onSelectAccount={handleSelectAccount}
        onLogin={handleLogin}
        onRemoveAccount={requestRemoveAccount}
      />
      <ConfirmRemoveModal 
        isOpen={!!accountToRemove} 
        account={accountToRemove} 
        onConfirm={confirmRemoveAccount} 
        onCancel={() => setAccountToRemove(null)}
        darkMode={false} // Match default dashboard or get from local storage if available
      />
    </div>
  );
}

export default App;

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmRemoveModal({ isOpen, account, onConfirm, onCancel, darkMode }) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setIsClosing(false);
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onCancel();
    }, 300);
  };

  const handleConfirm = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onConfirm();
    }, 300);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center ${isOpen && !isClosing ? 'animate-in fade-in duration-200' : 'animate-out fade-out duration-300'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div 
        className={`relative w-full max-w-md p-6 rounded-2xl shadow-2xl overflow-hidden border ${
          darkMode 
            ? 'bg-stone-900 border-stone-800' 
            : 'bg-white border-stone-200'
        } ${isOpen && !isClosing ? 'animate-in zoom-in-95 slide-in-from-bottom-4 duration-300' : 'animate-out zoom-out-95 slide-out-to-bottom-4 duration-300'}`}
      >
        {/* Header Icon */}
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className={`absolute inset-0 rounded-full blur-md ${darkMode ? 'bg-red-500/20' : 'bg-red-500/30'}`} />
            <div className={`relative w-14 h-14 rounded-full flex items-center justify-center border-4 ${
              darkMode ? 'bg-stone-800 border-stone-900' : 'bg-white border-white'
            }`}>
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-7">
          <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-stone-900'}`}>
            Remove Account?
          </h2>
          <p className={`text-sm px-2 ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>
            Are you sure you want to remove the Google account for <span className="font-semibold">{account?.email}</span>? You will need to sign in again to use it.
          </p>
        </div>

        {/* Account Preview */}
        {account && (
          <div className={`flex items-center gap-3 p-3 rounded-xl mb-7 border ${
            darkMode ? 'bg-stone-800/50 border-stone-700' : 'bg-stone-50 border-stone-200'
          }`}>
            {account.picture ? (
              <img 
                src={account.picture} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover ring-2 ring-stone-200 dark:ring-stone-700" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                darkMode ? 'bg-stone-700 text-stone-300' : 'bg-stone-200 text-stone-600'
              }`}>
                {account.email[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              {account.name && (
                <div className={`text-sm font-semibold truncate ${darkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                  {account.name}
                </div>
              )}
              <div className={`text-xs truncate ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                {account.email}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
              darkMode 
                ? 'bg-stone-800 text-stone-300 hover:bg-stone-700' 
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all hover:shadow-red-500/40 active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Brain, Briefcase, X, Sparkles } from 'lucide-react';

/**
 * ClassificationModeModal — First-visit popup for selecting classification mode.
 *
 * Props:
 *   isOpen:   boolean — whether the modal is visible
 *   onSelect: (mode: 'standard' | 'hr' | null, remember: boolean) => void
 *   darkMode: boolean
 */
export default function ClassificationModeModal({ isOpen, onSelect, darkMode }) {
  const [selected, setSelected] = useState('standard');
  const [remember, setRemember] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelect(selected, remember);
  };

  const handleCancel = () => {
    onSelect(null, false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />

      {/* Modal Card */}
      <div className={`relative w-[480px] rounded-xl shadow-2xl overflow-hidden ${darkMode ? 'bg-stone-800' : 'bg-white'}`}>
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white" />
            <h2 className="text-lg font-bold text-white">Choose Classification Mode</h2>
          </div>
          <button onClick={handleCancel} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className={`text-sm mb-5 ${darkMode ? 'text-stone-400' : 'text-stone-600'}`}>
            How would you like to classify your emails?
          </p>

          {/* Option Cards */}
          <div className="space-y-3">
            {/* Standard AI */}
            <button
              onClick={() => setSelected('standard')}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                selected === 'standard'
                  ? darkMode
                    ? 'border-indigo-500 bg-indigo-900/20'
                    : 'border-indigo-500 bg-indigo-50'
                  : darkMode
                    ? 'border-stone-700 bg-stone-900 hover:border-stone-600'
                    : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selected === 'standard' ? 'bg-indigo-100 text-indigo-600' : darkMode ? 'bg-stone-800 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <div className={`font-semibold ${darkMode ? 'text-stone-100' : 'text-stone-900'}`}>STANDARD AI</div>
                    <div className={`text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>4-Dimension Classification</div>
                    <div className={`text-xs mt-1 ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>Email Type · Action · Dept · Priority</div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selected === 'standard' ? 'border-indigo-500 bg-indigo-500' : darkMode ? 'border-stone-600' : 'border-stone-300'
                }`}>
                  {selected === 'standard' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </button>

            {/* HR Classification */}
            <button
              onClick={() => setSelected('hr')}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                selected === 'hr'
                  ? darkMode
                    ? 'border-amber-500 bg-amber-900/20'
                    : 'border-amber-400 bg-amber-50'
                  : darkMode
                    ? 'border-stone-700 bg-stone-900 hover:border-stone-600'
                    : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selected === 'hr' ? 'bg-amber-100 text-amber-600' : darkMode ? 'bg-stone-800 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <div className={`font-semibold ${darkMode ? 'text-stone-100' : 'text-stone-900'}`}>HR CLASSIFICATION</div>
                    <div className={`text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>5 HR Categories</div>
                    <div className={`text-xs mt-1 ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>Leave · Payroll · Recruitment · Offboard · Admin</div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selected === 'hr' ? 'border-amber-500 bg-amber-500' : darkMode ? 'border-stone-600' : 'border-stone-300'
                }`}>
                  {selected === 'hr' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </button>
          </div>

          {/* Remember checkbox */}
          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className={`text-sm ${darkMode ? 'text-stone-400' : 'text-stone-600'}`}>
              Remember my choice for this session
            </span>
          </label>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={handleCancel}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                darkMode
                  ? 'border-stone-600 text-stone-300 hover:bg-stone-700'
                  : 'border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

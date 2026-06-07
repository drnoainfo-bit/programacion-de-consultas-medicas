/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, Trash2, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const colorClasses = {
    danger: {
      bg: 'bg-red-50 text-red-600 border-red-100',
      btn: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      iconColor: 'text-red-600'
    },
    warning: {
      bg: 'bg-amber-50 text-amber-600 border-amber-100',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
      iconColor: 'text-amber-600'
    },
    info: {
      bg: 'bg-blue-50 text-blue-600 border-blue-100',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
      iconColor: 'text-blue-600'
    },
    success: {
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
      iconColor: 'text-emerald-600'
    }
  };

  const scheme = colorClasses[type];

  // Pick suitable heading icon
  let HeaderIcon = AlertCircle;
  if (type === 'danger') {
    HeaderIcon = Trash2;
  } else if (type === 'info') {
    HeaderIcon = HelpCircle;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" id="confirm-modal-overlay">
      <div 
        className="bg-white rounded-2xl max-w-md w-full border border-slate-200/80 shadow-2xl p-6 space-y-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        id="confirm-modal-box"
      >
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl border shrink-0 ${scheme.bg}`} id="confirm-modal-icon-wrapper">
            <HeaderIcon className={`w-5 h-5 ${scheme.iconColor}`} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800" id="confirm-modal-title">{title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed" id="confirm-modal-message">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100" id="confirm-modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            id="btn-confirm-cancel"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${scheme.btn}`}
            id="btn-confirm-accept"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

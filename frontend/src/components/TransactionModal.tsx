import React from 'react';
import { X, ShieldAlert, CheckCircle2, Clock, Globe, Laptop, DollarSign, Tag, Info } from './Icons';
import { Transaction } from '../types';

interface TransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ transaction, onClose }) => {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-black/80 font-mono">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-cyan-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white font-sans">Transaction Telemetry Audit</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                {transaction.id}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">DynamoDB Audit Trail Record • User: {transaction.user_id}</p>
          </div>
        </div>

        {/* High-level summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 font-sans">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-cyan-400" /> Amount
            </span>
            <span className="text-base font-bold text-white font-mono mt-0.5 block">
              ${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block flex items-center gap-1">
              <Tag className="w-3 h-3 text-cyan-400" /> Category
            </span>
            <span className="text-sm font-semibold text-slate-200 mt-0.5 block font-mono">
              {transaction.category}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" /> Status
            </span>
            <span className="text-sm font-semibold text-slate-200 mt-0.5 block font-mono">
              {transaction.status}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" /> Risk Score
            </span>
            <span className={`text-base font-bold font-mono mt-0.5 block ${
              transaction.risk_score >= 75
                ? 'text-rose-400'
                : transaction.risk_score >= 50
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {transaction.risk_score}/100 ({transaction.risk_level})
            </span>
          </div>
        </div>

        {/* Recipient Details */}
        <div className="mb-4 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
          <div className="text-xs text-slate-400 font-sans mb-1">Recipient / Merchant Account</div>
          <div className="text-sm font-semibold text-white font-sans">{transaction.recipient}</div>
          {transaction.notes && (
            <div className="text-xs text-slate-400 font-sans mt-1 bg-slate-900/80 p-2 rounded border border-slate-800">
              Note: {transaction.notes}
            </div>
          )}
        </div>

        {/* Adaptive Risk Engine Insights */}
        <div className="mb-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="text-xs font-semibold text-slate-300 font-sans flex items-center space-x-1.5 mb-2">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Adaptive Risk Engine Explanations</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
            {transaction.risk_reasons.map((r, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-cyan-400 font-mono mt-0.5">▸</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Device & Geolocation Telemetry */}
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400 font-sans">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-slate-400" />
            <span>IP: <strong className="text-slate-200 font-mono">{transaction.metadata?.ip || '127.0.0.1'}</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <Laptop className="w-4 h-4 text-slate-400" />
            <span>Device: <strong className="text-slate-200 font-mono">{transaction.metadata?.device || 'Standard Client'}</strong></span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end font-sans">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            Dismiss Telemetry
          </button>
        </div>
      </div>
    </div>
  );
};

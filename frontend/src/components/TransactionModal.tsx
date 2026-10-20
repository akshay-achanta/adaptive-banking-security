import React from 'react';
import { X, ShieldAlert, CheckCircle2, Clock, Globe, Laptop, DollarSign, Tag, Info, AlertTriangle } from './Icons';
import { Transaction } from '../types';

interface TransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onReportRecipient?: (recipient: string) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  transaction,
  onClose,
  onReportRecipient,
}) => {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-black/80 font-sans my-8">
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
              <h2 className="text-lg font-bold text-white">Transaction Telemetry & Explainability</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                {transaction.id}
              </span>
            </div>
            <p className="text-xs text-slate-400">Adaptive Risk Decision Engine • User: {transaction.user_id}</p>
          </div>
        </div>

        {/* Cooling-off or New Beneficiary Alert Banner */}
        {transaction.cooling_off_active && (
          <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2.5">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-200">Cooling-Off Security Hold Active</div>
              <p className="text-[11px] text-amber-300/90 mt-0.5">
                This transfer to a newly added recipient exceeds $1,000.00 and is subject to a 24-hour cooling-off safety window to prevent push-payment scams. Step-up 2FA verification is required.
              </p>
            </div>
          </div>
        )}

        {/* High-level summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
            <span
              className={`text-base font-bold font-mono mt-0.5 block ${
                transaction.risk_score >= 75
                  ? 'text-rose-400'
                  : transaction.risk_score >= 50
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {transaction.risk_score}/100 ({transaction.risk_level})
            </span>
          </div>
        </div>

        {/* Recipient Details & Report Action */}
        <div className="mb-4 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 mb-0.5 flex items-center space-x-1.5">
              <span>Recipient / Merchant Account</span>
              {transaction.is_new_beneficiary && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  New Beneficiary
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-white">{transaction.recipient}</div>
            {transaction.notes && (
              <div className="text-xs text-slate-400 mt-1 bg-slate-900/80 p-2 rounded border border-slate-800 font-mono">
                Note: {transaction.notes}
              </div>
            )}
          </div>
          {onReportRecipient && (
            <button
              onClick={() => onReportRecipient(transaction.recipient)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Report Recipient</span>
            </button>
          )}
        </div>

        {/* Feature 2: Explainable Risk Decision Matrix (0-100 Breakdown) */}
        <div className="mb-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Feature 2: Explainable Risk Decisions</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Total Score: <strong className="text-white">{transaction.risk_score}</strong>/100
            </span>
          </div>

          {transaction.risk_factors && transaction.risk_factors.length > 0 ? (
            <div className="space-y-2">
              {transaction.risk_factors.map((f, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200">{f.factor}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-400">
                        {f.severity}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{f.description}</div>
                  </div>
                  <div className="text-right pl-3">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                      +{f.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-300">
              {transaction.risk_reasons.map((r, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-cyan-400 font-mono mt-0.5">▸</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Device & Geolocation Telemetry */}
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-slate-400" />
            <span>
              IP Address:{' '}
              <strong className="text-slate-200 font-mono">{transaction.metadata?.ip || '127.0.0.1'}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Laptop className="w-4 h-4 text-slate-400" />
            <span>
              Hardware Device:{' '}
              <strong className="text-slate-200 font-mono">{transaction.metadata?.device || 'Standard Client'}</strong>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            Close Telemetry View
          </button>
        </div>
      </div>
    </div>
  );
};

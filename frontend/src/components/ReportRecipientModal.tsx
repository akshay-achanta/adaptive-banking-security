import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ShieldAlert, CheckCircle2 } from './Icons';
import { apiClient } from '../api/client';

interface ReportRecipientModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRecipient?: string;
  onSuccess?: (recipient: string) => void;
}

export const ReportRecipientModal: React.FC<ReportRecipientModalProps> = ({
  isOpen,
  onClose,
  initialRecipient = '',
  onSuccess,
}) => {
  const [recipient, setRecipient] = useState<string>(initialRecipient);
  const [reason, setReason] = useState<string>('Impersonation or Fake Bank Agent');
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialRecipient) {
      setRecipient(initialRecipient);
    }
  }, [initialRecipient]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recipient.trim()) {
      setError('Please provide the recipient name or account number.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient.reportRecipient({
        recipient: recipient.trim(),
        reason,
        details: details.trim() || undefined,
      });

      setSuccessMsg(res.message || `Recipient '${recipient}' has been reported to fraud ops.`);
      if (onSuccess) {
        onSuccess(recipient.trim());
      }
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl shadow-rose-950/50">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white shadow-lg shadow-rose-600/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Report Suspicious Recipient</h2>
            <p className="text-xs text-rose-300">Feature 1: Fraud Watchlist & Immediate Account Shielding</p>
          </div>
        </div>

        {/* Protective Warning Card */}
        <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/20 text-xs text-slate-300 space-y-1">
          <div className="flex items-center space-x-1.5 text-rose-400 font-semibold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Fraud Prevention Shield</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Reporting a recipient places them on your high-risk security watchlist, blocks automated future transfers, and dispatches a priority incident report to Bank Security Operations.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Recipient Name or Identifier <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. Unknown Wire Escrow or Scam Recipient"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Reason for Report <span className="text-rose-400">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 h-[38px]"
            >
              <option value="Impersonation or Fake Bank Agent">Impersonation or Fake Bank Agent</option>
              <option value="Phishing or Fake Invoice Attempt">Phishing or Fake Invoice Attempt</option>
              <option value="High-Yield Investment / Crypto Scam">High-Yield Investment / Crypto Scam</option>
              <option value="Coerced Transfer / Urgency Pressure">Coerced Transfer / Urgency Pressure</option>
              <option value="Unsolicited or Unknown Beneficiary">Unsolicited or Unknown Beneficiary</option>
              <option value="Other Suspicious Activity">Other Suspicious Activity</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Incident Details (Optional)</label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide context (e.g., received suspicious SMS asking to urgently wire funds to this recipient)..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs resize-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!successMsg}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold shadow-lg shadow-rose-900/30 transition-all disabled:opacity-50"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting Report...' : 'Submit Fraud Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

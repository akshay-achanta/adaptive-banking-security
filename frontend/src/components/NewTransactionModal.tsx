import React, { useState } from 'react';
import { X, Send, AlertTriangle, ShieldCheck, Zap, Globe, Laptop } from './Icons';
import { TransactionCategory, TransactionCreatePayload } from '../types';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: TransactionCreatePayload) => Promise<void>;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [amount, setAmount] = useState<string>('250.00');
  const [recipient, setRecipient] = useState<string>('Global Cloud Services Sydney');
  const [category, setCategory] = useState<TransactionCategory>('PAYMENT');
  const [notes, setNotes] = useState<string>('Development cloud hosting invoice');
  const [isUnusualLocation, setIsUnusualLocation] = useState<boolean>(false);
  const [isNewDevice, setIsNewDevice] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please provide a valid amount greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        amount: parsedAmount,
        currency: 'USD',
        recipient,
        category,
        notes: notes || undefined,
        is_unusual_location: isUnusualLocation,
        is_new_device: isNewDevice,
        ip_address: isUnusualLocation ? '185.220.101.5' : '110.145.20.10',
        device_name: isNewDevice ? 'Unrecognized Android 14 Tor' : 'Authorized Chrome Browser',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (preset: 'low' | 'high' | 'crypto') => {
    if (preset === 'low') {
      setAmount('42.50');
      setRecipient('Sydney Harbour Bakery');
      setCategory('PAYMENT');
      setNotes('Routine daily contactless payment');
      setIsUnusualLocation(false);
      setIsNewDevice(false);
    } else if (preset === 'high') {
      setAmount('16500.00');
      setRecipient('Offshore Capital Syndicate');
      setCategory('TRANSFER');
      setNotes('Urgent cross-border wire transfer');
      setIsUnusualLocation(true);
      setIsNewDevice(true);
    } else if (preset === 'crypto') {
      setAmount('4800.00');
      setRecipient('Decentralized Liquidity Pool');
      setCategory('INVESTMENT');
      setNotes('Digital asset purchase');
      setIsUnusualLocation(false);
      setIsNewDevice(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl shadow-black/80 font-sans">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Simulate Banking Transaction</h2>
            <p className="text-xs text-slate-400">Triggers real-time adaptive risk telemetry evaluation</p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-4 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono text-[11px]">Quick Scenarios:</span>
          <div className="flex space-x-1.5">
            <button
              type="button"
              onClick={() => applyPreset('low')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold"
            >
              Low-Risk $42
            </button>
            <button
              type="button"
              onClick={() => applyPreset('crypto')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-[11px] font-semibold"
            >
              Medium $4.8K
            </button>
            <button
              type="button"
              onClick={() => applyPreset('high')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-500/30 text-[11px] font-semibold"
            >
              Critical $16.5K
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 h-[38px]"
              >
                <option value="TRANSFER">TRANSFER</option>
                <option value="PAYMENT">PAYMENT</option>
                <option value="WITHDRAWAL">WITHDRAWAL</option>
                <option value="DEPOSIT">DEPOSIT</option>
                <option value="INVESTMENT">INVESTMENT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Recipient / Merchant</label>
            <input
              type="text"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. Acme Corp or Satoshi Wire"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Notes / Description (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Settlement for cloud services"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Anomaly simulation toggles */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Behavioral & Telemetry Anomaly Injections
            </span>

            <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <div className="flex items-center space-x-2.5">
                <Globe className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-slate-200 font-medium">Unusual Geolocation / Foreign IP</div>
                  <div className="text-[11px] text-slate-400">Simulate request originating outside habitual jurisdiction</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isUnusualLocation}
                onChange={(e) => setIsUnusualLocation(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <div className="flex items-center space-x-2.5">
                <Laptop className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-slate-200 font-medium">Unrecognized Hardware Fingerprint</div>
                  <div className="text-[11px] text-slate-400">Flag browser headers as brand-new untrusted device</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isNewDevice}
                onChange={(e) => setIsNewDevice(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold shadow-lg shadow-blue-900/30 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Evaluating Risk...' : 'Execute Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

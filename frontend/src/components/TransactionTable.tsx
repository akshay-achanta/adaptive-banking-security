import React from 'react';
import { Search, ChevronLeft, ChevronRight, Eye, ShieldAlert, ArrowUpRight, ArrowDownLeft } from './Icons';
import { Transaction, TransactionStatus } from '../types';

interface TransactionTableProps {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentStatus: string;
  searchQuery: string;
  onPageChange: (newPage: number) => void;
  onStatusChange: (status: string) => void;
  onSearchChange: (search: string) => void;
  onSelectTransaction: (tx: Transaction) => void;
  isLoading?: boolean;
}

const statusBadges: Record<TransactionStatus, { bg: string; text: string; border: string }> = {
  APPROVED: {
    bg: 'bg-emerald-950/60',
    text: 'text-emerald-400',
    border: 'border-emerald-800/60',
  },
  COMPLETED: {
    bg: 'bg-emerald-950/60',
    text: 'text-emerald-400',
    border: 'border-emerald-800/60',
  },
  PENDING: {
    bg: 'bg-blue-950/60',
    text: 'text-blue-400',
    border: 'border-blue-800/60',
  },
  PENDING_VERIFICATION: {
    bg: 'bg-amber-950/60',
    text: 'text-amber-400',
    border: 'border-amber-800/60',
  },
  FLAGGED: {
    bg: 'bg-amber-950/60',
    text: 'text-amber-400',
    border: 'border-amber-800/60',
  },
  REJECTED: {
    bg: 'bg-rose-950/60',
    text: 'text-rose-400',
    border: 'border-rose-800/60',
  },
  BLOCKED: {
    bg: 'bg-red-950/60',
    text: 'text-red-400',
    border: 'border-red-800/60',
  },
  CREATED: {
    bg: 'bg-slate-900/60',
    text: 'text-slate-400',
    border: 'border-slate-800/60',
  },
  FAILED: {
    bg: 'bg-rose-950/60',
    text: 'text-rose-400',
    border: 'border-rose-800/60',
  },
  CANCELLED: {
    bg: 'bg-zinc-900/60',
    text: 'text-zinc-400',
    border: 'border-zinc-800/60',
  },
};

const riskBadgeColors = {
  LOW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  MEDIUM: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  HIGH: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  CRITICAL: 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse',
};

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  total,
  page,
  totalPages,
  currentStatus,
  searchQuery,
  onPageChange,
  onStatusChange,
  onSearchChange,
  onSelectTransaction,
  isLoading,
}) => {
  const statusOptions = ['ALL', 'COMPLETED', 'PENDING', 'FLAGGED', 'REJECTED'];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-xl">
      {/* Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center space-x-2">
            <span>Transaction Telemetry & Ledger</span>
            <span className="text-xs font-mono font-normal text-slate-400">({total} total records)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time adaptive risk verification stream</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search recipient, ID, notes..."
              className="w-full sm:w-64 pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
            />
          </div>

          {/* Status filter chips */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {statusOptions.map((st) => (
              <button
                key={st}
                onClick={() => onStatusChange(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  currentStatus.toUpperCase() === st.toUpperCase()
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table view */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/70 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-mono">
            <tr>
              <th className="py-3 px-4">Transaction ID</th>
              <th className="py-3 px-4">Recipient / Merchant</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Adaptive Risk</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4 text-right">Telemetry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <span>Querying ledger...</span>
                  </div>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <ShieldAlert className="w-8 h-8 text-slate-600" />
                    <p className="font-sans text-sm text-slate-300">No transactions match your current filters</p>
                    <p className="text-xs text-slate-500 font-sans">Simulate a transaction using the top-right button</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const badge = statusBadges[tx.status];
                const riskColor = riskBadgeColors[tx.risk_level];
                const isDeposit = tx.category === 'DEPOSIT';

                return (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectTransaction(tx)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-cyan-400 group-hover:underline">
                      {tx.id}
                    </td>

                    <td className="py-3.5 px-4 font-sans text-slate-200">
                      <div className="font-medium text-white">{tx.recipient}</div>
                      {tx.notes && <div className="text-[11px] text-slate-400 truncate max-w-xs">{tx.notes}</div>}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                        {tx.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`flex items-center font-bold text-sm ${isDeposit ? 'text-emerald-400' : 'text-slate-100'}`}>
                        {isDeposit ? <ArrowDownLeft className="w-3.5 h-3.5 mr-1" /> : <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-slate-400" />}
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-[10px] text-slate-400 ml-1 font-normal">{tx.currency}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${riskColor}`}>
                          {tx.risk_level} ({tx.risk_score})
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.bg} ${badge.text} ${badge.border}`}>
                        {tx.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(tx.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTransaction(tx);
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="View Full Telemetry"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400 font-mono">
        <div>
          Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong>
        </div>
        <div className="flex items-center space-x-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

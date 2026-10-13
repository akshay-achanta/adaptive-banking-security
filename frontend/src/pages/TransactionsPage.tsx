import React from 'react';
import { TransactionTable } from '../components/TransactionTable';
import { Transaction } from '../types';

interface TransactionsPageProps {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentStatus: string;
  searchQuery: string;
  onPageChange: (p: number) => void;
  onStatusChange: (s: string) => void;
  onSearchChange: (q: string) => void;
  onSelectTransaction: (t: Transaction) => void;
  onOpenNewTransaction: () => void;
  isLoading: boolean;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  total,
  page,
  pageSize,
  totalPages,
  currentStatus,
  searchQuery,
  onPageChange,
  onStatusChange,
  onSearchChange,
  onSelectTransaction,
  onOpenNewTransaction,
  isLoading,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Banking Transactions Ledger</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full immutable audit log with DynamoDB persistence schema
          </p>
        </div>

        <button
          onClick={onOpenNewTransaction}
          className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-900/30 transition-all"
        >
          + Simulate New Transaction
        </button>
      </div>

      <TransactionTable
        transactions={transactions}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        currentStatus={currentStatus}
        searchQuery={searchQuery}
        onPageChange={onPageChange}
        onStatusChange={onStatusChange}
        onSearchChange={onSearchChange}
        onSelectTransaction={onSelectTransaction}
        isLoading={isLoading}
      />
    </div>
  );
};

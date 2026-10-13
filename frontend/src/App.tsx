import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from './pages/TransactionsPage';
import { AIInsights } from './pages/AIInsights';
import { Security } from './pages/Security';
import { SecurityWorkflow } from './pages/SecurityWorkflow';
import { Login } from './pages/Login';
import { TransactionModal } from './components/TransactionModal';
import { NewTransactionModal } from './components/NewTransactionModal';
import { api } from './api/client';
import {
  Transaction,
  DashboardStats,
  HealthResponse,
  TransactionCreatePayload,
} from './types';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentStatus, setCurrentStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals state
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState<boolean>(false);

  // Fetch system health
  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (err) {
      console.error('Health check failed:', err);
    }
  }, []);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Fetch transactions with pagination and filters
  const fetchTransactions = useCallback(
    async (page = currentPage, status = currentStatus, search = searchQuery) => {
      try {
        setIsLoading(true);
        const data = await api.getTransactions({
          page,
          pageSize: 10,
          status,
          search,
        });
        setTransactions(data.items);
        setTotalTransactions(data.total);
        setCurrentPage(data.page);
        setTotalPages(data.total_pages);
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [currentPage, currentStatus, searchQuery]
  );

  const refreshAll = useCallback(() => {
    fetchHealth();
    fetchStats();
    fetchTransactions(currentPage, currentStatus, searchQuery);
  }, [fetchHealth, fetchStats, fetchTransactions, currentPage, currentStatus, searchQuery]);

  useEffect(() => {
    fetchHealth();
    fetchStats();
    fetchTransactions(1, 'ALL', '');
  }, [fetchHealth, fetchStats, fetchTransactions]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchTransactions(newPage, currentStatus, searchQuery);
  };

  const handleStatusChange = (newStatus: string) => {
    setCurrentStatus(newStatus);
    setCurrentPage(1);
    fetchTransactions(1, newStatus, searchQuery);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
    fetchTransactions(1, currentStatus, q);
  };

  const handleCreateTransaction = async (payload: TransactionCreatePayload) => {
    const created = await api.createTransaction(payload);
    fetchStats();
    fetchTransactions(1, currentStatus, searchQuery);
    setSelectedTx(created);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar health={health} onOpenNewTransaction={() => setIsNewTxModalOpen(true)} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  stats={stats}
                  health={health}
                  transactions={transactions}
                  totalTransactions={totalTransactions}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  currentStatus={currentStatus}
                  searchQuery={searchQuery}
                  onPageChange={handlePageChange}
                  onStatusChange={handleStatusChange}
                  onSearchChange={handleSearchChange}
                  onSelectTransaction={(tx) => setSelectedTx(tx)}
                  onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
                  onRefresh={refreshAll}
                  isLoading={isLoading}
                />
              }
            />
            <Route
              path="/ai-insights"
              element={
                <AIInsights
                  transactions={transactions}
                  onSelectTransaction={(tx) => setSelectedTx(tx)}
                />
              }
            />
            <Route
              path="/transactions"
              element={
                <TransactionsPage
                  transactions={transactions}
                  total={totalTransactions}
                  page={currentPage}
                  pageSize={10}
                  totalPages={totalPages}
                  currentStatus={currentStatus}
                  searchQuery={searchQuery}
                  onPageChange={handlePageChange}
                  onStatusChange={handleStatusChange}
                  onSearchChange={handleSearchChange}
                  onSelectTransaction={(tx) => setSelectedTx(tx)}
                  onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
                  isLoading={isLoading}
                />
              }
            />
            <Route path="/workflows" element={<SecurityWorkflow />} />
            <Route path="/security" element={<Security health={health} />} />
            <Route path="/login" element={<Login health={health} />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
          Adaptive Banking Security Platform • ap-southeast-2 Sydney • Day 2 AI/ML Layer
        </footer>

        {/* Telemetry Inspection Modal */}
        <TransactionModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />

        {/* Simulate Transaction Modal */}
        <NewTransactionModal
          isOpen={isNewTxModalOpen}
          onClose={() => setIsNewTxModalOpen(false)}
          onSubmit={handleCreateTransaction}
        />
      </div>
    </BrowserRouter>
  );
};
export default App;

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Activity,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  User,
  CreditCard,
  Lock,
  Send,
  Clock,
  CheckCircle2,
  Cpu,
  Brain,
  Snowflake,
  UserCheck,
  Globe,
  Laptop,
} from '../components/Icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { RiskAlertsCard } from '../components/RiskAlertsCard';
import { TransactionTable } from '../components/TransactionTable';
import { ReportRecipientModal } from '../components/ReportRecipientModal';
import { DashboardStats, Transaction, HealthResponse, EmergencyModeStatus, VerificationRecord } from '../types';
import { api } from '../api/client';

interface DashboardPageProps {
  stats: DashboardStats | null;
  health: HealthResponse | null;
  transactions: Transaction[];
  totalTransactions: number;
  currentPage: number;
  totalPages: number;
  currentStatus: string;
  searchQuery: string;
  onPageChange: (p: number) => void;
  onStatusChange: (s: string) => void;
  onSearchChange: (q: string) => void;
  onSelectTransaction: (t: Transaction) => void;
  onOpenNewTransaction: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Dashboard: React.FC<DashboardPageProps> = ({
  stats,
  health,
  transactions,
  totalTransactions,
  currentPage,
  totalPages,
  currentStatus,
  searchQuery,
  onPageChange,
  onStatusChange,
  onSearchChange,
  onSelectTransaction,
  onOpenNewTransaction,
  onRefresh,
  isLoading,
}) => {
  // Option 2: Dual-View Switcher state
  const [viewMode, setViewMode] = useState<'customer' | 'bank_ops'>('customer');

  // Customer Mode States
  const [isCardFrozen, setIsCardFrozen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [selectedRecipientToReport, setSelectedRecipientToReport] = useState<string>('');

  // Bank Ops States
  const [emergencyMode, setEmergencyMode] = useState<EmergencyModeStatus | null>(null);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [isTogglingEmergency, setIsTogglingEmergency] = useState<boolean>(false);

  // Load Bank Ops Emergency Mode and pending verifications
  useEffect(() => {
    const loadOpsData = async () => {
      try {
        const em = await api.getEmergencyMode();
        setEmergencyMode(em);
        const verifs = await api.listVerifications('PENDING');
        setVerifications(verifs);
      } catch (e) {
        // Fallback for mock environment
      }
    };
    loadOpsData();
  }, [stats]);

  const handleToggleEmergencyMode = async () => {
    try {
      setIsTogglingEmergency(true);
      const nextState = !emergencyMode?.is_active;
      const res = await api.setEmergencyMode(nextState, nextState ? 'Bank Ops manual emergency freeze' : 'Deactivated by Bank Ops');
      setEmergencyMode(res);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update emergency freeze mode');
    } finally {
      setIsTogglingEmergency(false);
    }
  };

  const handleOpenReport = (recipientName: string = '') => {
    setSelectedRecipientToReport(recipientName);
    setIsReportModalOpen(true);
  };

  const checkingBalance = stats?.simulated_balance ?? 84520.0;
  const savingsBalance = 32450.0;
  const totalBalance = checkingBalance + savingsBalance;

  // Filter pending verification transactions for customer view
  const pendingCustomerTxs = transactions.filter(
    (t) => t.status === 'PENDING_VERIFICATION' || t.status === 'PENDING'
  );

  return (
    <div className="space-y-6 font-sans">
      {/* =========================================================================
          TOP DUAL-VIEW SWITCHER HEADER (Option 2)
         ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Adaptive Banking Platform</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              v2.4
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {viewMode === 'customer'
              ? 'Personal Account Portal with Real-Time Beneficiary Safeguards'
              : 'Fraud Monitoring Center, Isolation Forest ML Models & Emergency Kill-Switch'}
          </p>
        </div>

        {/* The Dual-View Segmented Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
            <button
              onClick={() => setViewMode('customer')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'customer'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Customer Mode</span>
            </button>

            <button
              onClick={() => setViewMode('bank_ops')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'bank_ops'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Bank Ops Mode</span>
            </button>
          </div>

          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: CUSTOMER MODE
         ========================================================================= */}
      {viewMode === 'customer' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Customer Balances & Virtual Debit Card Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Balances Card (2 cols) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                      Total Net Liquidity
                    </span>
                    <div className="text-3xl font-extrabold text-white font-mono mt-1">
                      ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={onOpenNewTransaction}
                      className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-blue-900/30 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Money / Transfer</span>
                    </button>
                    <button
                      onClick={() => handleOpenReport()}
                      className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold text-xs transition-colors"
                      title="Report Suspicious Recipient"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Report Recipient</span>
                    </button>
                  </div>
                </div>

                {/* Checking & Savings Accounts Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium text-slate-300 flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        Checking Account
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">•••• 4912</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 font-mono mt-2">
                      ${checkingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Primary checking for daily transactions & bill pay
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-medium text-slate-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        High-Yield Savings
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">•••• 8821</span>
                    </div>
                    <div className="text-2xl font-bold text-cyan-400 font-mono mt-2">
                      ${savingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>4.85% APY compounding daily</span>
                      <span className="text-emerald-400 font-semibold font-mono">+$131.20/mo</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Protection Policy Indicator */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    New Beneficiary Protection is <strong className="text-emerald-400">Active</strong> (24h Cooling-Off on transfers &gt; $1,000)
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">Adaptive Heuristic Guard</span>
              </div>
            </div>

            {/* Virtual Debit Card with Freeze Toggle (1 col) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                    Virtual Debit Card
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      isCardFrozen
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isCardFrozen ? '❄️ FROZEN' : 'ACTIVE'}
                  </span>
                </div>

                {/* Realistic Glassmorphic Debit Card */}
                <div
                  className={`relative w-full h-44 rounded-2xl p-5 text-white transition-all duration-300 overflow-hidden shadow-2xl border ${
                    isCardFrozen
                      ? 'bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 border-cyan-500/30 opacity-75'
                      : 'bg-gradient-to-tr from-blue-900 via-indigo-900 to-slate-950 border-cyan-400/30'
                  }`}
                >
                  {/* Subtle Card Background Pattern */}
                  <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />
                  <div className="absolute -left-8 -bottom-8 w-36 h-36 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-6 rounded bg-gradient-to-tr from-amber-300 to-amber-500 shadow-inner flex items-center justify-center">
                        <div className="w-6 h-4 border border-amber-800/40 rounded-sm" />
                      </div>
                      <span className="font-mono text-[10px] text-slate-300">Contactless</span>
                    </div>
                    <span className="font-bold tracking-widest text-xs uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-white">
                      PLATINUM DEBIT
                    </span>
                  </div>

                  <div className="mt-6 font-mono text-base font-semibold tracking-widest text-slate-100 relative z-10">
                    4532 •••• •••• 9814
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[11px] font-mono relative z-10">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400">Cardholder</div>
                      <div className="font-semibold text-slate-200">ALEXANDER D. MORGAN</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400">Expires</div>
                      <div className="font-semibold text-slate-200">08/29</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant Freeze / Lock Button */}
              <div className="mt-5 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setIsCardFrozen(!isCardFrozen)}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 transition-all ${
                    isCardFrozen
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Snowflake className="w-4 h-4" />
                  <span>{isCardFrozen ? 'Unfreeze Debit Card' : 'Freeze Card Temporarily'}</span>
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                  Instantly block new contactless and online POS charges
                </p>
              </div>
            </div>
          </div>

          {/* Customer Security Alerts / 2FA Challenge Center */}
          {pendingCustomerTxs.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs">
              <div className="flex items-center space-x-2 text-amber-300 font-bold mb-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Security Action Required: Step-Up 2FA Challenge</span>
              </div>
              <p className="text-slate-300 text-[11px] mb-3">
                The following transfer is held awaiting two-factor verification due to high-risk telemetry or the newly added beneficiary cooling-off policy:
              </p>
              <div className="space-y-2">
                {pendingCustomerTxs.slice(0, 2).map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-amber-500/20 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        Transfer of ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} to{' '}
                        <span className="text-amber-300">{tx.recipient}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {tx.is_new_beneficiary ? '⭐ New Beneficiary' : 'Elevated Risk'} • {tx.risk_reasons?.[0] || 'Requires verification'}
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectTransaction(tx)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-md"
                    >
                      Authorize Transfer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Beneficiary Watchlist & Protection (Feature 1 Showcase) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <span>Feature 1: Beneficiary Safety Watchlist</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verified recipients, cooling-off protection status, and rapid scam reporting
                </p>
              </div>
              <button
                onClick={() => handleOpenReport()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Report Suspicious Recipient</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Acme Industrial Pty</div>
                  <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> 24h Cooling-Off Active
                  </div>
                </div>
                <button
                  onClick={() => handleOpenReport('Acme Industrial Pty')}
                  className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Report"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Sydney Cloud Services</div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Trusted Recipient
                  </div>
                </div>
                <button
                  onClick={() => handleOpenReport('Sydney Cloud Services')}
                  className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Report"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Decentralized Liquidity Pool</div>
                  <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="w-3 h-3" /> Elevated Risk Flag
                  </div>
                </div>
                <button
                  onClick={() => handleOpenReport('Decentralized Liquidity Pool')}
                  className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Report"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Customer Recent Transactions & Explainable Risk Preview */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Recent Account Transfers</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any transaction to inspect the Explainable Risk Decision breakdown
                </p>
              </div>
              <button
                onClick={onOpenNewTransaction}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 font-mono"
              >
                + New Transfer
              </button>
            </div>

            <div className="divide-y divide-slate-800/80">
              {transactions.slice(0, 6).map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => onSelectTransaction(tx)}
                  className="py-3 px-2 rounded-lg hover:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-xl ${
                        tx.status === 'BLOCKED'
                          ? 'bg-rose-500/10 text-rose-400'
                          : tx.status === 'PENDING_VERIFICATION'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {tx.status === 'BLOCKED' ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : tx.status === 'PENDING_VERIFICATION' ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center space-x-2">
                        <span>{tx.recipient}</span>
                        {tx.is_new_beneficiary && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            New Recipient
                          </span>
                        )}
                        {tx.cooling_off_active && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Cooling-Off
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString()} • {tx.category} • {tx.status}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-white text-sm">
                      ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400 mt-0.5">
                      Risk: {tx.risk_score}/100 &gt;
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: BANK OPS MODE
         ========================================================================= */}
      {viewMode === 'bank_ops' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Bank Ops Emergency Freeze Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/60 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Bank Security Operations Center</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Live Telemetry
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Emergency controls, Isolation Forest anomaly scoring & DynamoDB compliance ledger
                </p>
              </div>
            </div>

            {/* Emergency Freeze Control */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleToggleEmergencyMode}
                disabled={isTogglingEmergency}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center space-x-2 ${
                  emergencyMode?.is_active
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40 animate-pulse'
                    : 'bg-slate-800 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>
                  {emergencyMode?.is_active
                    ? '⚠️ EMERGENCY FREEZE ACTIVE (LOCKED)'
                    : 'Activate Emergency Lockdown'}
                </span>
              </button>

              <button
                onClick={onOpenNewTransaction}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-900/30 transition-all flex items-center space-x-1.5"
              >
                <span>+ Inject Transaction</span>
              </button>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Audit Ledger Records"
              value={totalTransactions}
              subtitle="Persisted in DynamoDB"
              icon={Activity}
              variant="blue"
              badge={{
                text: health?.database.mode === 'aws_dynamodb' ? 'DynamoDB' : 'Active DB',
                variant: 'info',
              }}
            />

            <StatCard
              title="Pending 2FA Challenges"
              value={stats?.pending_transactions ?? 0}
              subtitle="Step-Up MFA Required"
              icon={AlertTriangle}
              variant="amber"
              badge={{ text: 'Action Req', variant: 'warning' }}
            />

            <StatCard
              title="Isolation Forest Anomalies"
              value={stats?.flagged_alerts ?? 0}
              subtitle="Statistical Outliers"
              icon={Brain}
              variant="rose"
              badge={{ text: 'ML Flagged', variant: 'danger' }}
            />

            <StatCard
              title="High-Risk Transactions"
              value={stats?.high_risk_alerts ?? 0}
              subtitle="Score >= 75"
              icon={ShieldAlert}
              variant="rose"
              badge={{ text: 'High Risk', variant: 'danger' }}
            />
          </div>

          {/* Middle Grid: Activity Chart & Risk Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Area Chart (2 cols) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white">7-Day Transaction Velocity & Volume</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Automated telemetry baseline calculation</p>
                </div>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/80">
                  USD Aggregate
                </span>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.activity_trend || []}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                      itemStyle={{ color: '#38bdf8' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAmount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk Alerts & Heuristic Distribution */}
            <div className="lg:col-span-1">
              {stats && (
                <RiskAlertsCard
                  distribution={stats.risk_distribution}
                  flaggedCount={stats.flagged_alerts}
                />
              )}
            </div>
          </div>

          {/* Live Transaction Ledger Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white">DynamoDB Audit Ledger</h3>
              <p className="text-xs text-slate-400">
                Full compliance transaction records with behavioral telemetry inspection
              </p>
            </div>
            <TransactionTable
              transactions={transactions}
              total={totalTransactions}
              page={currentPage}
              pageSize={10}
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
        </div>
      )}

      {/* Report Suspicious Recipient Modal */}
      <ReportRecipientModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialRecipient={selectedRecipientToReport}
        onSuccess={() => onRefresh()}
      />
    </div>
  );
};
export default Dashboard;

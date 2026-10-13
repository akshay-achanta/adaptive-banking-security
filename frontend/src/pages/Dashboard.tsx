import {
  Wallet,
  Activity,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from '../components/Icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { RiskAlertsCard } from '../components/RiskAlertsCard';
import { TransactionTable } from '../components/TransactionTable';
import { DashboardStats, Transaction, HealthResponse } from '../types';

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
  return (
    <div className="space-y-6">
      {/* Top Banner / System Telemetry bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Adaptive Banking Security Console</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time fraud heuristics, behavioral anomalies & DynamoDB persistence ledger
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenNewTransaction}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-900/30 transition-all flex items-center space-x-1.5"
          >
            <span>+ Simulate Transaction</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Simulated Balance"
          value={`$${stats?.simulated_balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? '84,520.00'}`}
          subtitle="Customer Account 001"
          icon={Wallet}
          variant="emerald"
          badge={{ text: 'Live Core', variant: 'success' }}
        />

        <StatCard
          title="Total Transactions"
          value={stats?.total_transactions ?? 0}
          subtitle="Processed in Ledger"
          icon={Activity}
          variant="blue"
          badge={{ text: health?.database.mode === 'aws_dynamodb' ? 'DynamoDB' : 'Mock DB', variant: 'info' }}
        />

        <StatCard
          title="Pending Verifications"
          value={stats?.pending_transactions ?? 0}
          subtitle="Awaiting Challenge"
          icon={AlertTriangle}
          variant="amber"
          badge={{ text: 'Action Req', variant: 'warning' }}
        />

        <StatCard
          title="High-Risk Alerts"
          value={stats?.high_risk_alerts ?? 0}
          subtitle="Flagged by Engine"
          icon={ShieldAlert}
          variant="rose"
          badge={{ text: 'Critical / High', variant: 'danger' }}
        />
      </div>

      {/* Middle Grid: Activity Chart & Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl flex flex-col justify-between">
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
      <div>
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
  );
};

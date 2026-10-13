import React, { useState, useEffect } from 'react';
import {
  Brain,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Sparkles,
  Lock,
  Layers,
  ArrowRight,
  Info,
} from '../components/Icons';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  Cell,
} from 'recharts';
import { api } from '../api/client';
import {
  SpendingAnalyticsResponse,
  SpendingForecastResponse,
  ModelMetricsResponse,
  Transaction,
  TransactionRiskResponse,
} from '../types';

interface AIInsightsProps {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ transactions, onSelectTransaction }) => {
  const [analytics, setAnalytics] = useState<SpendingAnalyticsResponse | null>(null);
  const [forecast, setForecast] = useState<SpendingForecastResponse | null>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);
  const [dailyLimit, setDailyLimit] = useState<number>(25000);
  const [riskAssessment, setRiskAssessment] = useState<TransactionRiskResponse | null>(null);
  const [isAssessing, setIsAssessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [analyticsData, forecastData, metricsData] = await Promise.all([
        api.getSpendingAnalytics(12000),
        api.getSpendingForecast(14, 12000),
        api.getModelMetrics(),
      ]);
      setAnalytics(analyticsData);
      setForecast(forecastData);
      setModelMetrics(metricsData);
    } catch (err: any) {
      console.error('Error fetching AI insights:', err);
      setErrorMessage(err.message || 'Failed to load machine learning analytics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (transactions.length > 0 && !selectedTxId) {
      setSelectedTxId(transactions[0].id);
    }
  }, [transactions, selectedTxId]);

  const handleRunAssessment = async () => {
    if (!selectedTxId) return;
    try {
      setIsAssessing(true);
      const res = await api.evaluateTransactionRisk(selectedTxId, {
        is_emergency_mode: isEmergencyMode,
        daily_limit: dailyLimit,
      });
      setRiskAssessment(res);
    } catch (err: any) {
      console.error('Risk assessment failed:', err);
      setErrorMessage(err.message || 'Failed to evaluate transaction risk.');
    } finally {
      setIsAssessing(false);
    }
  };

  // Convert category spending to chart format
  const categoryChartData = analytics?.category_spending
    ? Object.entries(analytics.category_spending).map(([name, amount]) => ({
        category: name,
        amount,
      }))
    : [];

  const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#f43f5e'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white">AI / ML Intelligence Layer</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
                scikit-learn • Supervised &amp; Anomaly
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Dual-engine risk classification, Isolation Forest anomaly scoring &amp; predictive forecasting
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-2 transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Intelligence</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Row 1: Interactive Hybrid Risk Evaluator */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Live Transaction Risk Assessment (POST /risk)</h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Deterministic Safety Policy Enforcement</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Select Transaction to Audit</label>
              <select
                value={selectedTxId}
                onChange={(e) => setSelectedTxId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {transactions.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {tx.id} — ${tx.amount.toFixed(2)} ({tx.recipient})
                  </option>
                ))}
              </select>
            </div>

            {/* Policy override test triggers */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Security Policy Simulation
              </span>

              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span className="text-slate-300">Emergency Account Lockdown</span>
                <input
                  type="checkbox"
                  checked={isEmergencyMode}
                  onChange={(e) => setIsEmergencyMode(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700"
                />
              </label>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Max Daily Spending Limit ($)</label>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleRunAssessment}
              disabled={isAssessing || !selectedTxId}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Brain className={`w-4 h-4 ${isAssessing ? 'animate-spin' : ''}`} />
              <span>{isAssessing ? 'Evaluating ML Models...' : 'Execute Hybrid Risk Assessment'}</span>
            </button>
          </div>

          {/* Result Card Column (2 cols) */}
          <div className="lg:col-span-2">
            {riskAssessment ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-mono">Audited Transaction:</span>
                    <h3 className="text-sm font-bold text-white font-mono">
                      {riskAssessment.transaction_id} — ${riskAssessment.amount.toFixed(2)} to {riskAssessment.recipient}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      riskAssessment.assessment.risk_level === 'CRITICAL'
                        ? 'bg-rose-950/80 border-rose-800 text-rose-400'
                        : riskAssessment.assessment.risk_level === 'HIGH'
                        ? 'bg-amber-950/80 border-amber-800 text-amber-400'
                        : 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                    }`}>
                      {riskAssessment.assessment.risk_level} ({riskAssessment.assessment.risk_score}/100)
                    </span>
                  </div>
                </div>

                {/* Score breakdown metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Model Prob</span>
                    <span className="text-slate-100 font-bold">
                      {riskAssessment.assessment.risk_probability !== null
                        ? `${(riskAssessment.assessment.risk_probability * 100).toFixed(1)}%`
                        : 'N/A (Score)'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Anomaly Flag</span>
                    <span className={riskAssessment.assessment.is_anomaly ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {riskAssessment.assessment.is_anomaly ? 'Outlier Detected' : 'Normal Cluster'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Policy Override</span>
                    <span className={riskAssessment.assessment.policy_override_applied ? 'text-rose-400 font-bold' : 'text-slate-400 font-bold'}>
                      {riskAssessment.assessment.policy_override_applied ? 'Enforced' : 'None'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Model Version</span>
                    <span className="text-cyan-400 font-bold">{riskAssessment.assessment.model_version}</span>
                  </div>
                </div>

                {/* Recommended action */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Recommended Action</span>
                  <p className="text-slate-200">{riskAssessment.assessment.recommended_action}</p>
                </div>

                {/* Reasons List */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">Assessment Telemetry Factors</span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {riskAssessment.assessment.assessment_reasons.map((r, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-cyan-400 font-mono">▸</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[220px] rounded-xl border border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                <Brain className="w-8 h-8 mb-2 text-slate-600" />
                <p>Select a transaction on the left and click "Execute Hybrid Risk Assessment"</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Combines Random Forest, Isolation Forest anomaly scoring, and security policies.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Analytics & Predictive Spending Forecasting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenditure Breakdown by Category */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Expense Distribution by Category</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Total: ${analytics?.total_spend.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Actual debit transactions grouped across ledger categories</p>
          </div>

          <div className="h-56 w-full">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData}>
                  <XAxis dataKey="category" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(val: any) => [`$${val.toFixed(2)}`, 'Spend']}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {categoryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No expense data available
              </div>
            )}
          </div>
        </div>

        {/* Statistical Spending Forecast */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">14-Day Expenditure Forecast</h3>
              </div>
              {forecast?.budget_risk_alert && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-400">
                  Budget Alert
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Projected cumulative trajectory with statistical variance intervals
            </p>
          </div>

          <div className="h-56 w-full">
            {forecast?.has_sufficient_data ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast.forecast_points}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(val: any) => [`$${val.toFixed(2)}`, 'Projected Total']}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative_projected"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#forecastGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-slate-500">
                <Info className="w-6 h-6 mb-1 text-slate-600" />
                <span>{forecast?.message || 'Insufficient historical data to compute forecast.'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Supervised Model Evaluation Metrics Report */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-xl">
        <div className="flex items-center space-x-2 mb-4">
          <Layers className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Supervised Model Benchmark &amp; Validation Report</h2>
        </div>

        {modelMetrics?.supervised_model ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Selected Classifier</span>
                <span className="text-white font-bold">{modelMetrics.supervised_model.selected_architecture}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Training Samples</span>
                <span className="text-cyan-400 font-bold">{modelMetrics.supervised_model.training_samples.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Test Split (Holdout)</span>
                <span className="text-purple-400 font-bold">{modelMetrics.supervised_model.test_samples.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Isolation Forest</span>
                <span className="text-emerald-400 font-bold">Contamination: {modelMetrics.anomaly_detector?.contamination || 0.08}</span>
              </div>
            </div>

            {/* Test Split Metrics Table */}
            <div className="overflow-x-auto text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Model Architecture</th>
                    <th className="p-2.5">F1-Score</th>
                    <th className="p-2.5">Precision</th>
                    <th className="p-2.5">Recall</th>
                    <th className="p-2.5">ROC-AUC</th>
                    <th className="p-2.5">PR-AUC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {Object.entries(modelMetrics.supervised_model.evaluation_metrics).map(([arch, metrics]) => (
                    <tr key={arch} className={arch === modelMetrics.supervised_model?.selected_architecture ? 'bg-slate-800/30' : ''}>
                      <td className="p-2.5 text-white font-bold flex items-center space-x-1.5">
                        <span>{arch}</span>
                        {arch === modelMetrics.supervised_model?.selected_architecture && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800">Selected</span>
                        )}
                      </td>
                      <td className="p-2.5 text-cyan-400 font-semibold">{metrics.test.f1.toFixed(4)}</td>
                      <td className="p-2.5">{metrics.test.precision.toFixed(4)}</td>
                      <td className="p-2.5">{metrics.test.recall.toFixed(4)}</td>
                      <td className="p-2.5 text-purple-400">{metrics.test.roc_auc.toFixed(4)}</td>
                      <td className="p-2.5 text-emerald-400">{metrics.test.pr_auc.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400">
              <strong className="text-slate-300">Methodological Disclosure:</strong> Preprocessing pipelines (StandardScaler + OneHotEncoder) were fitted strictly on the training partition to prevent cross-split leakage. Anomaly scores indicate statistical deviation from baseline distributions, not conclusive fraud conviction.
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500">
            Model training metrics will appear once model artifacts are compiled.
          </div>
        )}
      </div>
    </div>
  );
};

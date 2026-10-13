import React from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, Cpu } from './Icons';
import { RiskDistribution } from '../types';

interface RiskAlertsCardProps {
  distribution: RiskDistribution;
  flaggedCount: number;
}

export const RiskAlertsCard: React.FC<RiskAlertsCardProps> = ({ distribution, flaggedCount }) => {
  const total = distribution.low + distribution.medium + distribution.high + distribution.critical || 1;
  const criticalPct = Math.round((distribution.critical / total) * 100);
  const highPct = Math.round((distribution.high / total) * 100);
  const medPct = Math.round((distribution.medium / total) * 100);
  const lowPct = Math.round((distribution.low / total) * 100);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-lg shadow-black/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Adaptive Risk Breakdown</h3>
        </div>
        <div className="flex items-center space-x-1 text-xs text-slate-400 font-mono">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Heuristic AI Engine</span>
        </div>
      </div>

      {/* Progress Bar Distribution */}
      <div className="space-y-2 mb-5">
        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex ring-1 ring-slate-700/50">
          <div style={{ width: `${criticalPct}%` }} className="bg-rose-500 transition-all duration-500" title={`Critical: ${distribution.critical}`} />
          <div style={{ width: `${highPct}%` }} className="bg-amber-500 transition-all duration-500" title={`High: ${distribution.high}`} />
          <div style={{ width: `${medPct}%` }} className="bg-blue-500 transition-all duration-500" title={`Medium: ${distribution.medium}`} />
          <div style={{ width: `${lowPct}%` }} className="bg-emerald-500 transition-all duration-500" title={`Low: ${distribution.low}`} />
        </div>
      </div>

      {/* Grid of risk counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/40 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 block">Critical</span>
          <span className="text-lg font-bold text-white font-mono">{distribution.critical}</span>
          <span className="text-[10px] text-rose-400/80 block">{criticalPct}%</span>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 block">High</span>
          <span className="text-lg font-bold text-white font-mono">{distribution.high}</span>
          <span className="text-[10px] text-amber-400/80 block">{highPct}%</span>
        </div>

        <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-900/40 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 block">Medium</span>
          <span className="text-lg font-bold text-white font-mono">{distribution.medium}</span>
          <span className="text-[10px] text-blue-400/80 block">{medPct}%</span>
        </div>

        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/40 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block">Low</span>
          <span className="text-lg font-bold text-white font-mono">{distribution.low}</span>
          <span className="text-[10px] text-emerald-400/80 block">{lowPct}%</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center space-x-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Active Flagged Anomalies: <strong className="text-white font-mono">{flaggedCount}</strong></span>
        </span>
        <span className="flex items-center space-x-1 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>DynamoDB Audit Trail Ready</span>
        </span>
      </div>
    </div>
  );
};

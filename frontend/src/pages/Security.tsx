import React from 'react';
import { ShieldCheck, Database, Cloud, Lock, Server, Cpu, Layers } from '../components/Icons';
import { HealthResponse } from '../types';

interface SecurityPageProps {
  health: HealthResponse | null;
}

export const Security: React.FC<SecurityPageProps> = ({ health }) => {
  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Adaptive Security Intelligence & Architecture</h1>
            <p className="text-xs text-slate-400">AWS Cloud-Native Security Engine Specifications</p>
          </div>
        </div>
      </div>

      {/* Cloud Architecture Stack Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AWS Sydney Resources */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Cloud className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Provisioned AWS Cloud Infrastructure</h2>
          </div>
          <ul className="space-y-2.5 text-xs font-mono text-slate-300">
            <li className="p-2 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block font-sans text-[10px]">AWS Region</span>
              <span className="text-cyan-400">ap-southeast-2 (Sydney, Australia)</span>
            </li>
            <li className="p-2 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block font-sans text-[10px]">S3 Static Hosting</span>
              <span className="text-white">adaptive-banking-security-akshay-2026</span>
            </li>
            <li className="p-2 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block font-sans text-[10px]">CloudFront CDN Distribution</span>
              <span className="text-white">EMB6C8NWZM80U (d2skoyxe57scxh.cloudfront.net)</span>
            </li>
            <li className="p-2 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block font-sans text-[10px]">Cognito User Pool ID</span>
              <span className="text-white">ap-southeast-2_YiskHVZ1k</span>
            </li>
          </ul>
        </div>

        {/* DynamoDB & Database Persistence */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Database className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">DynamoDB Ledger Persistence</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3 font-sans">
            Transactions are stored in Amazon DynamoDB with single-table design or dedicated ledger tables.
          </p>
          <ul className="space-y-2 text-xs font-mono text-slate-300">
            <li className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 font-sans">Table Name:</span>
              <span className="text-slate-200">{health?.database.table_name || 'AdaptiveBankingTransactions'}</span>
            </li>
            <li className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 font-sans">Current Active Mode:</span>
              <span className={health?.database.mode === 'aws_dynamodb' ? 'text-emerald-400' : 'text-amber-400'}>
                {health?.database.mode === 'aws_dynamodb' ? 'AWS DynamoDB (Live)' : 'In-Memory Mock Mode (Day 1)'}
              </span>
            </li>
            <li className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 font-sans">Partition Key:</span>
              <span className="text-slate-200">id (String) / user_id</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Adaptive Risk Engine Rules */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 mb-3">
          <Layers className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Day 1 Adaptive Risk Scoring Matrix</h2>
        </div>

        <div className="overflow-x-auto font-mono text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="p-2.5">Risk Factor / Heuristic</th>
                <th className="p-2.5">Weight Points</th>
                <th className="p-2.5">Adaptive Trigger Condition</th>
                <th className="p-2.5">Action Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr>
                <td className="p-2.5 text-white font-semibold">High Velocity Amount</td>
                <td className="p-2.5 text-cyan-400">+45 pts</td>
                <td className="p-2.5">Amount &gt;= $10,000</td>
                <td className="p-2.5 text-rose-400">Escalate to Critical &amp; Flag</td>
              </tr>
              <tr>
                <td className="p-2.5 text-white font-semibold">Elevated Transfer</td>
                <td className="p-2.5 text-cyan-400">+25 pts</td>
                <td className="p-2.5">Amount &gt;= $3,000</td>
                <td className="p-2.5 text-amber-400">Escalate to High</td>
              </tr>
              <tr>
                <td className="p-2.5 text-white font-semibold">Unusual Geolocation</td>
                <td className="p-2.5 text-cyan-400">+35 pts</td>
                <td className="p-2.5">IP outside established baseline</td>
                <td className="p-2.5 text-rose-400">MFA Challenge / Flag</td>
              </tr>
              <tr>
                <td className="p-2.5 text-white font-semibold">New Device Fingerprint</td>
                <td className="p-2.5 text-cyan-400">+22 pts</td>
                <td className="p-2.5">First session from browser / OS</td>
                <td className="p-2.5 text-amber-400">Secondary Audit Log</td>
              </tr>
              <tr>
                <td className="p-2.5 text-white font-semibold">Asset Movement Type</td>
                <td className="p-2.5 text-cyan-400">+15 pts</td>
                <td className="p-2.5">WITHDRAWAL or INVESTMENT &gt; $2,000</td>
                <td className="p-2.5 text-blue-400">Pending Review</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

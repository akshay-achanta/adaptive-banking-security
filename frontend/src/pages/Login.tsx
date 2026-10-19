import React, { useState } from 'react';
import { Shield, Key, Lock, CheckCircle2, AlertCircle, ArrowRight, ExternalLink } from '../components/Icons';
import { HealthResponse } from '../types';

interface LoginPageProps {
  health: HealthResponse | null;
}

export const Login: React.FC<LoginPageProps> = ({ health }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const poolId = health?.cognito.user_pool_id || 'ap-southeast-2_YiskHVZ1k';
  const clientId = health?.cognito.app_client_id || '1lvft401ciiha7t0fl47nfgutf';
  const region = health?.cognito.region || 'ap-southeast-2';
  const currentToken = localStorage.getItem('cognito_access_token');

  const handleSetMockToken = () => {
    localStorage.removeItem('cognito_explicit_logout');
    localStorage.setItem('cognito_access_token', 'demo-token');
    setStatusMsg({
      text: 'Demonstration session activated with demo-user-001 credentials.',
      type: 'success',
    });
  };

  const handleSaveCustomToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      localStorage.removeItem('cognito_access_token');
      localStorage.setItem('cognito_explicit_logout', 'true');
      setStatusMsg({ text: 'Access token cleared. Using default dev session.', type: 'info' });
      return;
    }
    localStorage.removeItem('cognito_explicit_logout');
    localStorage.setItem('cognito_access_token', tokenInput.trim());
    setStatusMsg({
      text: 'Cognito JWT token saved. Requests will include Authorization Bearer header.',
      type: 'success',
    });
  };

  const handleClearToken = () => {
    localStorage.removeItem('cognito_access_token');
    localStorage.setItem('cognito_explicit_logout', 'true');
    setStatusMsg({ text: 'Session token cleared (Unauthenticated 401 mode active).', type: 'info' });
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Amazon Cognito Authentication Gateway</h1>
            <p className="text-xs text-slate-400">Adaptive Banking Security Single Sign-On (SSO)</p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center space-x-2.5 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : statusMsg.type === 'error'
              ? 'bg-rose-950/60 border-rose-800 text-rose-300'
              : 'bg-blue-950/60 border-blue-800 text-blue-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Cognito Pool Specs */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>Configured AWS Cognito Identity Provider</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">User Pool ID</span>
            <span className="text-slate-200 mt-1 block truncate" title={poolId}>{poolId}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">App Client ID</span>
            <span className="text-slate-200 mt-1 block truncate" title={clientId}>{clientId}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">AWS Region</span>
            <span className="text-cyan-400 mt-1 block">{region}</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-400">
            Enforce Strict JWT Validation:{' '}
            <strong className={health?.cognito.auth_enforced ? 'text-emerald-400' : 'text-amber-400'}>
              {health?.cognito.auth_enforced ? 'ENFORCED (Production)' : 'BYPASS (Day 1 Dev Mode)'}
            </strong>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleSetMockToken}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
            >
              Simulate Dev Token
            </button>
            {currentToken && (
              <button
                onClick={handleClearToken}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-medium transition-colors"
              >
                Clear Token
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Manual JWT Token Inspection */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-white mb-2 flex items-center space-x-2">
          <Lock className="w-4 h-4 text-purple-400" />
          <span>Active Session & Bearer Header</span>
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          When logging in via Cognito Hosted UI, the returned id_token/access_token is stored here and attached to all API queries.
        </p>

        <form onSubmit={handleSaveCustomToken} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-300 font-mono mb-1">
              Bearer Token ({currentToken ? 'Active' : 'Not set — using local sandbox identity'})
            </label>
            <textarea
              rows={3}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste raw Cognito JWT token here..."
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center space-x-1.5"
            >
              <span>Update Authorization Header</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

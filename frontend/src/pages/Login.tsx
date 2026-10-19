import React, { useState, useEffect } from 'react';
import { Shield, Key, Lock, CheckCircle2, AlertCircle, ArrowRight, ExternalLink, Copy, Check } from '../components/Icons';
import { HealthResponse } from '../types';
import { api } from '../api/client';

interface LoginPageProps {
  health: HealthResponse | null;
}

export const Login: React.FC<LoginPageProps> = ({ health }) => {
  const [email, setEmail] = useState('demo.banker@adaptive-security.io');
  const [password, setPassword] = useState('AdaptiveDemo2026!');
  const [customToken, setCustomToken] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(localStorage.getItem('cognito_access_token'));

  const poolId = health?.cognito.user_pool_id || 'ap-southeast-2_YiskHVZ1k';
  const clientId = health?.cognito.app_client_id || '1lvft401ciiha7t0fl47nfgutf';
  const region = health?.cognito.region || 'ap-southeast-2';

  useEffect(() => {
    setActiveToken(localStorage.getItem('cognito_access_token'));
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const res = await api.login(email, password);
      setActiveToken(res.access_token);
      setStatusMsg({
        text: `Successfully signed in as ${res.user.email}! Valid JWT generated and activated.`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Authentication failed. Please verify credentials.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setEmail('demo.banker@adaptive-security.io');
    setPassword('AdaptiveDemo2026!');
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const res = await api.login('demo.banker@adaptive-security.io', 'AdaptiveDemo2026!');
      setActiveToken(res.access_token);
      setStatusMsg({
        text: '⚡ Demo Account session activated! Real JWT generated and saved.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Demo login failed.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustomToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToken.trim()) {
      handleClearToken();
      return;
    }
    const clean = customToken.trim().replace(/^Bearer\s+/i, '').replace(/['"]/g, '');
    localStorage.removeItem('cognito_explicit_logout');
    localStorage.setItem('cognito_access_token', clean);
    setActiveToken(clean);
    setStatusMsg({
      text: 'Custom JWT token saved. Requests now include this Bearer header.',
      type: 'success',
    });
  };

  const handleClearToken = () => {
    localStorage.removeItem('cognito_access_token');
    localStorage.setItem('cognito_explicit_logout', 'true');
    setActiveToken(null);
    setStatusMsg({
      text: 'Signed out. Authorization token cleared (Unauthenticated 401 test mode active).',
      type: 'info',
    });
  };

  const handleCopyToken = () => {
    if (activeToken) {
      navigator.clipboard.writeText(activeToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
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
            <h1 className="text-xl font-bold text-white">Adaptive Banking Authentication Gateway</h1>
            <p className="text-xs text-slate-400">Amazon Cognito & JWT Security Gateway</p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center space-x-2.5 transition-all ${
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

      {/* Demo Account Quick Access Card */}
      <div className="rounded-xl border border-cyan-800/60 bg-gradient-to-b from-cyan-950/30 to-slate-900/60 p-5 backdrop-blur-sm shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Shield className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Official Demo Account</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Ready to Test
              </span>
            </div>
            <div className="text-xs text-slate-300 space-y-0.5 font-mono mt-2">
              <div>Email: <span className="text-cyan-300 font-semibold">demo.banker@adaptive-security.io</span></div>
              <div>Password: <span className="text-cyan-300 font-semibold">AdaptiveDemo2026!</span></div>
            </div>
          </div>

          <button
            onClick={handleQuickDemoLogin}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center space-x-2 flex-shrink-0 disabled:opacity-50"
          >
            <span>⚡ 1-Click Sign In (Demo Account)</span>
          </button>
        </div>
      </div>

      {/* Active Session & Real JWT Token Details */}
      {activeToken ? (
        <div className="rounded-xl border border-emerald-800/60 bg-slate-900/70 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-emerald-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Active JWT Session</span>
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyToken}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center space-x-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied JWT!' : 'Copy JWT for Swagger'}</span>
              </button>
              <button
                onClick={handleClearToken}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all max-h-24 overflow-y-auto">
            {activeToken}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            💡 <strong>Swagger UI Testing</strong>: Copy this JWT, navigate to <a href="/docs" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Swagger UI (/docs)</a>, click the green <strong>Authorize 🔓</strong> button, and paste this token into the Value box.
          </p>
        </div>
      ) : (
        /* Sign-in Form */
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Sign In with Credentials</span>
          </h2>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email / Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo.banker@adaptive-security.io"
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Cognito JWT Inspection / Override */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
        <h2 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-2">
          <Key className="w-3.5 h-3.5 text-slate-400" />
          <span>Manual Cognito JWT Override</span>
        </h2>
        <p className="text-[11px] text-slate-400 mb-3">
          If you have signed in directly with AWS Cognito Hosted UI or have a live RS256 token, paste it here.
        </p>

        <form onSubmit={handleSaveCustomToken} className="space-y-3">
          <textarea
            rows={2}
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value)}
            placeholder="eyJraWQiOi..."
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Apply Custom JWT
            </button>
          </div>
        </form>
      </div>

      {/* Cognito Identity Provider Infrastructure Specs */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-4">
        <h3 className="text-xs font-medium text-slate-400 mb-2">Connected AWS Cognito Identity Provider</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="p-2 rounded bg-slate-950 border border-slate-800">
            <span className="text-[9px] text-slate-500 uppercase block">User Pool ID</span>
            <span className="text-slate-300 truncate block" title={poolId}>{poolId}</span>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800">
            <span className="text-[9px] text-slate-500 uppercase block">App Client ID</span>
            <span className="text-slate-300 truncate block" title={clientId}>{clientId}</span>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800">
            <span className="text-[9px] text-slate-500 uppercase block">Region</span>
            <span className="text-cyan-400 block">{region}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

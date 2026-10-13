import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Activity, Database, Key, Server, Plus, Globe, Brain, Sliders } from './Icons';
import { HealthResponse } from '../types';

interface NavbarProps {
  health: HealthResponse | null;
  onOpenNewTransaction: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ health, onOpenNewTransaction }) => {
  const isMockDb = health?.database.mode === 'mock_in_memory';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-white text-base">AdaptiveGuard</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-800/80 px-1.5 py-0.5 rounded">
                  AI Core • Day 2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">ap-southeast-2 Sydney • ML Layer</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/ai-insights"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <Brain className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Insights</span>
            </NavLink>

            <NavLink
              to="/transactions"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <Server className="w-3.5 h-3.5" />
              <span>Transactions</span>
            </NavLink>

            <NavLink
              to="/workflows"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Policies &amp; Workflows</span>
            </NavLink>

            <NavLink
              to="/security"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Security Engine</span>
            </NavLink>

            <NavLink
              to="/login"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <Key className="w-3.5 h-3.5" />
              <span>Cognito Auth</span>
            </NavLink>
          </nav>

          {/* Right Status Controls */}
          <div className="flex items-center space-x-3">
            {/* Database indicator */}
            <div
              className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                isMockDb
                  ? 'bg-amber-950/60 border-amber-800/80 text-amber-300'
                  : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
              }`}
              title={
                isMockDb
                  ? 'In-Memory Mock Mode (Ready for DynamoDB switch)'
                  : 'Connected to AWS DynamoDB'
              }
            >
              <Database className="w-3 h-3" />
              <span>{isMockDb ? 'MOCK DB MODE' : 'AWS DYNAMODB'}</span>
            </div>

            {/* Region pill */}
            <div className="hidden lg:flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-400">
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>ap-southeast-2</span>
            </div>

            {/* Simulate transaction CTA button */}
            <button
              onClick={onOpenNewTransaction}
              className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-md shadow-blue-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Simulate Tx</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

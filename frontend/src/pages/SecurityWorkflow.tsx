import React, { useState, useEffect } from 'react';
import {
  Shield,
  Siren,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Bell,
  FileText,
  RefreshCw,
  Plus,
  X,
  Check,
} from '../components/Icons';
import { api } from '../api/client';
import {
  SecurityPolicy,
  EmergencyModeStatus,
  VerificationRecord,
  ScheduledTransaction,
  NotificationItem,
  AuditEvent,
  TransactionCategory,
} from '../types';

export const SecurityWorkflow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'policy' | 'verifications' | 'scheduled' | 'notifications' | 'audit'>('policy');
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [emergency, setEmergency] = useState<EmergencyModeStatus | null>(null);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Policy form state
  const [maxSingleAmount, setMaxSingleAmount] = useState<number>(5000);
  const [dailyLimit, setDailyLimit] = useState<number>(15000);
  const [startHour, setStartHour] = useState<number>(0);
  const [endHour, setEndHour] = useState<number>(23);
  const [riskThreshold, setRiskThreshold] = useState<number>(65);
  const [restrictedCats, setRestrictedCats] = useState<TransactionCategory[]>([]);

  // Scheduled transaction form state
  const [newSchedAmount, setNewSchedAmount] = useState<number>(450);
  const [newSchedRecipient, setNewSchedRecipient] = useState<string>('Sydney Tech Infrastructure');
  const [newSchedCategory, setNewSchedCategory] = useState<TransactionCategory>('PAYMENT');
  const [newSchedDate, setNewSchedDate] = useState<string>('2026-10-25T14:00:00Z');
  const [newSchedDesc, setNewSchedDesc] = useState<string>('Monthly automated service payment');

  const loadAll = async () => {
    try {
      setIsLoading(true);
      const [p, em, v, s, n, a] = await Promise.all([
        api.getSecurityPolicy(),
        api.getEmergencyMode(),
        api.listVerifications(),
        api.listScheduledTransactions(),
        api.listNotifications(),
        api.listAuditEvents(50),
      ]);
      setPolicy(p);
      setEmergency(em);
      setVerifications(v);
      setScheduled(s);
      setNotifications(n);
      setAuditEvents(a);

      setMaxSingleAmount(p.max_single_amount_cents / 100);
      setDailyLimit(p.daily_limit_cents / 100);
      setStartHour(p.permitted_start_hour);
      setEndHour(p.permitted_end_hour);
      setRiskThreshold(p.verification_risk_threshold);
      setRestrictedCats(p.restricted_categories || []);
    } catch (err: any) {
      console.error('Failed to load security workflow:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.updateSecurityPolicy({
        max_single_amount: maxSingleAmount,
        daily_limit: dailyLimit,
        permitted_start_hour: startHour,
        permitted_end_hour: endHour,
        verification_risk_threshold: riskThreshold,
        restricted_categories: restrictedCats,
      });
      setPolicy(updated);
      setStatusMsg({ text: 'Customer security policy updated and active on backend.', type: 'success' });
      loadAll();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to update policy', type: 'error' });
    }
  };

  const handleToggleEmergency = async () => {
    try {
      const activate = !emergency?.is_active;
      const res = await api.setEmergencyMode(activate, activate ? 'User activated emergency account lockdown' : 'Threat cleared by user');
      setEmergency(res);
      setStatusMsg({
        text: activate
          ? 'EMERGENCY LOCKDOWN ACTIVE: All outgoing transactions halted.'
          : 'Emergency lockdown deactivated. Standard security policies restored.',
        type: 'success',
      });
      loadAll();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to toggle emergency mode', type: 'error' });
    }
  };

  const handleDecideVerification = async (vId: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      await api.decideVerification(vId, decision, `User ${decision.toLowerCase()}d verification request.`);
      setStatusMsg({ text: `Verification challenge ${decision.toLowerCase()}d successfully.`, type: 'success' });
      loadAll();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Verification decision failed', type: 'error' });
    }
  };

  const handleCreateScheduled = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createScheduledTransaction({
        amount: newSchedAmount,
        currency: 'USD',
        recipient: newSchedRecipient,
        category: newSchedCategory,
        execution_time: newSchedDate,
        description: newSchedDesc,
      });
      setStatusMsg({ text: 'Scheduled transaction created successfully.', type: 'success' });
      loadAll();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to schedule transaction', type: 'error' });
    }
  };

  const handleExecuteScheduled = async (sId: string) => {
    try {
      const res = await api.executeScheduledTransaction(sId);
      setStatusMsg({
        text: `Scheduled transaction executed! Resulting status: ${res.executed_transaction.status}`,
        type: 'success',
      });
      loadAll();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to execute scheduled transaction', type: 'error' });
    }
  };

  const handleCancelScheduled = async (sId: string) => {
    try {
      await api.cancelScheduledTransaction(sId);
      setStatusMsg({ text: 'Scheduled transaction cancelled.', type: 'success' });
      loadAll();
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to cancel', type: 'error' });
    }
  };

  const toggleCategory = (cat: TransactionCategory) => {
    if (restrictedCats.includes(cat)) {
      setRestrictedCats(restrictedCats.filter((c) => c !== cat));
    } else {
      setRestrictedCats([...restrictedCats, cat]);
    }
  };

  const pendingVerificationsCount = verifications.filter((v) => v.status === 'PENDING').length;
  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Top Banner with Emergency Mode Button */}
      <div className={`p-5 rounded-2xl border transition-all ${
        emergency?.is_active
          ? 'bg-rose-950/70 border-rose-600 shadow-2xl shadow-rose-950/60'
          : 'bg-slate-900 border-slate-800 shadow-xl'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className={`p-3 rounded-xl ${
              emergency?.is_active
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-blue-600/20 text-cyan-400 border border-blue-500/30'
            }`}>
              {emergency?.is_active ? <Siren className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white">Security Policies &amp; Workflow Engine</h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                  emergency?.is_active
                    ? 'bg-rose-900 text-rose-200 border border-rose-500'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}>
                  {emergency?.is_active ? 'EMERGENCY LOCKDOWN' : 'NORMAL ENFORCEMENT'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {emergency?.is_active
                  ? `Active since ${emergency.activated_at} (${emergency.reason}). All outgoing transactions are halted.`
                  : 'Customer policy boundaries, multi-step verification workflows & immutable audit trails.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleToggleEmergency}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                emergency?.is_active
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'
              }`}
            >
              <Siren className="w-4 h-4" />
              <span>{emergency?.is_active ? 'Deactivate Emergency Mode' : 'Activate Emergency Mode'}</span>
            </button>

            <button
              onClick={loadAll}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl border text-xs flex items-center space-x-2 ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
            : 'bg-rose-950/60 border-rose-800 text-rose-300'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Workflow Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('policy')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === 'policy' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Security Policy</span>
        </button>

        <button
          onClick={() => setActiveTab('verifications')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === 'verifications' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Verifications</span>
          {pendingVerificationsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold">
              {pendingVerificationsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === 'scheduled' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Scheduled Transactions</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === 'notifications' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Notifications</span>
          {unreadNotifsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500 text-black font-bold">
              {unreadNotifsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === 'audit' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Audit History</span>
        </button>
      </div>

      {/* Tab 1: Customer Security Policy Form */}
      {activeTab === 'policy' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm shadow-xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">Customer Security Restrictions</h2>
            <p className="text-xs text-slate-400">
              Deterministic rules enforced strictly on the backend. Transactions exceeding limits are blocked regardless of AI score.
            </p>
          </div>

          <form onSubmit={handleUpdatePolicy} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Max Single Transaction ($)</label>
                <input
                  type="number"
                  step="100"
                  value={maxSingleAmount}
                  onChange={(e) => setMaxSingleAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
                <span className="text-[11px] text-slate-500">Stored in database as integer cents ({maxSingleAmount * 100} cents)</span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Daily Cumulative Spend Limit ($)</label>
                <input
                  type="number"
                  step="500"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
                <span className="text-[11px] text-slate-500">Total daily debit volume ceiling</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Permitted Hours Window (UTC)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={startHour}
                    onChange={(e) => setStartHour(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={endHour}
                    onChange={(e) => setEndHour(parseInt(e.target.value) || 23)}
                    className="w-24 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                  <span className="text-[11px] text-slate-500">:00 UTC</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Risk Threshold for Step-up Verification</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={riskThreshold}
                    onChange={(e) => setRiskThreshold(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono font-bold text-cyan-400">{riskThreshold} / 100</span>
                </div>
                <span className="text-[11px] text-slate-500">Transactions scoring above this require user confirmation</span>
              </div>
            </div>

            {/* Restricted Categories Chips */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Restricted Categories</label>
              <div className="flex flex-wrap gap-2">
                {(['TRANSFER', 'PAYMENT', 'WITHDRAWAL', 'DEPOSIT', 'INVESTMENT'] as TransactionCategory[]).map((cat) => {
                  const isRestricted = restrictedCats.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                        isRestricted
                          ? 'bg-rose-950/80 border-rose-600 text-rose-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {isRestricted ? `✕ Restricted: ${cat}` : `+ Allow: ${cat}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                Save &amp; Enforce Policies
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Verifications Workflow */}
      {activeTab === 'verifications' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-white">Pending Verification Challenges</h2>
            <p className="text-xs text-slate-400">
              Transactions held by adaptive policy or risk scoring awaiting authenticated user decision.
            </p>
          </div>

          {verifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No verification challenges currently on record.
            </div>
          ) : (
            <div className="space-y-3">
              {verifications.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-white">{v.transaction_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        v.status === 'PENDING'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : v.status === 'APPROVED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {v.status}
                      </span>
                      <span className="text-xs font-mono text-cyan-400">Risk Score: {v.risk_score}/100</span>
                    </div>

                    <ul className="text-xs text-slate-400 space-y-0.5">
                      {v.risk_reasons.map((r, i) => (
                        <li key={i} className="flex items-center space-x-1">
                          <span className="text-slate-600">▸</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      Created: {v.created_at} • Expires: {v.expires_at}
                    </span>
                  </div>

                  {v.status === 'PENDING' && (
                    <div className="flex items-center space-x-2 self-end md:self-auto">
                      <button
                        onClick={() => handleDecideVerification(v.id, 'APPROVE')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleDecideVerification(v.id, 'REJECT')}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Scheduled Transactions */}
      {activeTab === 'scheduled' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Scheduled Tx */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Schedule New Transaction</span>
            </h3>

            <form onSubmit={handleCreateScheduled} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newSchedAmount}
                  onChange={(e) => setNewSchedAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Recipient</label>
                <input
                  type="text"
                  required
                  value={newSchedRecipient}
                  onChange={(e) => setNewSchedRecipient(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Category</label>
                <select
                  value={newSchedCategory}
                  onChange={(e) => setNewSchedCategory(e.target.value as TransactionCategory)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="PAYMENT">PAYMENT</option>
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="INVESTMENT">INVESTMENT</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Execution Date (UTC ISO)</label>
                <input
                  type="text"
                  required
                  value={newSchedDate}
                  onChange={(e) => setNewSchedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newSchedDesc}
                  onChange={(e) => setNewSchedDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
              >
                Schedule Transaction
              </button>
            </form>
          </div>

          {/* List of Scheduled Transactions */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Queued Scheduled Transactions</h3>
            <p className="text-xs text-slate-400">
              Adapter designed for AWS EventBridge Scheduler. Current policies are re-validated at execution time.
            </p>

            {scheduled.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No scheduled transactions queued.</div>
            ) : (
              <div className="space-y-3">
                {scheduled.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">${s.amount.toFixed(2)}</span>
                        <span className="text-slate-400">to</span>
                        <span className="font-semibold text-slate-200">{s.recipient}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          s.status === 'SCHEDULED'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : s.status === 'EXECUTED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block font-mono mt-0.5">
                        Execution: {s.execution_time} • {s.description}
                      </span>
                    </div>

                    {s.status === 'SCHEDULED' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleExecuteScheduled(s.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                        >
                          Trigger Execution
                        </button>
                        <button
                          onClick={() => handleCancelScheduled(s.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: In-App Notifications Center */}
      {activeTab === 'notifications' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Security Notification Center</h2>
              <p className="text-xs text-slate-400">
                In-app alerts for policy breaches, verification requests, and scheduled runs (Amazon SNS adapter ready).
              </p>
            </div>
            {unreadNotifsCount > 0 && (
              <button
                onClick={async () => {
                  await api.markNotificationsRead();
                  loadAll();
                }}
                className="text-xs text-cyan-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No notifications on record.</div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-xl border text-xs flex items-start space-x-3 ${
                    n.is_read
                      ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                      : 'bg-slate-950 border-blue-900/60 text-slate-200'
                  }`}
                >
                  <Bell className={`w-4 h-4 mt-0.5 flex-shrink-0 ${n.is_read ? 'text-slate-500' : 'text-cyan-400'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">{n.title}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">{n.created_at}</span>
                    </div>
                    <p className="text-xs mt-0.5">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Immutable Audit History */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-white">Immutable Security Audit Trail</h2>
            <p className="text-xs text-slate-400">
              Chronological log of all transactions, verification decisions, policy changes, and emergency locks.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">Outcome</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {auditEvents.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30">
                    <td className="p-3 text-slate-400 whitespace-nowrap">{a.timestamp}</td>
                    <td className="p-3 text-cyan-400 font-bold">{a.action}</td>
                    <td className="p-3 text-slate-200">{a.resource_id}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.outcome === 'SUCCESS' || a.outcome === 'APPROVE'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : a.outcome === 'BLOCKED' || a.outcome === 'REJECT'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {a.outcome}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 max-w-xs truncate" title={JSON.stringify(a.details)}>
                      {JSON.stringify(a.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

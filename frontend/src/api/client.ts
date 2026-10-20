import {
  Transaction,
  TransactionCreatePayload,
  TransactionListResponse,
  DashboardStats,
  HealthResponse,
  TransactionRiskResponse,
  SpendingAnalyticsResponse,
  SpendingForecastResponse,
  ModelMetricsResponse,
  SecurityPolicy,
  SecurityPolicyUpdatePayload,
  EmergencyModeStatus,
  VerificationRecord,
  ScheduledTransaction,
  ScheduledTransactionCreatePayload,
  NotificationItem,
  AuditEvent,
  ReportRecipientPayload,
  ReportRecipientResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined 
  ? import.meta.env.VITE_API_BASE_URL 
  : (import.meta.env.PROD ? '' : 'http://localhost:8000');

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    let token = localStorage.getItem('cognito_access_token');
    const isExplicitlyLoggedOut = localStorage.getItem('cognito_explicit_logout') === 'true';
    if (!token && !isExplicitlyLoggedOut) {
      token = 'demo-token';
      localStorage.setItem('cognito_access_token', token);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async login(email?: string, password?: string): Promise<{ access_token: string; user: { user_id: string; email: string; role: string } }> {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email || 'demo.banker@adaptive-security.io',
        password: password || 'AdaptiveDemo2026!',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Login failed with status: ${res.status}`);
    }
    const data = await res.json();
    localStorage.removeItem('cognito_explicit_logout');
    localStorage.setItem('cognito_access_token', data.access_token);
    return data;
  }

  async getDemoToken(): Promise<{ token: string }> {
    const res = await fetch(`${BASE_URL}/api/auth/demo-token`);
    if (!res.ok) {
      throw new Error(`Failed to fetch demo token: ${res.status}`);
    }
    return res.json();
  }

  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with status: ${res.status}`);
    }
    return res.json();
  }

  async getDashboard(): Promise<DashboardStats> {
    const res = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dashboard stats: ${res.statusText}`);
    }
    return res.json();
  }

  async getTransactions(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  } = {}): Promise<TransactionListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('page_size', params.pageSize.toString());
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.search) query.append('search', params.search);

    const res = await fetch(`${BASE_URL}/api/transactions?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to list transactions: ${res.statusText}`);
    }
    return res.json();
  }

  async getTransaction(id: string): Promise<Transaction> {
    const res = await fetch(`${BASE_URL}/api/transactions/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Transaction ${id} not found: ${res.statusText}`);
    }
    return res.json();
  }

  async createTransaction(payload: TransactionCreatePayload): Promise<Transaction> {
    const res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to simulate transaction');
    }
    return res.json();
  }

  async reportRecipient(payload: ReportRecipientPayload): Promise<ReportRecipientResponse> {
    const res = await fetch(`${BASE_URL}/api/transactions/report-recipient`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to submit suspicious recipient report');
    }
    return res.json();
  }

  // --- Day 2 ML Intelligence Endpoints ---

  async evaluateTransactionRisk(
    transactionId: string,
    options: { is_emergency_mode?: boolean; daily_limit?: number } = {}
  ): Promise<TransactionRiskResponse> {
    const res = await fetch(`${BASE_URL}/api/transactions/${transactionId}/risk`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to evaluate risk for transaction ${transactionId}`);
    }
    return res.json();
  }

  async getSpendingAnalytics(monthlyBudget?: number): Promise<SpendingAnalyticsResponse> {
    const query = new URLSearchParams();
    if (monthlyBudget) query.append('current_month_budget', monthlyBudget.toString());

    const res = await fetch(`${BASE_URL}/api/analytics/spending?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch spending analytics: ${res.statusText}`);
    }
    return res.json();
  }

  async getSpendingForecast(forecastDays?: number, monthlyBudget?: number): Promise<SpendingForecastResponse> {
    const query = new URLSearchParams();
    if (forecastDays) query.append('forecast_days', forecastDays.toString());
    if (monthlyBudget) query.append('monthly_budget', monthlyBudget.toString());

    const res = await fetch(`${BASE_URL}/api/analytics/forecast?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch spending forecast: ${res.statusText}`);
    }
    return res.json();
  }

  async getModelMetrics(): Promise<ModelMetricsResponse> {
    const res = await fetch(`${BASE_URL}/api/analytics/model-metrics`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch model evaluation metrics: ${res.statusText}`);
    }
    return res.json();
  }

  // --- Day 3 Security Policies & Workflow Engine Endpoints ---

  async getSecurityPolicy(): Promise<SecurityPolicy> {
    const res = await fetch(`${BASE_URL}/api/security/policy`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch security policy');
    return res.json();
  }

  async updateSecurityPolicy(payload: SecurityPolicyUpdatePayload): Promise<SecurityPolicy> {
    const res = await fetch(`${BASE_URL}/api/security/policy`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update security policy');
    return res.json();
  }

  async getEmergencyMode(): Promise<EmergencyModeStatus> {
    const res = await fetch(`${BASE_URL}/api/security/emergency-mode`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch emergency mode status');
    return res.json();
  }

  async setEmergencyMode(activate: boolean, reason?: string): Promise<EmergencyModeStatus> {
    const res = await fetch(`${BASE_URL}/api/security/emergency-mode`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ activate, reason }),
    });
    if (!res.ok) throw new Error('Failed to toggle emergency mode');
    return res.json();
  }

  async listVerifications(status?: string): Promise<VerificationRecord[]> {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${BASE_URL}/api/security/verifications${query}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch verifications');
    return res.json();
  }

  async decideVerification(verificationId: string, decision: 'APPROVE' | 'REJECT', reason?: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/security/verifications/${verificationId}/decide`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ decision, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to submit verification decision');
    }
    return res.json();
  }

  async listScheduledTransactions(): Promise<ScheduledTransaction[]> {
    const res = await fetch(`${BASE_URL}/api/security/scheduled`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch scheduled transactions');
    return res.json();
  }

  async createScheduledTransaction(payload: ScheduledTransactionCreatePayload): Promise<ScheduledTransaction> {
    const res = await fetch(`${BASE_URL}/api/security/scheduled`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create scheduled transaction');
    return res.json();
  }

  async cancelScheduledTransaction(scheduledId: string): Promise<ScheduledTransaction> {
    const res = await fetch(`${BASE_URL}/api/security/scheduled/${scheduledId}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to cancel scheduled transaction');
    return res.json();
  }

  async executeScheduledTransaction(scheduledId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/security/scheduled/${scheduledId}/execute`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to execute scheduled transaction');
    }
    return res.json();
  }

  async listNotifications(unreadOnly = false): Promise<NotificationItem[]> {
    const res = await fetch(`${BASE_URL}/api/security/notifications?unread_only=${unreadOnly}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  }

  async markNotificationsRead(): Promise<void> {
    await fetch(`${BASE_URL}/api/security/notifications/read`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
  }

  async listAuditEvents(limit = 50): Promise<AuditEvent[]> {
    const res = await fetch(`${BASE_URL}/api/security/audit-events?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch audit events');
    return res.json();
  }

  async getAuthConfig(): Promise<{
    user_pool_id: string;
    app_client_id: string;
    region: string;
    auth_enforced: boolean;
  }> {
    const res = await fetch(`${BASE_URL}/api/auth/config`);
    if (!res.ok) throw new Error('Failed to fetch auth configuration');
    return res.json();
  }
}

export const api = new ApiClient();
export const apiClient = api;

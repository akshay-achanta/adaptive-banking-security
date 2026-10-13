export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TransactionStatus =
  | 'CREATED'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'PENDING'
  | 'FLAGGED';

export type TransactionCategory = 'TRANSFER' | 'PAYMENT' | 'WITHDRAWAL' | 'DEPOSIT' | 'INVESTMENT';

export interface TransactionMetadata {
  ip?: string;
  device?: string;
  location?: string;
  is_unusual_location?: boolean;
  is_new_device?: boolean;
  [key: string]: any;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount_cents?: number;
  amount: number;
  currency: string;
  recipient: string;
  category: TransactionCategory;
  status: TransactionStatus;
  risk_level: RiskLevel;
  risk_score: number;
  risk_reasons: string[];
  created_at: string;
  notes?: string;
  metadata?: TransactionMetadata;
  lifecycle_history?: Array<{ status: string; timestamp: string; actor?: string; reason?: string }>;
}

export interface TransactionCreatePayload {
  amount: number;
  currency: string;
  recipient: string;
  category: TransactionCategory;
  notes?: string;
  is_unusual_location: boolean;
  is_new_device: boolean;
  ip_address?: string;
  device_name?: string;
  idempotency_key?: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface ActivityPoint {
  date: string;
  amount: number;
  count: number;
}

export interface DashboardStats {
  simulated_balance: number;
  total_transactions: number;
  pending_transactions: number;
  flagged_alerts: number;
  high_risk_alerts: number;
  risk_distribution: RiskDistribution;
  recent_transactions: Transaction[];
  activity_trend: ActivityPoint[];
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  environment: string;
  database: {
    mode: 'mock_in_memory' | 'aws_dynamodb';
    table_name: string;
    region: string;
  };
  cognito: {
    user_pool_id: string;
    app_client_id: string;
    region: string;
    auth_enforced: boolean;
  };
  version: string;
}

// --- Day 2 ML Layer Types ---

export interface RiskAssessmentDetails {
  risk_score: number;
  risk_probability: number | null;
  risk_level: RiskLevel;
  recommended_action: string;
  is_anomaly: boolean;
  anomaly_score: number;
  model_version: string;
  assessment_reasons: string[];
  requires_verification: boolean;
  policy_override_applied: boolean;
  status: TransactionStatus;
}

export interface TransactionRiskResponse {
  transaction_id: string;
  amount: number;
  recipient: string;
  category: string;
  assessment: RiskAssessmentDetails;
}

export interface SpendingAnalyticsResponse {
  has_sufficient_history: boolean;
  total_spend: number;
  monthly_budget: number;
  budget_overrun: boolean;
  budget_overrun_amount: number;
  category_spending: Record<string, number>;
  daily_spending: Array<{ date: string; amount: number }>;
  message?: string;
}

export interface ForecastPoint {
  date: string;
  predicted_amount: number;
  lower_bound: number;
  upper_bound: number;
  cumulative_projected: number;
}

export interface SpendingForecastResponse {
  has_sufficient_data: boolean;
  status: string;
  methodology?: string;
  forecast_days?: number;
  daily_baseline_rate?: number;
  projected_total?: number;
  monthly_budget?: number;
  budget_risk_alert: boolean;
  forecast_points: ForecastPoint[];
  message?: string;
}

export interface ModelMetricsResponse {
  status: string;
  message?: string;
  supervised_model?: {
    model_version: string;
    selected_architecture: string;
    training_samples: number;
    validation_samples: number;
    test_samples: number;
    features: {
      numeric: string[];
      categorical: string[];
    };
    evaluation_metrics: Record<string, {
      validation: {
        f1: number;
        precision: number;
        recall: number;
        roc_auc: number;
        pr_auc: number;
      };
      test: {
        f1: number;
        precision: number;
        recall: number;
        roc_auc: number;
        pr_auc: number;
        confusion_matrix: number[][];
      };
    }>;
  };
  anomaly_detector?: {
    model_version: string;
    algorithm: string;
    contamination: number;
    training_samples: number;
    limitations_notice: string;
  };
}

// --- Day 3 Customer Security Policies & Workflows ---

export interface SecurityPolicy {
  user_id: string;
  max_single_amount_cents: number;
  daily_limit_cents: number;
  permitted_start_hour: number;
  permitted_end_hour: number;
  restricted_categories: TransactionCategory[];
  verification_risk_threshold: number;
  notification_channels: string[];
  currency: string;
  timezone: string;
}

export interface SecurityPolicyUpdatePayload {
  max_single_amount?: number;
  daily_limit?: number;
  permitted_start_hour?: number;
  permitted_end_hour?: number;
  restricted_categories?: TransactionCategory[];
  verification_risk_threshold?: number;
  notification_channels?: string[];
}

export interface EmergencyModeStatus {
  user_id: string;
  is_active: boolean;
  activated_at?: string;
  activated_by?: string;
  reason?: string;
}

export interface VerificationRecord {
  id: string;
  transaction_id: string;
  user_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  risk_score: number;
  risk_reasons: string[];
  created_at: string;
  expires_at: string;
  decided_at?: string;
  decided_by?: string;
  decision_reason?: string;
}

export interface ScheduledTransaction {
  id: string;
  user_id: string;
  amount_cents: number;
  amount: number;
  currency: string;
  recipient: string;
  category: TransactionCategory;
  execution_time: string;
  status: 'SCHEDULED' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
  description?: string;
  created_at: string;
  executed_at?: string;
  execution_tx_id?: string;
  failure_reason?: string;
}

export interface ScheduledTransactionCreatePayload {
  amount: number;
  currency: string;
  recipient: string;
  category: TransactionCategory;
  execution_time: string;
  description?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'SECURITY_ALERT' | 'VERIFICATION_REQUIRED' | 'VERIFICATION_DECISION' | 'EMERGENCY_MODE' | 'POLICY_UPDATE' | 'SCHEDULED_TX';
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  metadata?: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  user_id: string;
  action: string;
  resource_id: string;
  outcome: string;
  correlation_id?: string;
  timestamp: string;
  details: Record<string, any>;
}

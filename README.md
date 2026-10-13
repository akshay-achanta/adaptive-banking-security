# Adaptive Banking Security System

An enterprise-grade, cloud-native banking security platform featuring adaptive machine learning risk detection, customer policy enforcement, multi-step verification workflows, emergency lockdown controls, AWS CDK Infrastructure as Code, and automated CI/CD deployment.

---

## 🏛️ System Architecture

```
                                  ┌────────────────────────────────────────┐
                                  │      Amazon CloudFront CDN (OAC)       │
                                  │     d2skoyxe57scxh.cloudfront.net      │
                                  └──────────────────┬─────────────────────┘
                                                     │
                                                     ▼
                             ┌──────────────────────────────────────────────┐
                             │        Amazon S3 Static Web Hosting          │
                             │    adaptive-banking-security-akshay-2026     │
                             │          (React 18 + Vite Frontend)          │
                             └───────────────────────┬──────────────────────┘
                                                     │ API Requests
                                                     ▼
                             ┌──────────────────────────────────────────────┐
                             │       Application Load Balancer (ALB)        │
                             │                 HTTP / HTTPS                 │
                             └───────────────────────┬──────────────────────┘
                                                     │
                                                     ▼
                             ┌──────────────────────────────────────────────┐
                             │           Amazon ECS Fargate Cluster         │
                             │          FastAPI Microservice (8000)         │
                             │   - scikit-learn Hybrid ML Risk Engine       │
                             │   - Deterministic Security Policy FSM        │
                             │   - Amazon Cognito RS256 JWT Validator       │
                             └──────────┬────────────┬────────────┬─────────┘
                                        │            │            │
             ┌──────────────────────────┴┐           │            └─────────────────────────┐
             ▼                           ▼           ▼                                      ▼
┌──────────────────────────┐ ┌────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│     Amazon DynamoDB      │ │   Amazon SQS   │ │   Amazon SNS Topics     │ │ Amazon EventBridge      │
│ - Transactions           │ │ - Workflows    │ │ - High-Risk Alerts      │ │ - Scheduler Integration │
│ - Security Policies      │ │ - Dead-Letter  │ │ - Emergency Notifications│ │ - Recurring Transactions│
│ - Verifications & Audit  │ │   Queue (DLQ)  │ └─────────────────────────┘ └─────────────────────────┘
└──────────────────────────┘ └────────────────┘
```

---

## 🚀 Key Modules & Capabilities

### 1. Adaptive AI/ML Risk Intelligence Layer (Day 2)
* **Supervised Risk Classifier**: Trained Random Forest model calculating normalized transaction risk (0-100).
* **Unsupervised Anomaly Detector**: Isolation Forest identifying novel merchant and location anomalies.
* **Velocity Forecaster**: Rolling window expenditure and anomaly detection preventing fraudulent bursts.
* **Deterministic Fallback**: ML models operate in conjunction with deterministic security policies; ML scores can never override hard security boundaries.

### 2. Banking Security & Workflow Engine (Day 3)
* **Customer Security Policies**:
  * Enforced entirely backend-side using integer cents (`amount_cents`) with Python `Decimal` quantizing to `0.01` to eliminate floating-point arithmetic inaccuracies.
  * Maximum single-transaction limit.
  * Cumulative rolling 24-hour daily spend cap.
  * Permitted transaction execution window (UTC/Local timezone validated).
  * Category blocklists (`crypto`, `gambling`, `wire_transfer`, etc.).
  * ML step-up verification score threshold.
* **Transaction Lifecycle FSM**: `CREATED` $\to$ `PENDING_VERIFICATION` $\to$ `APPROVED` / `REJECTED` / `BLOCKED` / `FAILED` / `CANCELLED`.
* **Step-Up Verification Workflow**: Time-limited challenge records (15-min TTL) with concurrency locks, idempotency, and user ownership validation.
* **Emergency Mode Lockdown**: One-click user-driven freeze halting all outgoing funds with real-time alerts.
* **Scheduled Transactions**: Future transaction scheduling with execution-time policy and emergency mode re-validation.
* **Audit Trail**: Tamper-evident logging of all security actions with automatic redaction of sensitive credentials and PII.

### 3. Cloud-Native AWS Infrastructure (Day 4)
* **AWS CDK v2 (`infra/`)**: Full Infrastructure as Code stack defining:
  * Amazon ECR container repository with image scan on push.
  * Amazon ECS Fargate cluster with container insights.
  * Application Load Balanced Fargate Service with auto-healing health checks.
  * Amazon DynamoDB pay-per-request tables with Point-in-Time Recovery and `RETAIN` removal policies.
  * Amazon SQS workflow queue with 14-day Dead Letter Queue (DLQ).
  * Amazon SNS security alerts topic.
  * Amazon EventBridge Scheduler execution roles.
  * CloudWatch Log Groups (1-month retention) and Target 5XX error alarms.
* **CI/CD Pipeline (`.github/workflows/ci-cd.yml`)**:
  * Automated testing across Python 3.12 (24 pytest unit tests) and Node 20 (`npm run build`).
  * AWS OIDC Federation (no long-lived credentials).
  * ECR Docker image build & tag with Git SHA.
  * CDK deployment with protected change sets.
  * S3 static site sync & CloudFront cache invalidation.

---

## 🔒 AWS Resources (ap-southeast-2)

| Resource | Value / Identifier | Status |
| :--- | :--- | :--- |
| **AWS Region** | `ap-southeast-2` (Sydney) | Active |
| **S3 Web Hosting** | `adaptive-banking-security-akshay-2026` | Reused (Protected) |
| **CloudFront CDN** | `EMB6C8NWZM80U` (`d2skoyxe57scxh.cloudfront.net`) | Reused (Protected) |
| **Cognito User Pool** | `ap-southeast-2_YiskHVZ1k` | Reused (Protected) |
| **Cognito App Client** | `1lvft401ciiha7t0fl47nfgutf` | Reused (Protected) |
| **ECR Repository** | `adaptive-banking-backend` | Defined in CDK |
| **ECS Cluster** | `adaptive-banking-cluster` | Defined in CDK |
| **ECS Service** | `adaptive-banking-service` | Defined in CDK |
| **DynamoDB Tables** | `AdaptiveBankingTransactions`, `AdaptiveBankingSecurityPolicies`, `AdaptiveBankingVerifications`, `AdaptiveBankingScheduled`, `AdaptiveBankingNotifications`, `AdaptiveBankingAuditLogs` | Defined in CDK |
| **SQS Workflow Queue** | `adaptive-banking-workflows` (+ DLQ) | Defined in CDK |
| **SNS Alerts Topic** | `adaptive-banking-security-alerts` | Defined in CDK |

---

## 💻 Local Development Setup

### 1. Backend Service
```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\Activate.ps1
# Mac/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
pytest -v   # Run all 24 unit tests
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
* **Swagger API Docs**: `http://localhost:8000/docs`
* **Health Check**: `http://localhost:8000/health`

### 2. Frontend Web Application
```bash
cd frontend
npm install
npm run dev
```
* **Dashboard**: `http://localhost:5173`
* **Policies & Workflows**: `http://localhost:5173/workflows`
* **AI Intelligence**: `http://localhost:5173/ai-insights`

### 3. Docker Compose (Full Stack)
```bash
docker-compose up --build
```

---

## 🧪 Automated Test Suite

Run the full automated test suite covering Day 1 through Day 4:

```bash
cd backend
pytest -v
```

```
backend/tests/test_dashboard.py ......................... PASSED
backend/tests/test_health.py ............................ PASSED
backend/tests/test_ml_intelligence.py ................... PASSED
backend/tests/test_security_workflow.py ................. PASSED
backend/tests/test_transactions.py ...................... PASSED

============================= 24 passed in ~3s =============================
```

---

## 📦 Deployment via GitHub Actions

1. Create a GitHub repository and link your local repository:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```
2. In your GitHub repository settings, configure GitHub Secrets & Variables:
   * **OIDC Deployment (Recommended)**: Set secret `AWS_ROLE_TO_ASSUME` (ARN of your IAM Role configured with GitHub OIDC trust).
   * **Key-Based Deployment (Alternative)**: Set secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
3. Pushing commits to `main` triggers the automated CI/CD pipeline, validating all tests, building containers, updating ECS Fargate, deploying frontend to S3, and invalidating CloudFront.

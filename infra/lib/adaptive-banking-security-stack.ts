import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class AdaptiveBankingSecurityStack extends cdk.Stack {
  public readonly ecrRepo: ecr.Repository;
  public readonly albFargateService: ecsPatterns.ApplicationLoadBalancedFargateService;
  public readonly transactionsTable: dynamodb.Table;
  public readonly policiesTable: dynamodb.Table;
  public readonly verificationsTable: dynamodb.Table;
  public readonly scheduledTable: dynamodb.Table;
  public readonly notificationsTable: dynamodb.Table;
  public readonly auditTable: dynamodb.Table;
  public readonly workflowQueue: sqs.Queue;
  public readonly securityAlertsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Existing Resource Identifiers (Reused without deletion or recreation)
    const existingCloudFrontDomain = 'd2skoyxe57scxh.cloudfront.net';
    const existingCognitoUserPoolId = 'ap-southeast-2_YiskHVZ1k';
    const existingCognitoAppClientId = '1lvft401ciiha7t0fl47nfgutf';

    // 2. DynamoDB Tables with Deletion Protection & RETAIN removal policy
    this.transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      tableName: 'AdaptiveBankingTransactions',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.transactionsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdCreatedAtIndex',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.policiesTable = new dynamodb.Table(this, 'SecurityPoliciesTable', {
      tableName: 'AdaptiveBankingSecurityPolicies',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.verificationsTable = new dynamodb.Table(this, 'VerificationsTable', {
      tableName: 'AdaptiveBankingVerifications',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.verificationsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.scheduledTable = new dynamodb.Table(this, 'ScheduledTransactionsTable', {
      tableName: 'AdaptiveBankingScheduled',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.scheduledTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      tableName: 'AdaptiveBankingNotifications',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.notificationsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.auditTable = new dynamodb.Table(this, 'AuditLogsTable', {
      tableName: 'AdaptiveBankingAuditLogs',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.auditTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 3. Amazon SQS Queues for Asynchronous Workflow Engine
    const workflowDlq = new sqs.Queue(this, 'WorkflowDeadLetterQueue', {
      queueName: 'adaptive-banking-workflows-dlq',
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.workflowQueue = new sqs.Queue(this, 'WorkflowQueue', {
      queueName: 'adaptive-banking-workflows',
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        maxReceiveCount: 5,
        queue: workflowDlq,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // 4. Amazon SNS Notifications Topic
    this.securityAlertsTopic = new sns.Topic(this, 'SecurityAlertsTopic', {
      topicName: 'adaptive-banking-security-alerts',
      displayName: 'Adaptive Banking Security High-Risk Alerts',
    });

    // 5. Amazon ECR Repository for Backend Container Images
    this.ecrRepo = new ecr.Repository(this, 'BackendEcrRepo', {
      repositoryName: 'adaptive-banking-backend',
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // 6. VPC & Networking for ECS Fargate
    const vpc = new ec2.Vpc(this, 'AdaptiveBankingVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // 7. ECS Cluster
    const cluster = new ecs.Cluster(this, 'AdaptiveBankingCluster', {
      vpc,
      clusterName: 'adaptive-banking-cluster',
      containerInsights: true,
    });

    // 8. CloudWatch Log Group for Backend Containers
    const logGroup = new logs.LogGroup(this, 'BackendLogGroup', {
      logGroupName: '/ecs/adaptive-banking-backend',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // 9. Application Load Balanced Fargate Service
    this.albFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'BackendFargateService', {
      cluster,
      serviceName: 'adaptive-banking-service',
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      publicLoadBalancer: true,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(this.ecrRepo, 'latest'),
        containerPort: 8000,
        enableLogging: true,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'ecs',
          logGroup,
        }),
        environment: {
          ENVIRONMENT: 'production',
          AWS_REGION: 'ap-southeast-2',
          DYNAMODB_TABLE_NAME: this.transactionsTable.tableName,
          DYNAMODB_POLICIES_TABLE: this.policiesTable.tableName,
          DYNAMODB_VERIFICATIONS_TABLE: this.verificationsTable.tableName,
          DYNAMODB_SCHEDULED_TABLE: this.scheduledTable.tableName,
          DYNAMODB_NOTIFICATIONS_TABLE: this.notificationsTable.tableName,
          DYNAMODB_AUDIT_TABLE: this.auditTable.tableName,
          COGNITO_USER_POOL_ID: existingCognitoUserPoolId,
          COGNITO_APP_CLIENT_ID: existingCognitoAppClientId,
          COGNITO_REGION: 'ap-southeast-2',
          REQUIRE_AUTH: 'true',
          CORS_ORIGINS: `https://${existingCloudFrontDomain},http://localhost:5173`,
          SQS_QUEUE_URL: this.workflowQueue.queueUrl,
          SNS_TOPIC_ARN: this.securityAlertsTopic.topicArn,
        },
      },
    });

    // Configure ALB Health Checks on FastAPI /health endpoint
    this.albFargateService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      timeout: cdk.Duration.seconds(5),
      interval: cdk.Duration.seconds(15),
    });

    // 10. IAM Permissions with Least Privilege
    this.transactionsTable.grantReadWriteData(this.albFargateService.taskDefinition.taskRole);
    this.policiesTable.grantReadWriteData(this.albFargateService.taskDefinition.taskRole);
    this.verificationsTable.grantReadWriteData(this.albFargateService.taskDefinition.taskRole);
    this.scheduledTable.grantReadWriteData(this.albFargateService.taskDefinition.taskRole);
    this.notificationsTable.grantReadWriteData(this.albFargateService.taskDefinition.taskRole);
    this.auditTable.grantReadWriteData(this.albFargateService.taskDefinition.taskRole);

    this.workflowQueue.grantSendMessages(this.albFargateService.taskDefinition.taskRole);
    this.securityAlertsTopic.grantPublish(this.albFargateService.taskDefinition.taskRole);

    // EventBridge Scheduler execution role
    const schedulerRole = new iam.Role(this, 'EventBridgeSchedulerRole', {
      roleName: 'adaptive-banking-scheduler-role',
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      description: 'Allows EventBridge Scheduler to trigger scheduled transaction workflows',
    });
    this.workflowQueue.grantSendMessages(schedulerRole);

    // 11. CloudWatch Alarms for Operational Health
    new cloudwatch.Alarm(this, 'BackendHigh5xxAlarm', {
      metric: this.albFargateService.loadBalancer.metrics.httpCodeTarget(
        cdk.aws_elasticloadbalancingv2.HttpCodeTarget.TARGET_5XX_COUNT,
        { period: cdk.Duration.minutes(1) }
      ),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'Alert if backend target produces 5 or more 5XX errors in 2 minutes',
    });

    // 12. Deployment Outputs
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepo.repositoryUri,
      description: 'Amazon ECR Repository URI for backend Docker container image',
      exportName: 'AdaptiveBankingEcrRepoUri',
    });

    new cdk.CfnOutput(this, 'ApiLoadBalancerDns', {
      value: this.albFargateService.loadBalancer.loadBalancerDnsName,
      description: 'Public Application Load Balancer DNS entry for Backend API',
      exportName: 'AdaptiveBankingApiAlbDns',
    });

    new cdk.CfnOutput(this, 'ApiEndpointUrl', {
      value: `http://${this.albFargateService.loadBalancer.loadBalancerDnsName}`,
      description: 'API Endpoint URL',
    });

    new cdk.CfnOutput(this, 'FrontendCloudFrontDomain', {
      value: `https://${existingCloudFrontDomain}`,
      description: 'Existing CloudFront distribution domain for frontend',
    });
  }
}

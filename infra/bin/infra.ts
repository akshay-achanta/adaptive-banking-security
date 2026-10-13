#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AdaptiveBankingSecurityStack } from '../lib/adaptive-banking-security-stack';

const app = new cdk.App();

new AdaptiveBankingSecurityStack(app, 'AdaptiveBankingSecurityStack', {
  env: {
    region: 'ap-southeast-2',
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  },
  description: 'Adaptive Banking Security System ECS Fargate, DynamoDB, SQS, EventBridge & CloudWatch Stack',
});

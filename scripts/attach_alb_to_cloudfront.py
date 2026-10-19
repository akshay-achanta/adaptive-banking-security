"""
Attach Application Load Balancer (ALB) to existing CloudFront Distribution.
This routes:
  - /api/*
  - /health
  - /docs
  - /openapi.json
directly to the ALB over HTTP within AWS, while serving HTTPS to the browser.
This completely resolves browser "Mixed Content" errors.
"""

import sys
import copy
import boto3

DISTRIBUTION_ID = "EMB6C8NWZM80U"
ALB_DNS = "Adapti-Backe-CyXEaZ0X3vRi-835483361.ap-southeast-2.elb.amazonaws.com"
ORIGIN_ID = "AdaptiveBankingAlbBackend"

def configure_cloudfront():
    client = boto3.client("cloudfront")

    print(f"[*] Fetching configuration for CloudFront distribution {DISTRIBUTION_ID}...")
    resp = client.get_distribution_config(Id=DISTRIBUTION_ID)
    etag = resp["ETag"]
    config = resp["DistributionConfig"]

    # 1. Check or add ALB Origin
    origins = config.get("Origins", {}).get("Items", [])
    alb_origin_exists = any(o.get("Id") == ORIGIN_ID or o.get("DomainName") == ALB_DNS for o in origins)

    if not alb_origin_exists:
        print(f"[*] Adding ALB origin: {ALB_DNS}")
        alb_origin = {
            "Id": ORIGIN_ID,
            "DomainName": ALB_DNS,
            "OriginPath": "",
            "CustomHeaders": {"Quantity": 0},
            "CustomOriginConfig": {
                "HTTPPort": 80,
                "HTTPSPort": 443,
                "OriginProtocolPolicy": "http-only",
                "OriginSslProtocols": {
                    "Quantity": 1,
                    "Items": ["TLSv1.2"],
                },
                "OriginReadTimeout": 30,
                "OriginKeepaliveTimeout": 5,
            },
            "ConnectionAttempts": 3,
            "ConnectionTimeout": 10,
        }
        origins.append(alb_origin)
        config["Origins"]["Items"] = origins
        config["Origins"]["Quantity"] = len(origins)
    else:
        print(f"[+] ALB origin already present in distribution.")

    # 2. Add Cache Behaviors for /api/*, /health, /docs, /openapi.json
    cache_behaviors = config.get("CacheBehaviors", {})
    items = cache_behaviors.get("Items", [])

    # AWS Managed Policies
    CACHING_DISABLED_POLICY_ID = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    ORIGIN_REQUEST_POLICY_ID = "b680b373-e50e-47ff-b80e-3fb298ac37da"

    paths_to_route = ["/api/*", "/health", "/docs", "/openapi.json"]
    default_behavior = config.get("DefaultCacheBehavior", {})
    uses_cache_policy = "CachePolicyId" in default_behavior

    for path in paths_to_route:
        # Check if behavior already exists
        existing_idx = next((i for i, b in enumerate(items) if b["PathPattern"] == path), None)
        
        # Clone default behavior to inherit all required CloudFront fields
        behavior_def = copy.deepcopy(default_behavior)
        behavior_def["PathPattern"] = path
        behavior_def["TargetOriginId"] = ORIGIN_ID
        behavior_def["ViewerProtocolPolicy"] = "redirect-to-https"
        behavior_def["AllowedMethods"] = {
            "Quantity": 7,
            "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
            "CachedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"],
            },
        }
        behavior_def["SmoothStreaming"] = False
        behavior_def["Compress"] = True
        behavior_def["FieldLevelEncryptionId"] = ""

        if uses_cache_policy:
            behavior_def["CachePolicyId"] = CACHING_DISABLED_POLICY_ID
            behavior_def["OriginRequestPolicyId"] = ORIGIN_REQUEST_POLICY_ID
            behavior_def.pop("ForwardedValues", None)
            behavior_def.pop("MinTTL", None)
            behavior_def.pop("DefaultTTL", None)
            behavior_def.pop("MaxTTL", None)
        else:
            behavior_def["ForwardedValues"] = {
                "QueryString": True,
                "Cookies": {"Forward": "all"},
                "Headers": {
                    "Quantity": 8,
                    "Items": [
                        "Authorization",
                        "Accept",
                        "Content-Type",
                        "Origin",
                        "Referer",
                        "User-Agent",
                        "X-Forwarded-For",
                        "X-Requested-With",
                    ],
                },
                "QueryStringCacheKeys": {"Quantity": 0},
            }
            behavior_def["MinTTL"] = 0
            behavior_def["DefaultTTL"] = 0
            behavior_def["MaxTTL"] = 0
            behavior_def.pop("CachePolicyId", None)
            behavior_def.pop("OriginRequestPolicyId", None)

        # Ensure required CloudFront keys are always present
        if "LambdaFunctionAssociations" not in behavior_def:
            behavior_def["LambdaFunctionAssociations"] = {"Quantity": 0}
        if "FunctionAssociations" not in behavior_def:
            behavior_def["FunctionAssociations"] = {"Quantity": 0}

        if existing_idx is not None:
            print(f"[*] Updating existing behavior for {path}")
            items[existing_idx] = behavior_def
        else:
            print(f"[*] Adding cache behavior for {path}")
            items.append(behavior_def)

    config["CacheBehaviors"] = {
        "Quantity": len(items),
        "Items": items,
    }

    # 3. Update Distribution
    print(f"[*] Updating CloudFront distribution {DISTRIBUTION_ID}...")
    update_resp = client.update_distribution(
        DistributionConfig=config,
        Id=DISTRIBUTION_ID,
        IfMatch=etag,
    )
    status = update_resp.get("Distribution", {}).get("Status")
    print(f"[✓] CloudFront distribution successfully updated! Current status: {status}")
    print("[*] CloudFront is now deploying changes to edge locations.")

if __name__ == "__main__":
    try:
        configure_cloudfront()
    except Exception as e:
        print(f"[!] Error updating CloudFront: {e}")
        sys.exit(1)

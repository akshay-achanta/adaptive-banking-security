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
    alb_origin_exists = any(o["Id"] == ORIGIN_ID or o["DomainName"] == ALB_DNS for o in origins)

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
    # CachingDisabled: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
    # AllViewerExceptHostHeader: b680b373-e50e-47ff-b80e-3fb298ac37da
    CACHING_DISABLED_POLICY_ID = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    ORIGIN_REQUEST_POLICY_ID = "b680b373-e50e-47ff-b80e-3fb298ac37da"

    paths_to_route = ["/api/*", "/health", "/docs", "/openapi.json"]

    for path in paths_to_route:
        # Check if behavior already exists
        existing_idx = next((i for i, b in enumerate(items) if b["PathPattern"] == path), None)
        behavior_def = {
            "PathPattern": path,
            "TargetOriginId": ORIGIN_ID,
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": {
                "Quantity": 7,
                "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
                "CachedMethods": {
                    "Quantity": 2,
                    "Items": ["GET", "HEAD"],
                },
            },
            "SmoothStreaming": False,
            "Compress": True,
            "CachePolicyId": CACHING_DISABLED_POLICY_ID,
            "OriginRequestPolicyId": ORIGIN_REQUEST_POLICY_ID,
        }

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
    print("[*] CloudFront is now deploying changes to edge locations. This usually takes 1-2 minutes.")

if __name__ == "__main__":
    try:
        configure_cloudfront()
    except Exception as e:
        print(f"[!] Error updating CloudFront: {e}")
        sys.exit(1)

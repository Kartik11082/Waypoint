#!/bin/bash
set -e

[ -z "$NEWS_API_KEY" ] && echo "ERROR: NEWS_API_KEY not set" && exit 1

if command -v sam >/dev/null 2>&1; then
  SAM_CMD="sam"
elif command -v sam.cmd >/dev/null 2>&1; then
  SAM_CMD="sam.cmd"
elif [ -x "/c/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd" ]; then
  SAM_CMD="/c/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd"
else
  echo "ERROR: SAM CLI not found in Git Bash PATH"
  echo "Try: export PATH=\"/c/Program Files/Amazon/AWSSAMCLI/bin:$PATH\""
  exit 1
fi

echo "=== Building ==="
"$SAM_CMD" build

echo "=== Deploying infrastructure ==="
"$SAM_CMD" deploy --parameter-overrides "NewsApiKey=$NEWS_API_KEY"

echo "=== Getting outputs ==="
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name waypoint \
  --query "Stacks[0].Outputs[?OutputKey=='Bucket'].OutputValue" \
  --output text)

DIST=$(aws cloudformation describe-stacks \
  --stack-name waypoint \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

URL=$(aws cloudformation describe-stacks \
  --stack-name waypoint \
  --query "Stacks[0].Outputs[?OutputKey=='URL'].OutputValue" \
  --output text)

echo "=== Deploying frontend ==="
cd frontend
echo "VITE_API_URL=" > .env.production
npm run build

aws s3 sync dist/ s3://$BUCKET --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache"

aws cloudfront create-invalidation \
  --distribution-id $DIST \
  --paths "/*" > /dev/null

cd ..

echo ""
echo "✓ Live at: $URL"

#!/bin/bash
set -e
read -p "Delete everything? (yes/no): " c
[ "$c" != "yes" ] && exit 0

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

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name waypoint \
  --query "Stacks[0].Outputs[?OutputKey=='Bucket'].OutputValue" \
  --output text 2>/dev/null || echo "")

[ -n "$BUCKET" ] && aws s3 rm s3://$BUCKET --recursive

"$SAM_CMD" delete --stack-name waypoint --no-prompts
echo "Done"

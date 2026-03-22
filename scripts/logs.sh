#!/bin/bash
SAM_BIN="${SAM_BIN:-sam}"
if ! command -v "$SAM_BIN" >/dev/null 2>&1; then
  if command -v sam.cmd >/dev/null 2>&1; then
    SAM_BIN="sam.cmd"
  elif [ -x "/c/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd" ]; then
    SAM_BIN="/c/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd"
  else
    echo "ERROR: SAM CLI not found in Bash."
    echo "Install SAM CLI or set SAM_BIN to the executable path."
    exit 1
  fi
fi

echo "Streaming Waypoint Lambda logs..."
"$SAM_BIN" logs \
  --name WaypointFunction \
  --stack-name waypoint \
  --tail \
  --filter "ERROR"

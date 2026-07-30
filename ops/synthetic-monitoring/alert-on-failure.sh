#!/bin/bash
set -euo pipefail

SERVICE_URL="${1:-unknown}"
FAILURE_COUNT="${2:-0}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
LOG_FILE="/var/log/vaeloom-health.log"

if [ -z "$SLACK_WEBHOOK" ]; then
  echo "$(date -u -Iseconds) WARN: SLACK_WEBHOOK_URL not set, skipping alert" >> "$LOG_FILE"
  exit 0
fi

MESSAGE="{\"channel\":\"#vaeloom-alerts\",\"username\":\"Synthetic Monitor\",\"text\":\":fire: *Vaeloom Health Alert*\nService: $SERVICE_URL\nConsecutive failures: $FAILURE_COUNT\nTime: $(date -u -Iseconds)\nAction: Investigate immediately — runbook: ops/runbooks/service-down.md\",\"icon_emoji\":\":fire:\"}"

curl -s -X POST -H "Content-Type: application/json" -d "$MESSAGE" "$SLACK_WEBHOOK" > /dev/null 2>&1 || true

echo "$(date -u -Iseconds) ALERT_SENT: $SERVICE_URL ($FAILURE_COUNT failures)" >> "$LOG_FILE"

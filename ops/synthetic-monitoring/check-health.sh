#!/bin/bash
set -euo pipefail

HEALTH_URL="${1:-http://localhost:8000}"
INTERVAL="${2:-30}"
LOG_FILE="/var/log/vaeloom-health.log"
FAILURE_FILE="/tmp/vaeloom-health-failures"

check_endpoint() {
  local url="$1"
  local label="$2"
  local status_code
  status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")

  if [ "$status_code" = "200" ] || [ "$status_code" = "204" ]; then
    echo "$(date -u -Iseconds) OK $label $status_code" >> "$LOG_FILE"
    echo 0
  else
    echo "$(date -u -Iseconds) FAIL $label $status_code" >> "$LOG_FILE"
    echo 1
  fi
}

check_and_track() {
  local url="$1"
  local label="$2"
  local result
  result=$(check_endpoint "$url" "$label")

  if [ "$result" = "1" ]; then
    if [ -f "$FAILURE_FILE" ]; then
      local count
      count=$(cat "$FAILURE_FILE")
      count=$((count + 1))
      echo "$count" > "$FAILURE_FILE"
    else
      echo "1" > "$FAILURE_FILE"
    fi
  else
    echo "0" > "$FAILURE_FILE"
  fi
}

echo "Starting health check loop — targets: $HEALTH_URL"

while true; do
  check_and_track "$HEALTH_URL/health" "liveness"
  check_and_track "$HEALTH_URL/health/ready" "readiness"
  check_and_track "$HEALTH_URL/health/startup" "startup"

  if [ -f "$FAILURE_FILE" ]; then
    local count
    count=$(cat "$FAILURE_FILE")
    if [ "$count" -ge 3 ]; then
      echo "$(date -u -Iseconds) ALERT: 3 consecutive failures detected" >> "$LOG_FILE"
      bash "$(dirname "$0")/alert-on-failure.sh" "$HEALTH_URL" "$count"
    fi
  fi

  sleep "$INTERVAL"
done

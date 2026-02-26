#!/usr/bin/env bash
set -u

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
RECOVERY_ATTEMPTS=0
MAX_RECOVERY_ATTEMPTS=3

if [ "${1:-}" != "" ]; then
  TEST_URL="$1"
else
  TEST_URL="exp://127.0.0.1:8081"
fi

pass() {
  echo "[PASS] $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

warn() {
  echo "[WARN] $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

fail() {
  echo "[FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

recover_coresimulator() {
  if [ "${RECOVERY_ATTEMPTS}" -ge "${MAX_RECOVERY_ATTEMPTS}" ]; then
    return 1
  fi
  RECOVERY_ATTEMPTS=$((RECOVERY_ATTEMPTS + 1))
  warn "CoreSimulator issue detected. Attempting automatic recovery (${RECOVERY_ATTEMPTS}/${MAX_RECOVERY_ATTEMPTS})."
  xcrun simctl shutdown all >/dev/null 2>&1 || true
  killall Simulator >/dev/null 2>&1 || true
  open -a Simulator >/dev/null 2>&1 || true
  sleep 2
  # Device service can take time to come back; caller will continue retry loop.
  wait_for_device_service >/dev/null 2>&1 || true
  return 0
}

list_available_devices() {
  xcrun simctl list devices available 2>/dev/null || true
}

wait_for_device_service() {
  local attempts=0
  local max_attempts=8
  while [ "${attempts}" -lt "${max_attempts}" ]; do
    local output
    output="$(list_available_devices)"
    if printf "%s\n" "${output}" | grep -qE '\([0-9A-Fa-f-]{8,}\)'; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  return 1
}

echo "iOS Simulator + Expo health check"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Test URL: ${TEST_URL}"
echo

if ! command -v xcrun >/dev/null 2>&1; then
  fail "xcrun is not available. Install Xcode command line tools."
  echo
  echo "Summary: ${PASS_COUNT} pass, ${WARN_COUNT} warn, ${FAIL_COUNT} fail"
  exit 1
fi

if ! command -v lsof >/dev/null 2>&1; then
  warn "lsof is not available; skipping Metro port check."
fi

DEVELOPER_DIR="$(xcode-select -p 2>/dev/null || true)"
if [ -n "${DEVELOPER_DIR}" ]; then
  pass "xcode-select points to ${DEVELOPER_DIR}"
else
  fail "xcode-select has no active developer directory."
fi

BOOTED_UDID=""
while [ -z "${BOOTED_UDID}" ]; do
  if ! wait_for_device_service; then
    if ! recover_coresimulator; then
      fail "No booted simulator device found."
      break
    fi
  fi

  DEVICES_LIST="$(list_available_devices)"
  BOOTED_UDID="$(printf "%s\n" "${DEVICES_LIST}" | sed -n 's/.*(\([0-9A-Fa-f-]*\)) (Booted).*/\1/p' | head -n 1)"
  if [ -n "${BOOTED_UDID}" ]; then
    pass "Booted simulator UDID: ${BOOTED_UDID}"
    break
  fi

  CANDIDATE_UDID="$(printf "%s\n" "${DEVICES_LIST}" | sed -n 's/.*iPhone.*(\([0-9A-Fa-f-]*\)) (Shutdown).*/\1/p' | head -n 1)"
  if [ -n "${CANDIDATE_UDID}" ] && xcrun simctl boot "${CANDIDATE_UDID}" >/dev/null 2>&1; then
    xcrun simctl bootstatus "${CANDIDATE_UDID}" -b >/dev/null 2>&1 || true
    BOOTED_UDID="${CANDIDATE_UDID}"
    pass "Booted simulator automatically: ${BOOTED_UDID}"
    break
  fi

  if ! recover_coresimulator; then
    warn "No booted simulator device found after recovery attempts. Skipping simulator-specific URL checks."
    break
  fi
done

if [ -n "${BOOTED_UDID}" ]; then
  if xcrun simctl listapps "${BOOTED_UDID}" 2>/dev/null | grep -q '"host.exp.Exponent"'; then
    pass "Expo Go is installed on booted simulator."
  else
    warn "Expo Go (host.exp.Exponent) not found on booted simulator."
  fi
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
    pass "Metro is listening on TCP 8081."
  else
    warn "No listener found on TCP 8081. Start Expo with: npx expo start"
  fi
fi

if [ -n "${BOOTED_UDID}" ]; then
  if xcrun simctl openurl "${BOOTED_UDID}" "https://expo.dev" >/dev/null 2>&1; then
    pass "Simulator can open https URL via simctl openurl."
  else
    if recover_coresimulator && xcrun simctl openurl "${BOOTED_UDID}" "https://expo.dev" >/dev/null 2>&1; then
      pass "Simulator can open https URL via simctl openurl (after recovery)."
    else
      fail "Simulator failed to open https URL via simctl openurl."
    fi
  fi

  if xcrun simctl openurl "${BOOTED_UDID}" "${TEST_URL}" >/dev/null 2>&1; then
    pass "Simulator accepted ${TEST_URL} via simctl openurl."
  else
    if recover_coresimulator && xcrun simctl openurl "${BOOTED_UDID}" "${TEST_URL}" >/dev/null 2>&1; then
      pass "Simulator accepted ${TEST_URL} via simctl openurl (after recovery)."
    else
      fail "Simulator failed to open ${TEST_URL} via simctl openurl."
    fi
  fi
fi

echo
echo "Summary: ${PASS_COUNT} pass, ${WARN_COUNT} warn, ${FAIL_COUNT} fail"

if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo "Suggested recovery:"
  echo "  xcrun simctl shutdown all"
  echo "  killall Simulator"
  echo "  open -a Simulator"
  echo "  npx expo start -c"
  exit 1
fi

exit 0

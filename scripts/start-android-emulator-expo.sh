#!/usr/bin/env bash
set -euo pipefail

AVD_NAME="${1:-Medium_Phone_API_36.1}"
BOOT_TIMEOUT_SECONDS="${BOOT_TIMEOUT_SECONDS:-360}"
EMULATOR_LOG_FILE="${EMULATOR_LOG_FILE:-/tmp/shiftor-android-emulator.log}"
EMULATOR_SNAPSHOT_MODE="${EMULATOR_SNAPSHOT_MODE:-cold}"

resolve_sdk_root() {
  if [ -n "${ANDROID_HOME:-}" ]; then
    printf '%s\n' "${ANDROID_HOME}"
    return 0
  fi

  if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
    printf '%s\n' "${ANDROID_SDK_ROOT}"
    return 0
  fi

  local default_root
  default_root="${HOME}/Library/Android/sdk"
  if [ -d "${default_root}" ]; then
    printf '%s\n' "${default_root}"
    return 0
  fi

  return 1
}

find_running_emulator() {
  adb devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1; exit }'
}

find_attached_emulator() {
  adb devices | awk '$1 ~ /^emulator-/ { print $1; exit }'
}

find_emulator_adb_port() {
  local running_dir ini_file avd_id port
  running_dir="${HOME}/Library/Caches/TemporaryItems/avd/running"
  if [ ! -d "${running_dir}" ]; then
    return 1
  fi

  for ini_file in "${running_dir}"/pid_*.ini; do
    [ -f "${ini_file}" ] || continue
    avd_id="$(awk -F= '$1=="avd.id" { print $2 }' "${ini_file}" | tr -d '\r')"
    if [ "${avd_id}" != "${AVD_NAME}" ]; then
      continue
    fi
    port="$(awk -F= '$1=="port.adb" { print $2 }' "${ini_file}" | tr -d '\r')"
    if [ -n "${port}" ]; then
      printf '%s\n' "${port}"
      return 0
    fi
  done

  return 1
}

wait_for_emulator() {
  local started_at serial boot_completed boot_anim adb_port
  started_at="$(date +%s)"

  while :; do
    adb_port="$(find_emulator_adb_port || true)"
    if [ -n "${adb_port}" ]; then
      adb connect "127.0.0.1:${adb_port}" >/dev/null 2>&1 || true
    fi

    serial="$(find_attached_emulator)"
    if [ -n "${serial}" ]; then
      boot_completed="$(adb -s "${serial}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
      boot_anim="$(adb -s "${serial}" shell getprop init.svc.bootanim 2>/dev/null | tr -d '\r')"
      if [ "${boot_completed}" = "1" ] && [ "${boot_anim}" = "stopped" ]; then
        printf '%s\n' "${serial}"
        return 0
      fi
    fi

    if [ $(( $(date +%s) - started_at )) -ge "${BOOT_TIMEOUT_SECONDS}" ]; then
      echo "Error: It took too long to start the Android emulator: ${AVD_NAME}." >&2
      echo "You can try starting the emulator manually from the terminal with:" >&2
      echo "  ${EMULATOR_BIN} @${AVD_NAME}" >&2
      if [ -f "${EMULATOR_LOG_FILE}" ]; then
        echo "Last emulator log lines:" >&2
        tail -n 20 "${EMULATOR_LOG_FILE}" >&2 || true
      fi
      exit 1
    fi

    sleep 2
  done
}

if ! command -v adb >/dev/null 2>&1; then
  echo "Error: adb is not installed or not in PATH." >&2
  exit 1
fi

SDK_ROOT="$(resolve_sdk_root)" || {
  echo "Error: Unable to resolve the Android SDK path. Set ANDROID_HOME or ANDROID_SDK_ROOT." >&2
  exit 1
}

EMULATOR_BIN="${SDK_ROOT}/emulator/emulator"
if [ ! -x "${EMULATOR_BIN}" ]; then
  echo "Error: Android emulator binary not found at ${EMULATOR_BIN}." >&2
  exit 1
fi

adb kill-server >/dev/null 2>&1 || true
sleep 1
adb start-server >/dev/null 2>&1 || true

SERIAL="$(find_running_emulator)"
if [ -z "${SERIAL}" ]; then
  echo "Starting Android emulator: ${AVD_NAME} (cold boots can take a few minutes)"
  EMULATOR_ARGS=(@"${AVD_NAME}")
  if [ "${EMULATOR_SNAPSHOT_MODE}" = "cold" ]; then
    EMULATOR_ARGS+=("-no-snapshot-load")
  fi
  nohup "${EMULATOR_BIN}" "${EMULATOR_ARGS[@]}" >"${EMULATOR_LOG_FILE}" 2>&1 &
else
  echo "Reusing running Android emulator: ${SERIAL}"
fi

SERIAL="$(wait_for_emulator)"
echo "Android emulator ready: ${SERIAL}"

adb -s "${SERIAL}" reverse tcp:8081 tcp:8081 >/dev/null
echo "adb reverse set: tcp:8081 -> tcp:8081"

echo "Starting Expo Metro for Android emulator..."
exec npx expo start --localhost --dev-client -c

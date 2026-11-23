#!/usr/bin/env bash
# Builds the app for an iOS simulator, installs it and runs the Maestro flows.
# Needs macOS with Xcode, Maestro, and the e2e API on :4000 (`pnpm e2e:api`).
#
#   pnpm --filter @churchflow/mobile e2e:ios            # all flows
#   pnpm --filter @churchflow/mobile e2e:ios flows/smoke.yaml
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ARTIFACTS="e2e/artifacts"
mkdir -p "$ARTIFACTS"

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://localhost:4000/v1}"
export CI="${CI:-1}"

# Prefer a booted iPhone simulator, otherwise the newest available one.
UDID="${SIMULATOR_UDID:-$(xcrun simctl list devices available -j | node -e '
  const { devices } = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const phones = Object.entries(devices)
    .filter(([runtime]) => runtime.includes("iOS"))
    .flatMap(([runtime, list]) => list.map((d) => ({ ...d, runtime })))
    .filter((d) => d.name.startsWith("iPhone"));
  const pick = phones.find((d) => d.state === "Booted") ?? phones.sort((a, b) => b.runtime.localeCompare(a.runtime))[0];
  if (!pick) { console.error("No iPhone simulator available"); process.exit(1); }
  process.stdout.write(pick.udid);
')}"
echo "› Using simulator $UDID"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "› Building and installing a Release build (API: $EXPO_PUBLIC_API_URL)"
  npx expo run:ios --configuration Release --no-bundler --device "$UDID" 2>&1 | tee "$ARTIFACTS/ios-build.log"
fi

FLOWS=("${@:-e2e/flows}")
FLOW_ARGS=()
for flow in "${FLOWS[@]}"; do
  if [[ -e "$flow" ]]; then FLOW_ARGS+=("$flow"); else FLOW_ARGS+=("e2e/$flow"); fi
done

echo "› Running Maestro: ${FLOW_ARGS[*]}"
maestro --device "$UDID" test "${FLOW_ARGS[@]}" \
  --format junit --output "$ARTIFACTS/maestro-report.xml" \
  --test-output-dir "$ARTIFACTS/maestro"

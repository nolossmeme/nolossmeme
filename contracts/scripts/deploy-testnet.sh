#!/usr/bin/env bash
# Deploy a fresh factory to testnet and launch a first pool.
#
#   contracts/scripts/deploy-testnet.sh <factory-account.testnet> [slug] [symbol] [name]
#
# Requires cargo-near and near-cli-rs, and a full-access key for the factory account in
# the legacy keychain (~/.near-credentials). The pool code is stored once and frozen.
set -euo pipefail

FACTORY="${1:?factory account, e.g. nolossmeme.testnet}"
SLUG="${2:-dogn}"
SYMBOL="${3:-DOGN}"
NAME="${4:-Doge of NEAR}"
STAKING_POOL="${STAKING_POOL:-meta-v2.pool.testnet}"
NET="network-config testnet sign-with-legacy-keychain send"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

echo "==> building wasm"
cargo near build non-reproducible-wasm --manifest-path meme-pool/Cargo.toml >/dev/null
cargo near build non-reproducible-wasm --manifest-path factory/Cargo.toml >/dev/null

echo "==> deploying factory to $FACTORY"
near contract deploy "$FACTORY" use-file target/near/factory/factory.wasm \
  with-init-call new json-args "{\"staking_pool\":\"$STAKING_POOL\"}" \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' $NET

echo "==> storing pool code (one-time)"
TMP="$(mktemp -t nolossmeme.XXXXXX.json)"
python3 - "$TMP" <<'PY'
import base64, json, sys
json.dump({"code": base64.b64encode(open("target/near/meme_pool/meme_pool.wasm", "rb").read()).decode()}, open(sys.argv[1], "w"))
PY
near contract call-function as-transaction "$FACTORY" store_pool_code file-args "$TMP" \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' sign-as "$FACTORY" $NET
rm -f "$TMP"

echo "==> launching $SLUG.$FACTORY ($SYMBOL, hourly epochs)"
near contract call-function as-transaction "$FACTORY" create_meme json-args "{
  \"slug\":\"$SLUG\",\"name\":\"$NAME\",\"symbol\":\"$SYMBOL\",\"icon\":null,
  \"params\":{\"epoch_length_ns\":\"3600000000000\",\"initial_emission\":\"1000000000000000000000\",
  \"halving_every\":168,\"jackpot_bps\":7000,\"streak_step_bps\":1000,\"max_streak_bonus_bps\":5000,
  \"min_deposit\":\"100000000000000000000000\"}}" \
  prepaid-gas '300 Tgas' attached-deposit '3.5 NEAR' sign-as "$FACTORY" $NET

echo "==> done: factory=$FACTORY pool=$SLUG.$FACTORY"

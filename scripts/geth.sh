#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "${GETH_BIN:-}" ]]; then
  geth_bin="$GETH_BIN"
elif command -v geth >/dev/null 2>&1; then
  geth_bin="$(command -v geth)"
elif [[ -x .tools/ethereum/1.17.10/bin/geth ]]; then
  geth_bin="$PWD/.tools/ethereum/1.17.10/bin/geth"
else
  echo 'Geth is missing. macOS: brew install ethereum. Or set GETH_BIN to your geth executable.' >&2
  exit 1
fi
exec "$geth_bin" --dev --datadir ./geth-data --http --http.addr 127.0.0.1 --http.port "${GETH_PORT:-8545}" --http.api eth,net,web3 --ipcdisable "$@"

#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <cert-file> [out-b64-file]"
  echo "If out file omitted, prints base64 to stdout (no linewrap)."
  exit 2
fi

CERT="$1"
OUT=${2:-"-"}

if [ ! -f "$CERT" ]; then
  echo "Cert file not found: $CERT" >&2
  exit 3
fi

if [ "$OUT" = "-" ]; then
  base64 -w0 "$CERT"
else
  base64 -w0 "$CERT" > "$OUT"
  echo "Wrote $OUT"
fi

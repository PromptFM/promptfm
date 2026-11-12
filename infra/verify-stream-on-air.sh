#!/usr/bin/env bash
set -euo pipefail

exec node scripts/verify-stream-on-air.cjs "$@"

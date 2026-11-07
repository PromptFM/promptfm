#!/usr/bin/env bash
# scripts/vercel-budget-gate.sh
# Invoked by Vercel's ignoreCommand to enforce the PromptFM $0 Infra Budget Policy.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
node "$DIR/vercel-budget-gate.js"


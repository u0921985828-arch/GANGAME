#!/usr/bin/env bash
# Point git at the versioned .hooks/ directory. Idempotent — safe to re-run.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

chmod +x .hooks/* 2>/dev/null || true

# Prefer core.hooksPath (git >= 2.9): keeps hooks versioned, no copying.
if git config core.hooksPath >/dev/null 2>&1 && [ "$(git config core.hooksPath || true)" = ".hooks" ]; then
  echo "✓ hooks already installed (core.hooksPath=.hooks)"
else
  git config core.hooksPath .hooks
  echo "✓ hooks installed (core.hooksPath=.hooks)"
fi

#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: run-agy-handoff.sh <prompt-file> [timeout]" >&2
  exit 64
fi

prompt_file="$1"
timeout="${2:-5m}"

if [[ ! -f "$prompt_file" ]]; then
  echo "Prompt file not found: $prompt_file" >&2
  exit 66
fi

agy --print "$(cat "$prompt_file")" --print-timeout "$timeout"

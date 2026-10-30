#!/usr/bin/env bash
set -euo pipefail
commit="$(git rev-parse HEAD)"
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then estado=modificado; else estado=limpio; fi
printf '%s %s\n' "$commit" "$estado"

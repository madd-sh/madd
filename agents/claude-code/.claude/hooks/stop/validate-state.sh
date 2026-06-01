#!/bin/bash
# Validate state.json integrity on agent stop
if [ -f .madd/state.json ]; then
  jq empty .madd/state.json 2>/dev/null || echo "WARNING: state.json is invalid JSON" >&2
fi

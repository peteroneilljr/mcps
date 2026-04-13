#!/usr/bin/env bash
set -euo pipefail

export VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"

MCP_TOKEN_FILE="/workspace/claude-code/vault/.mcp-token"
if [ -f "$MCP_TOKEN_FILE" ]; then
  export VAULT_TOKEN=$(cat "$MCP_TOKEN_FILE")
fi

exec node --experimental-strip-types /workspace/mcps/vault-mcp-server/src/index.ts

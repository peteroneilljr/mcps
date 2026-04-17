#!/usr/bin/env bash
set -euo pipefail

# Start the Vault MCP HTTP server in the background
# Called from the container entrypoint, similar to start-teleport.sh

export VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"

MCP_TOKEN_FILE="/workspace/claude-code/vault/.mcp-token"
if [ -f "$MCP_TOKEN_FILE" ]; then
  export VAULT_TOKEN=$(cat "$MCP_TOKEN_FILE")
fi

export MCP_HTTP_PORT="${MCP_HTTP_PORT:-3100}"

echo "Starting Vault MCP HTTP server on port ${MCP_HTTP_PORT}..."
node --experimental-strip-types /workspace/mcps/vault-mcp-server/src/http-server.ts &

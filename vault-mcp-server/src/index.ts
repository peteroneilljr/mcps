import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { health } from "./vault-client.ts";
import { config } from "./config.ts";
import { createVaultMcpServer } from "./server.ts";

const server = createVaultMcpServer();

// Startup health check — log to stderr, never fail
async function healthCheck() {
  const result = await health();
  if (result.includes("not reachable") || result.includes("failed")) {
    console.error(`[vault-mcp] Warning: ${result}`);
    console.error(`[vault-mcp] Ensure Vault is running at ${config.vaultAddr}`);
  } else {
    console.error(`[vault-mcp] Connected to Vault at ${config.vaultAddr}`);
    console.error(`[vault-mcp] ${result.split("\n")[0]}`);
  }
  if (!config.vaultToken) {
    console.error("[vault-mcp] Warning: VAULT_TOKEN is not set. All secret operations will fail.");
  }
}

await healthCheck();

const transport = new StdioServerTransport();
await server.connect(transport);

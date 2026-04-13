import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { health } from "./vault-client.ts";
import { config } from "./config.ts";
import { registerStatusTools } from "./tools/status.ts";
import { registerSecretTools } from "./tools/secrets.ts";
import { registerMetadataTools } from "./tools/metadata.ts";

const server = new McpServer({
  name: "vault",
  version: "1.0.0",
});

registerStatusTools(server);
registerSecretTools(server);
registerMetadataTools(server);

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

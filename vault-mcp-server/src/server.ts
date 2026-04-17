import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStatusTools } from "./tools/status.ts";
import { registerSecretTools } from "./tools/secrets.ts";
import { registerMetadataTools } from "./tools/metadata.ts";

export function createVaultMcpServer(): McpServer {
  const server = new McpServer({
    name: "vault",
    version: "1.0.0",
  });

  registerStatusTools(server);
  registerSecretTools(server);
  registerMetadataTools(server);

  return server;
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { health } from "../vault-client.ts";

export function registerStatusTools(server: McpServer) {
  server.tool(
    "vault_status",
    "Check Vault server health: initialized, sealed, version, cluster name",
    {},
    async () => {
      const result = await health();
      return { content: [{ type: "text" as const, text: result }] };
    },
  );
}

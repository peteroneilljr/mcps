import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMetadata, isVaultError } from "../vault-client.ts";

export function registerMetadataTools(server: McpServer) {
  server.tool(
    "get_secret_metadata",
    "Get version history and metadata for a secret: version count, created/updated times, custom metadata.",
    {
      path: z.string().describe("Secret path to get metadata for (e.g. 'api-keys/anthropic')"),
    },
    async ({ path }) => {
      try {
        const result = await getMetadata(path);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = isVaultError(err) ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}

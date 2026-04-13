import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSecret, writeSecret, listSecrets, deleteSecret, isVaultError } from "../vault-client.ts";

export function registerSecretTools(server: McpServer) {
  server.tool(
    "read_secret",
    "Read a secret from Vault. Returns all key-value pairs, or a single field if key is specified.",
    {
      path: z.string().describe("Secret path relative to the kv mount (e.g. 'api-keys/anthropic')"),
      key: z.string().optional().describe("Optional: return only this field from the secret"),
    },
    async ({ path, key }) => {
      try {
        const result = await readSecret(path, key);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = isVaultError(err) ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "write_secret",
    "Write or update a secret in Vault. Data is a JSON object of key-value pairs.",
    {
      path: z.string().describe("Secret path relative to the kv mount (e.g. 'api-keys/stripe')"),
      data: z.string().describe("JSON string of key-value pairs (e.g. '{\"api_key\": \"sk-...\"}')"),
    },
    async ({ path, data }) => {
      let parsed: Record<string, string>;
      try {
        parsed = JSON.parse(data);
      } catch {
        return { content: [{ type: "text" as const, text: "Error: data must be a valid JSON string" }], isError: true };
      }

      try {
        const result = await writeSecret(path, parsed);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = isVaultError(err) ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "list_secrets",
    "List secret paths under a prefix. Trailing '/' on entries indicates a directory.",
    {
      prefix: z.string().optional().default("").describe("Path prefix to list under (default: root of kv mount)"),
    },
    async ({ prefix }) => {
      try {
        const result = await listSecrets(prefix);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = isVaultError(err) ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  server.tool(
    "delete_secret",
    "Permanently delete a secret from Vault (all versions and metadata are purged).",
    {
      path: z.string().describe("Secret path to delete (e.g. 'test/hello')"),
    },
    async ({ path }) => {
      try {
        const result = await deleteSecret(path);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = isVaultError(err) ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    },
  );
}

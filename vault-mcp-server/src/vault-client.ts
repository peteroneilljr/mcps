import { config } from "./config.ts";

export interface VaultError {
  status: number;
  message: string;
  errors: string[];
}

interface VaultResponse {
  data?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  errors?: string[];
}

interface KvReadResponse {
  data: {
    data: Record<string, string>;
    metadata: {
      version: number;
      created_time: string;
      deletion_time: string;
      destroyed: boolean;
      custom_metadata: Record<string, string> | null;
    };
  };
}

interface KvMetadataResponse {
  data: {
    cas_required: boolean;
    created_time: string;
    current_version: number;
    max_versions: number;
    oldest_version: number;
    updated_time: string;
    versions: Record<string, {
      created_time: string;
      deletion_time: string;
      destroyed: boolean;
    }>;
    custom_metadata: Record<string, string> | null;
  };
}

interface KvListResponse {
  data: {
    keys: string[];
  };
}

interface HealthResponse {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
  performance_standby: boolean;
  replication_performance_mode: string;
  replication_dr_mode: string;
  server_time_utc: number;
  version: string;
  cluster_name: string;
  cluster_id: string;
}

function createVaultError(status: number, body: VaultResponse | null): VaultError {
  if (body?.errors?.length) {
    return { status, message: body.errors.join("; "), errors: body.errors };
  }
  if (status === 403) {
    return { status, message: "Permission denied. Check the Vault token and policy.", errors: [] };
  }
  if (status === 503) {
    return { status, message: "Vault is sealed. Run vault-unseal.sh first.", errors: [] };
  }
  return { status, message: `Vault returned HTTP ${status}`, errors: [] };
}

async function vaultRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${config.vaultAddr}/v1/${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.vaultToken) {
    headers["X-Vault-Token"] = config.vaultToken;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(config.requestTimeout),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      throw { status: 0, message: `Cannot connect to Vault at ${config.vaultAddr}. Is it running?`, errors: [] } as VaultError;
    }
    if (msg.includes("timed out") || msg.includes("TimeoutError")) {
      throw { status: 0, message: `Request to Vault timed out after ${config.requestTimeout}ms`, errors: [] } as VaultError;
    }
    throw { status: 0, message: msg, errors: [] } as VaultError;
  }

  if (response.status === 204) {
    return null;
  }

  let responseBody: VaultResponse | null = null;
  try {
    responseBody = await response.json() as VaultResponse;
  } catch {
    // Some endpoints return no body
  }

  if (!response.ok) {
    throw createVaultError(response.status, responseBody);
  }

  return responseBody;
}

export async function readSecret(path: string, key?: string): Promise<string> {
  const response = await vaultRequest("GET", `${config.kvMount}/data/${path}`) as KvReadResponse;
  const data = response.data.data;

  if (key) {
    if (!(key in data)) {
      throw { status: 404, message: `Key "${key}" not found in secret at ${path}`, errors: [] } as VaultError;
    }
    return data[key];
  }

  return JSON.stringify(data, null, 2);
}

export async function writeSecret(path: string, data: Record<string, string>): Promise<string> {
  await vaultRequest("POST", `${config.kvMount}/data/${path}`, { data });
  return `Secret written to ${path}`;
}

export async function listSecrets(prefix: string): Promise<string> {
  const listPath = prefix
    ? `${config.kvMount}/metadata/${prefix}`
    : `${config.kvMount}/metadata/`;

  try {
    const response = await vaultRequest("LIST", listPath) as KvListResponse;
    return response.data.keys.join("\n");
  } catch (err) {
    const ve = err as VaultError;
    if (ve.status === 404) {
      return "No secrets found at this path.";
    }
    throw err;
  }
}

export async function deleteSecret(path: string): Promise<string> {
  await vaultRequest("DELETE", `${config.kvMount}/metadata/${path}`);
  return `Secret at ${path} deleted (all versions purged).`;
}

export async function getMetadata(path: string): Promise<string> {
  const response = await vaultRequest("GET", `${config.kvMount}/metadata/${path}`) as KvMetadataResponse;
  const meta = response.data;

  const lines = [
    `Path:            ${path}`,
    `Current version: ${meta.current_version}`,
    `Oldest version:  ${meta.oldest_version}`,
    `Max versions:    ${meta.max_versions}`,
    `Created:         ${meta.created_time}`,
    `Updated:         ${meta.updated_time}`,
    `CAS required:    ${meta.cas_required}`,
    "",
    "Versions:",
  ];

  for (const [version, info] of Object.entries(meta.versions)) {
    const status = info.destroyed ? " (destroyed)" : info.deletion_time ? " (deleted)" : "";
    lines.push(`  v${version}: created ${info.created_time}${status}`);
  }

  if (meta.custom_metadata && Object.keys(meta.custom_metadata).length > 0) {
    lines.push("", "Custom metadata:");
    for (const [k, v] of Object.entries(meta.custom_metadata)) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  return lines.join("\n");
}

export async function health(): Promise<string> {
  // /sys/health returns non-200 for sealed/standby but still has valid JSON
  const url = `${config.vaultAddr}/v1/sys/health`;
  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(config.requestTimeout),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return `Vault is not reachable at ${config.vaultAddr}. Is it running?`;
    }
    return `Health check failed: ${msg}`;
  }

  let body: HealthResponse;
  try {
    body = await response.json() as HealthResponse;
  } catch {
    return `Vault returned HTTP ${response.status} but no valid JSON body.`;
  }

  const lines = [
    `Initialized: ${body.initialized}`,
    `Sealed:      ${body.sealed}`,
    `Version:     ${body.version}`,
    `Cluster:     ${body.cluster_name}`,
    `Standby:     ${body.standby}`,
  ];

  return lines.join("\n");
}

export function isVaultError(err: unknown): err is VaultError {
  return typeof err === "object" && err !== null && "status" in err && "message" in err;
}

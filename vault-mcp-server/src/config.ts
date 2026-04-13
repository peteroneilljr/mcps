export const config = {
  vaultAddr: process.env.VAULT_ADDR ?? "http://vault:8200",
  vaultToken: process.env.VAULT_TOKEN ?? "",
  kvMount: process.env.VAULT_KV_MOUNT ?? "secret",
  requestTimeout: parseInt(process.env.VAULT_TIMEOUT ?? "5000", 10),
};

import type { NetworkConfig } from "./types.js";

/**
 * Canonical SkillMint backend endpoints, proxied through the project's
 * Vercel deployment so SDK consumers don't need to know any raw EC2 IPs.
 * Rewrite rules live in frontend/next.config.ts. Swap for a real domain
 * once one is purchased.
 */
const PROXY_BASE = "https://skillmint-0g.vercel.app";

export const TESTNET: NetworkConfig = {
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  chainScan: "https://chainscan-galileo.0g.ai",
  storageScan: "https://storagescan-galileo.0g.ai",
  storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
  registry: "0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4",
  escrow: "0xe2841b105B695610f2c1194f8865474A536184dB",
  w0g: "0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D",
  x402Network: "0g-testnet",
  oracleUrl: `${PROXY_BASE}/api/oracle`,
  x402Url: `${PROXY_BASE}/api/x402`,
};

export const MAINNET: NetworkConfig = {
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  chainScan: "https://chainscan.0g.ai",
  storageScan: "https://storagescan.0g.ai",
  storageIndexer: "https://indexer-storage-turbo.0g.ai",
  registry: "",
  escrow: "",
  w0g: "0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c",
  x402Network: "0g-mainnet",
  oracleUrl: `${PROXY_BASE}/api/oracle`,
  x402Url: `${PROXY_BASE}/api/x402`,
};

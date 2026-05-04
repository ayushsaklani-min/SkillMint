import type { NetworkConfig } from "./types.js";

const PROXY_BASE = "https://skillmint-0g.vercel.app";

export const TESTNET: NetworkConfig = {
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  chainScan: "https://chainscan-galileo.0g.ai",
  storageScan: "https://storagescan-galileo.0g.ai",
  storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
  registry: "<TESTNET_REGISTRY_V3>",
  escrow:   "<TESTNET_ESCROW_V3>",
  w0g:      "0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D",
  usdc:     "<TESTNET_MOCK_USDC>",
  tokens: {
    w0g:  { address: "0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D", decimals: 18, name: "Wrapped 0G", version: "1" },
    usdc: { address: "<TESTNET_MOCK_USDC>",                         decimals: 6,  name: "Mock USDC",  version: "1" },
  },
  x402Network: "0g-testnet",
  oracleUrl: `${PROXY_BASE}/api/oracle`,
  x402Url:   `${PROXY_BASE}/api/x402`,
};

export const MAINNET: NetworkConfig = {
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  chainScan: "https://chainscan.0g.ai",
  storageScan: "https://storagescan.0g.ai",
  storageIndexer: "https://indexer-storage-turbo.0g.ai",
  registry: "<MAINNET_REGISTRY_V3>",
  escrow:   "<MAINNET_ESCROW_V3>",
  w0g:      "0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01",
  usdc:     "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e",
  tokens: {
    w0g:  { address: "0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01", decimals: 18, name: "Wrapped 0G", version: "1" },
    usdc: { address: "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e", decimals: 6,  name: "USDC",        version: "2" },
  },
  x402Network: "0g-mainnet",
  oracleUrl: `${PROXY_BASE}/api/oracle`,
  x402Url:   `${PROXY_BASE}/api/x402`,
};

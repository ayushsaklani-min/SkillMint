import type { NetworkConfig } from "./types.js";

export const TESTNET: NetworkConfig = {
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  chainScan: "https://chainscan-galileo.0g.ai",
  storageScan: "https://storagescan-galileo.0g.ai",
  storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
  registry: "0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4",
  escrow: "0xe2841b105B695610f2c1194f8865474A536184dB",
};

export const MAINNET: NetworkConfig = {
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  chainScan: "https://chainscan.0g.ai",
  storageScan: "https://storagescan.0g.ai",
  storageIndexer: "https://indexer-storage-turbo.0g.ai",
  registry: "",
  escrow: "",
};

export const TESTNET = {
  chainId: 16602,
  rpcUrl: 'https://evmrpc-testnet.0g.ai',
  chainScan: 'https://chainscan-galileo.0g.ai',
  storageScan: 'https://storagescan-galileo.0g.ai',
  storageIndexer: 'https://indexer-storage-testnet-turbo.0g.ai',
  storageFlowContract: '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296',
  contracts: {
    // SkillRegistryV2 + SkillEscrowV2 — canonical testnet deployment.
    // sdk/src/constants.ts, oracle/src/index.js, and frontend/src/lib/contracts.ts
    // must all agree with these values.
    registry: '0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4',
    escrow: '0xe2841b105B695610f2c1194f8865474A536184dB',
    w0g: '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D',
  },
};

export const MAINNET = {
  chainId: 16661,
  rpcUrl: 'https://evmrpc.0g.ai',
  chainScan: 'https://chainscan.0g.ai',
  storageScan: 'https://storagescan.0g.ai',
  storageIndexer: 'https://indexer-storage-turbo.0g.ai',
  storageFlowContract: '0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526',
  contracts: {
    registry: '',
    escrow: '',
    w0g: '0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c',
  },
};

export const COMPUTE_MODELS = {
  testnet: {
    'qwen/qwen-2.5-7b-instruct': { type: 'chatbot', inputPer1M: 0.05, outputPer1M: 0.10 },
  },
  mainnet: {
    'deepseek-chat-v3-0324': { type: 'chatbot', inputPer1M: 0.30, outputPer1M: 1.00 },
    'GLM-5-FP8': { type: 'chatbot', inputPer1M: 1.00, outputPer1M: 3.20 },
    'gpt-oss-120b': { type: 'chatbot', inputPer1M: 0.10, outputPer1M: 0.49 },
    'qwen3-vl-30b-a3b-instruct': { type: 'chatbot', inputPer1M: 0.49, outputPer1M: 0.49 },
  },
};

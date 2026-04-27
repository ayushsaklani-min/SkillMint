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
    registry: '0x14cE1f53089c414bFf75e1c462E45ecc19Bf8F09',
    escrow:   '0xD7385368cEf64c27fecfCC63E1E8F19fA09f8Ea5',
    // SkillMint DemoW0G (own deploy with EIP-3009). The canonical 0G mainnet
    // Wrapped0GBase precompile at 0x...1002 lacks transferWithAuthorization,
    // so we ship our own wrapper for x402 agent payments.
    w0g: '0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01',
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

export const TESTNET = {
  chainId: 16602,
  rpcUrl: 'https://evmrpc-testnet.0g.ai',
  chainScan: 'https://chainscan-galileo.0g.ai',
  storageScan: 'https://storagescan-galileo.0g.ai',
  storageIndexer: 'https://indexer-storage-testnet-turbo.0g.ai',
  storageFlowContract: '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296',
  contracts: {
    // SkillRegistryV3 + SkillEscrowV3 — deployed 2026-05-04 on Galileo testnet.
    registry: '0xe052332AA56c179FF9A8B2bCFCCb5679d2BCe9d3',
    escrow:   '0x4ca3Fe8a467C734c31a34a345F6819e5767cAD9C',
    w0g:      '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D',
    usdc:     '0x1605FF6E8aB0Bd7F846cf99268B669764F981C06',
  },
  tokens: {
    w0g:  { address: '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D', decimals: 18, name: 'Wrapped 0G', version: '1' },
    usdc: { address: '0x1605FF6E8aB0Bd7F846cf99268B669764F981C06', decimals: 6,  name: 'Mock USDC',  version: '1' },
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
    // SkillRegistryV3 + SkillEscrowV3 — set after mainnet deploy (Task 15).
    registry: '<MAINNET_REGISTRY_V3>',
    escrow:   '<MAINNET_ESCROW_V3>',
    w0g:      '0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01',
    usdc:     '0x1f3aa82227281ca364bfb3d253b0f1af1da6473e',
  },
  tokens: {
    w0g:  { address: '0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01', decimals: 18, name: 'Wrapped 0G', version: '1' },
    usdc: { address: '0x1f3aa82227281ca364bfb3d253b0f1af1da6473e', decimals: 6,  name: 'USDC',        version: '2' },
  },
};

export const COMPUTE_MODELS = {
  testnet: {
    'qwen/qwen-2.5-7b-instruct': { type: 'chatbot', inputPer1M: 0.05, outputPer1M: 0.10 },
  },
  mainnet: {
    'deepseek-chat-v3-0324':       { type: 'chatbot', inputPer1M: 0.30, outputPer1M: 1.00 },
    'GLM-5-FP8':                   { type: 'chatbot', inputPer1M: 1.00, outputPer1M: 3.20 },
    'gpt-oss-120b':                { type: 'chatbot', inputPer1M: 0.10, outputPer1M: 0.49 },
    'qwen3-vl-30b-a3b-instruct':   { type: 'chatbot', inputPer1M: 0.49, outputPer1M: 0.49 },
  },
};

export const TESTNET = {
  chainId: 16602,
  rpcUrl: 'https://evmrpc-testnet.0g.ai',
  chainScan: 'https://chainscan-galileo.0g.ai',
  storageScan: 'https://storagescan-galileo.0g.ai',
  storageIndexer: 'https://indexer-storage-testnet-turbo.0g.ai',
  storageFlowContract: '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296',
  contracts: {
    registry: '0xC4b41DA4FF0fcE60a6202864308983C23F3ea767',
    escrow: '0xF725E9cf83d49c5789235A38734b863a8ACfFd07',
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

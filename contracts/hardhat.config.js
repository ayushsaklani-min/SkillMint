require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-verify');
require('dotenv').config();

const PK = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';

module.exports = {
  solidity: {
    version: '0.8.19',
    settings: {
      evmVersion: 'paris',
      viaIR: true,
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    testnet: {
      url: 'https://evmrpc-testnet.0g.ai',
      chainId: 16602,
      accounts: [PK]
    },
    mainnet: {
      url: 'https://evmrpc.0g.ai',
      chainId: 16661,
      accounts: [PK]
    }
  },
  etherscan: {
    apiKey: {
      testnet: 'no-api-key-needed',
      mainnet: 'no-api-key-needed'
    },
    customChains: [
      {
        network: 'testnet',
        chainId: 16602,
        urls: {
          apiURL: 'https://chainscan-galileo.0g.ai/open/api',
          browserURL: 'https://chainscan-galileo.0g.ai'
        }
      },
      {
        network: 'mainnet',
        chainId: 16661,
        urls: {
          apiURL: 'https://chainscan.0g.ai/open/api',
          browserURL: 'https://chainscan.0g.ai'
        }
      }
    ]
  }
};

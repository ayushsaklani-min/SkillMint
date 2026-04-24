import { ethers } from 'ethers';

export function hashInput(input) {
  if (typeof input !== 'string') {
    throw new TypeError('hashInput: input must be a string');
  }
  return ethers.keccak256(ethers.toUtf8Bytes(input));
}

export const hashOutput = hashInput;
export const hashPrompt = hashInput;

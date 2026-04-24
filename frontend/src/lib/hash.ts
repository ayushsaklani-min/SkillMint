import { ethers } from "ethers";

/**
 * Deterministic keccak256 over the UTF-8 bytes of the input string. Must
 * stay byte-equivalent to `shared/hash.js` (oracle + SDK use that one) —
 * diverging would silently break input-hash and receipt-hash verification.
 */
export function hashInput(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError("hashInput: input must be a string");
  }
  return ethers.keccak256(ethers.toUtf8Bytes(input));
}

export const hashOutput = hashInput;
export const hashPrompt = hashInput;

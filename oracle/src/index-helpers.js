// Shared helpers extracted from index.js so the x402 server can reuse
// prompt-loading (encrypted-storage + legacy paths) without pulling in the
// escrow event-listener side-effects.
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decryptPrompt } from './crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadSystemPrompt({ skill, metadata, skillId, indexer }) {
  let meta = {};
  try { meta = JSON.parse(metadata); } catch {}

  if (meta.storageRoot && meta.iv) {
    const tempPath = path.join(__dirname, `../temp/enc-${skillId}-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    try {
      // proof:false avoids segment-replication delay on freshly uploaded prompts —
      // content is still hash-verified by the SDK and the TEE attestation covers
      // end-to-end integrity. Mainnet replication can take several minutes.
      const err = await indexer.download(meta.storageRoot, tempPath, false);
      if (err) throw new Error(`storage download: ${err}`);
      const payload = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
      return decryptPrompt({
        ciphertext: payload.ciphertext,
        iv: payload.iv || meta.iv,
        algo: payload.algo || meta.algo,
      });
    } finally {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }

  if (skill.promptHash && skill.promptHash !== ethers.ZeroHash) {
    try {
      const tempPath = path.join(__dirname, `../temp/prompt-${skillId}.json`);
      fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      const err = await indexer.download(skill.promptHash, tempPath, false);
      if (err) throw new Error(`storage download: ${err}`);
      const promptData = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
      fs.unlinkSync(tempPath);
      if (promptData.systemPrompt) return promptData.systemPrompt;
    } catch (_storageErr) { /* fall through */ }
  }

  if (meta.systemPrompt) return meta.systemPrompt;

  throw new Error('No retrievable system prompt for this skill');
}

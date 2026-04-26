// Agent-skill bundle helpers.
//
// "Agent skill" = an Anthropic-format Claude Skill bundle (folder of
// SKILL.md + reference markdown), packed as a ZIP and sold per-download
// via x402. Different from prompt skills (which run TEE inference).
//
// These helpers are pure: input bytes → validation/manifest/sha256.
// Side-effectful encryption + storage upload happens in the API layer.

import crypto from 'node:crypto';
import AdmZip from 'adm-zip';

export const MAX_BUNDLE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_MANIFEST_ENTRIES = 50;

/**
 * Sentinel address used as `computeProvider` for agent skills.
 * The contract rejects address(0), and we need a stable, identifiable
 * value that can be filtered on. "0xa6e" ≈ "agent" — makes filtering
 * trivial across the SDK and frontend.
 */
export const AGENT_SKILL_PROVIDER = '0x0000000000000000000000000000000000000a6e';

/** Sentinel `model` string for agent skills (contract requires non-empty). */
export const AGENT_SKILL_MODEL = 'agent-skill';

/** Hex sha256 of a Buffer. Output is `0x`-prefixed for on-chain ergonomics. */
export function sha256Hex(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('sha256Hex: expected Buffer');
  return '0x' + crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validate a candidate bundle and extract its manifest.
 *
 * Throws Error with a user-facing message on any validation failure.
 * Returns { manifest: string[], sizeBytes: number } on success.
 *
 * Rules:
 *   - Must be ≤ MAX_BUNDLE_BYTES
 *   - Must be openable as a ZIP
 *   - Must contain `SKILL.md` at the root (case-sensitive)
 *   - Manifest is the list of entry names (capped at MAX_MANIFEST_ENTRIES)
 */
export function validateBundle(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('bundle must be a Buffer');
  }
  if (buffer.length === 0) {
    throw new Error('bundle is empty');
  }
  if (buffer.length > MAX_BUNDLE_BYTES) {
    throw new Error(`bundle too large: ${buffer.length} bytes (max ${MAX_BUNDLE_BYTES})`);
  }

  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (e) {
    throw new Error(`bundle is not a valid ZIP: ${e.message}`);
  }

  const entries = zip.getEntries();
  if (entries.length === 0) {
    throw new Error('bundle ZIP is empty');
  }

  const allNames = entries
    .filter(e => !e.isDirectory)
    .map(e => e.entryName.replace(/\\/g, '/'));

  // SKILL.md must exist at the root (top-level), not nested.
  const hasRootSkillMd = allNames.includes('SKILL.md');
  if (!hasRootSkillMd) {
    throw new Error('bundle missing required SKILL.md at root');
  }

  // Manifest = up to MAX_MANIFEST_ENTRIES names, sorted with SKILL.md first.
  const sorted = [...allNames].sort((a, b) => {
    if (a === 'SKILL.md') return -1;
    if (b === 'SKILL.md') return 1;
    return a.localeCompare(b);
  });
  const manifest = sorted.slice(0, MAX_MANIFEST_ENTRIES);

  return { manifest, sizeBytes: buffer.length };
}

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_ID = process.env.ORACLE_KEY_ID || 'oracle-v1';

function getKey() {
  const hex = process.env.ORACLE_KEY;
  if (!hex) throw new Error('ORACLE_KEY missing from env');
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) throw new Error('ORACLE_KEY must be 32 bytes hex (64 chars)');
  return buf;
}

export function encryptPrompt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([enc, tag]);
  return {
    ciphertext: payload.toString('base64'),
    iv: iv.toString('base64'),
    algo: ALGO,
    keyId: KEY_ID,
  };
}

export function decryptPrompt({ ciphertext, iv, algo }) {
  if (algo && algo !== ALGO) throw new Error(`unsupported algo ${algo}`);
  const key = getKey();
  const payload = Buffer.from(ciphertext, 'base64');
  const enc = payload.subarray(0, payload.length - 16);
  const tag = payload.subarray(payload.length - 16);
  const ivBuf = Buffer.from(iv, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, ivBuf);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// Buffer variants for binary payloads like agent-skill bundles.
// Returns ciphertext as raw Buffer (no base64) so we can stream the
// (already-binary) result straight into 0G Storage.
export function encryptBuffer(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]),  // raw bytes
    iv: iv.toString('base64'),
    algo: ALGO,
    keyId: KEY_ID,
  };
}

export function decryptBuffer({ ciphertext, iv, algo }) {
  if (algo && algo !== ALGO) throw new Error(`unsupported algo ${algo}`);
  const key = getKey();
  const payload = Buffer.isBuffer(ciphertext) ? ciphertext : Buffer.from(ciphertext);
  const enc = payload.subarray(0, payload.length - 16);
  const tag = payload.subarray(payload.length - 16);
  const ivBuf = Buffer.from(iv, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, ivBuf);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

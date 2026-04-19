import http from 'node:http';
import { encryptPrompt } from './crypto.js';
import { putInput } from './store.js';
import { MemData } from '@0gfoundation/0g-ts-sdk';

const PORT = Number(process.env.ORACLE_API_PORT || 3001);

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export function startApi({ indexer, wallet, rpcUrl }) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {});

    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, { ok: true, wallet: wallet.address });
    }

    if (req.method === 'POST' && req.url === '/encrypt-prompt') {
      try {
        const { systemPrompt } = await readJson(req);
        if (!systemPrompt || typeof systemPrompt !== 'string') {
          return send(res, 400, { error: 'systemPrompt required' });
        }
        const enc = encryptPrompt(systemPrompt);
        const payload = {
          v: 1,
          algo: enc.algo,
          keyId: enc.keyId,
          iv: enc.iv,
          ciphertext: enc.ciphertext,
        };
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        const memData = new MemData(bytes);
        const [tree, treeErr] = await memData.merkleTree();
        if (treeErr) throw new Error(`merkle: ${treeErr}`);
        const storageRoot = tree.rootHash();
        const [, uploadErr] = await indexer.upload(memData, rpcUrl, wallet);
        if (uploadErr) throw new Error(`upload: ${uploadErr}`);
        console.log(`[api] encrypted prompt → ${storageRoot}`);
        return send(res, 200, {
          storageRoot,
          iv: enc.iv,
          algo: enc.algo,
          keyId: enc.keyId,
        });
      } catch (e) {
        console.error('[api] /encrypt-prompt error:', e.message);
        return send(res, 500, { error: e.message });
      }
    }

    if (req.method === 'POST' && req.url === '/input') {
      try {
        const { executionId, input } = await readJson(req);
        if (!executionId || typeof input !== 'string') {
          return send(res, 400, { error: 'executionId and input required' });
        }
        putInput(executionId, input);
        console.log(`[api] input stored for ${executionId.slice(0, 10)}... (${input.length} chars)`);
        return send(res, 200, { ok: true });
      } catch (e) {
        console.error('[api] /input error:', e.message);
        return send(res, 500, { error: e.message });
      }
    }

    send(res, 404, { error: 'not found' });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[api] HTTP server listening on :${PORT}`);
  });

  return server;
}

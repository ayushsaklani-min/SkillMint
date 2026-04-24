import http from 'node:http';
import { encryptPrompt } from './crypto.js';
import { putInput } from './store.js';
import { MemData } from '@0gfoundation/0g-ts-sdk';
import { createRateLimiter } from './ratelimit.js';

const PORT = Number(process.env.ORACLE_API_PORT || 3001);
const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

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

export function startApi({ indexer, wallet, rpcUrl, registry }) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {});

    if (req.method === 'GET' && req.url === '/health') {
      // Deep health: process liveness + RPC reachable + registry contract
      // responding. A shallow {ok:true} had hid a real broken execution
      // path, so probe the things the execution path depends on.
      try {
        const [block, skillCount] = await Promise.all([
          wallet.provider.getBlockNumber(),
          registry ? registry.skillCount() : Promise.resolve(null),
        ]);
        return send(res, 200, {
          ok: true,
          wallet: wallet.address,
          block,
          skillCount: skillCount !== null ? Number(skillCount) : null,
        });
      } catch (e) {
        return send(res, 503, { ok: false, wallet: wallet.address, error: e.message });
      }
    }

    const { allowed, retryAfter } = rateLimiter.check(clientIp(req));
    if (!allowed) {
      res.writeHead(429, {
        'content-type': 'application/json',
        'retry-after': String(retryAfter),
        'access-control-allow-origin': '*',
      });
      return res.end(JSON.stringify({ error: 'rate limit exceeded', retryAfter }));
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

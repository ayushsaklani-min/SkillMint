import http from 'node:http';
import { encryptPrompt } from './crypto.js';
import { putInput } from './store.js';
import { MemData } from '@0gfoundation/0g-ts-sdk';
import { createRateLimiter } from './ratelimit.js';

const PORT = Number(process.env.ORACLE_API_PORT || 3001);
const X402_URL = process.env.X402_BASE_URL || `http://localhost:${process.env.X402_PORT || 3003}`;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://127.0.0.1:3002';
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

    if (req.method === 'GET' && req.url === '/probe') {
      // Synthetic E2E probe: walks the user-facing surfaces (oracle API,
      // facilitator, x402 challenge) to catch regressions /health misses.
      // No on-chain tx, no W0G burned. Returns 503 with the failing stage.
      const t0 = Date.now();
      const stages = [];
      const stage = async (name, fn) => {
        const s = Date.now();
        try {
          const r = await fn();
          stages.push({ name, ok: true, ms: Date.now() - s });
          return r;
        } catch (e) {
          stages.push({ name, ok: false, ms: Date.now() - s, error: e.message });
          throw new Error(`${name}: ${e.message}`);
        }
      };

      try {
        const block = await stage('rpc', () => wallet.provider.getBlockNumber());

        const skillCount = await stage('registry', async () => {
          if (!registry) throw new Error('registry not configured');
          const n = Number(await registry.skillCount());
          if (n === 0) throw new Error('skillCount is 0');
          return n;
        });

        const skillId = await stage('find-active-skill', async () => {
          const start = Math.max(1, skillCount - 49);
          for (let i = skillCount; i >= start; i--) {
            try {
              const s = await registry.getSkill(i);
              if (s.active) return i;
            } catch { /* skip */ }
          }
          throw new Error(`no active skill in last 50 (count=${skillCount})`);
        });

        await stage('oracle-input-post', async () => {
          const probeId = '0xprobe' + Date.now().toString(16).padStart(58, '0');
          const r = await fetch(`http://127.0.0.1:${PORT}/input`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ executionId: probeId, input: 'probe' }),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = await r.json();
          if (!j.ok) throw new Error(`unexpected body: ${JSON.stringify(j)}`);
        });

        await stage('facilitator-supported', async () => {
          const r = await fetch(`${FACILITATOR_URL}/supported`);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = await r.json();
          if (!Array.isArray(j.kinds) || j.kinds.length === 0) throw new Error('empty kinds');
        });

        await stage('facilitator-health', async () => {
          const r = await fetch(`${FACILITATOR_URL}/health`);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        });

        const challenge = await stage('x402-challenge', async () => {
          const r = await fetch(`${X402_URL}/skill/${skillId}/execute`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ input: 'probe' }),
          });
          if (r.status !== 402) throw new Error(`expected 402, got ${r.status}`);
          const j = await r.json();
          if (j.x402Version !== 1) throw new Error(`bad x402Version=${j.x402Version}`);
          if (!Array.isArray(j.accepts) || j.accepts.length === 0) throw new Error('empty accepts');
          const a = j.accepts[0];
          for (const k of ['scheme', 'network', 'maxAmountRequired', 'resource', 'payTo', 'asset', 'extra']) {
            if (a[k] === undefined || a[k] === null || a[k] === '') {
              throw new Error(`accepts[0] missing ${k}`);
            }
          }
          return { scheme: a.scheme, network: a.network, asset: a.asset, payTo: a.payTo, maxAmountRequired: a.maxAmountRequired };
        });

        return send(res, 200, {
          ok: true,
          totalMs: Date.now() - t0,
          block,
          skillCount,
          probedSkillId: skillId,
          challenge,
          stages,
        });
      } catch (e) {
        return send(res, 503, {
          ok: false,
          totalMs: Date.now() - t0,
          error: e.message,
          stages,
        });
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

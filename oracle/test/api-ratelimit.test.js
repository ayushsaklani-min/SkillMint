import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRateLimiter } from '../src/ratelimit.js';

// Minimal reproduction of api.js limiter wiring — we don't boot the real api.js
// because that requires indexer/wallet. The rule we're testing is:
// "non-/health requests go through the limiter; /health bypasses."

function clientIp(req) {
  return req.socket?.remoteAddress || 'unknown';
}

function startServer(limiter) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end('{"ok":true}');
      }
      const { allowed, retryAfter } = limiter.check(clientIp(req));
      if (!allowed) {
        res.writeHead(429, { 'content-type': 'application/json', 'retry-after': String(retryAfter) });
        return res.end(JSON.stringify({ error: 'rate limit exceeded', retryAfter }));
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

test('POST-style endpoint: 10 OK, 11th 429', async () => {
  const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
  const server = await startServer(limiter);
  const port = server.address().port;
  try {
    for (let i = 0; i < 10; i++) {
      const r = await get(port, '/input');
      assert.equal(r.status, 200, `req ${i + 1}`);
    }
    const blocked = await get(port, '/input');
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers['retry-after']);
  } finally {
    server.close();
  }
});

test('/health bypasses limiter even after exhaustion', async () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
  const server = await startServer(limiter);
  const port = server.address().port;
  try {
    await get(port, '/input');
    await get(port, '/input');
    const blocked = await get(port, '/input');
    assert.equal(blocked.status, 429);
    // /health still responds 200
    const health = await get(port, '/health');
    assert.equal(health.status, 200);
    const health2 = await get(port, '/health');
    assert.equal(health2.status, 200);
  } finally {
    server.close();
  }
});

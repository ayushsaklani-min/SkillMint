const TTL_MS = 10 * 60 * 1000;

const inputs = new Map();

export function putInput(executionId, input) {
  inputs.set(executionId.toLowerCase(), { input, ts: Date.now() });
  cleanup();
}

export function takeInput(executionId) {
  cleanup();
  const key = executionId.toLowerCase();
  const entry = inputs.get(key);
  return entry ? entry.input : null;
}

export async function waitForInput(executionId, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = takeInput(executionId);
    if (v !== null) return v;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of inputs) {
    if (now - v.ts > TTL_MS) inputs.delete(k);
  }
}

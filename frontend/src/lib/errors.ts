// Friendly error messages for the SkillMint UI.
// Raw ethers/wallet/HTTP errors are noisy ("missing revert data", giant JSON
// blobs, stack traces) — this maps them to short, actionable strings users
// can act on. Keep the public surface tiny: parseError(err, hint?) → string.

type Errish = {
  code?: string | number;
  reason?: string | null;
  shortMessage?: string;
  message?: string;
  info?: { error?: { code?: number; message?: string } };
  data?: unknown;
};

const KNOWN_REVERTS: Array<[RegExp, string]> = [
  [/skill not active|inactive/i, "This skill is currently inactive. Pick another one."],
  [/insufficient payment|wrong amount|incorrect price/i, "Payment amount doesn't match the skill price. Refresh and retry."],
  [/skill does not exist|nonexistent token|invalid token/i, "Skill doesn't exist on this network."],
  [/already settled|already refunded/i, "This execution was already processed."],
  [/timeout/i, "Execution timed out before the oracle responded."],
];

export function parseError(err: unknown, hint?: string): string {
  if (!err) return hint || "Something went wrong. Try again.";

  const e = err as Errish;

  // 1. User rejected in wallet — the most common case.
  if (
    e.code === "ACTION_REJECTED" ||
    e.code === 4001 ||
    /user rejected|user denied|rejected by user/i.test(e.message || "")
  ) {
    return "Transaction rejected in wallet.";
  }

  // 2. Insufficient native balance for value + gas.
  if (
    e.code === "INSUFFICIENT_FUNDS" ||
    /insufficient funds|insufficient balance/i.test(e.message || "")
  ) {
    return "Not enough 0G in your wallet to cover the price + gas.";
  }

  // 3. Network-level failures (RPC down, CORS, offline).
  if (
    e.code === "NETWORK_ERROR" ||
    e.code === "SERVER_ERROR" ||
    e.code === "TIMEOUT" ||
    /network error|failed to fetch|network request failed/i.test(e.message || "")
  ) {
    return "Network is unreachable. Check your connection and retry.";
  }

  // 4. Wrong chain.
  if (e.code === "NETWORK_MISMATCH" || /chain.*mismatch|wrong network/i.test(e.message || "")) {
    return "Wallet is on the wrong chain. Switch to 0G Aristotle Mainnet.";
  }

  // 5. Contract revert. ethers v6 surfaces this as CALL_EXCEPTION; with
  // sealed/encoded reverts there's "missing revert data" and no reason.
  if (
    e.code === "CALL_EXCEPTION" ||
    e.code === "UNPREDICTABLE_GAS_LIMIT" ||
    /missing revert data|execution reverted|call_exception/i.test(e.message || "")
  ) {
    const probe = `${e.reason || ""} ${e.shortMessage || ""} ${e.message || ""}`;
    for (const [re, msg] of KNOWN_REVERTS) {
      if (re.test(probe)) return msg;
    }
    return hint
      ? `${hint} (the contract rejected the call — the skill may be inactive, the price may have changed, or the input is invalid)`
      : "The contract rejected this call. The skill may be inactive, the price may have changed, or the input is invalid.";
  }

  // 6. Nonce/replacement issues — usually means the wallet has a stuck tx.
  if (e.code === "NONCE_EXPIRED" || e.code === "REPLACEMENT_UNDERPRICED") {
    return "A previous transaction is still pending. Wait for it to clear or speed it up in your wallet.";
  }

  // 7. Fall back to shortMessage / reason / first line of message.
  const raw =
    e.shortMessage ||
    e.reason ||
    e.info?.error?.message ||
    e.message ||
    String(err);

  // Strip the ethers diagnostic tail "(action=…, data=…, code=…, version=…)".
  const clean = String(raw).split(/\s*\(action=|\s*\(code=|\n/)[0].trim();

  // Cap length so a giant stack never blows out the UI.
  if (clean.length > 180) return clean.slice(0, 180) + "…";
  return clean || hint || "Something went wrong. Try again.";
}

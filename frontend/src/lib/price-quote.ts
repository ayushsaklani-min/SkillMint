/** Fetch live 0G/USD via CoinGecko. Returns null on failure (form falls back to manual input). */
export async function fetchOGUsdRate(signal?: AbortSignal): Promise<number | null> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=zero-gravity&vs_currencies=usd",
      { signal, cache: "no-store" }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const v = j?.["zero-gravity"]?.usd;
    return typeof v === "number" && v > 0 ? v : null;
  } catch {
    return null;
  }
}

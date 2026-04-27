import { NextRequest, NextResponse } from "next/server";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import fs from "fs";
import path from "path";
import os from "os";

// Mainnet by default; override with NEXT_PUBLIC_NETWORK=testnet for Galileo.
const INDEXER_URL =
  (process.env.NEXT_PUBLIC_NETWORK || "").toLowerCase() === "testnet"
    ? "https://indexer-storage-testnet-turbo.0g.ai"
    : "https://indexer-storage-turbo.0g.ai";

export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  if (!hash) {
    return NextResponse.json({ error: "Missing hash parameter" }, { status: 400 });
  }

  const tempFile = path.join(os.tmpdir(), `receipt-${hash.slice(0, 16)}.json`);

  try {
    const indexer = new Indexer(INDEXER_URL);
    const err = await indexer.download(hash, tempFile, true);
    if (err) {
      return NextResponse.json({ error: `Storage download failed: ${err}` }, { status: 502 });
    }

    const data = JSON.parse(fs.readFileSync(tempFile, "utf-8"));
    fs.unlinkSync(tempFile);
    return NextResponse.json(data);
  } catch (e: unknown) {
    try { fs.unlinkSync(tempFile); } catch {}
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

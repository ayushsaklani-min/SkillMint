import { NextRequest, NextResponse } from "next/server";

const ORACLE_URL = process.env.ORACLE_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.systemPrompt || typeof body.systemPrompt !== "string") {
      return NextResponse.json({ error: "systemPrompt required" }, { status: 400 });
    }
    const res = await fetch(`${ORACLE_URL}/encrypt-prompt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ systemPrompt: body.systemPrompt }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

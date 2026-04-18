import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { NETWORK, ESCROW_ABI } from "@/lib/contracts";

/**
 * GET /api/execute/status?executionId=0x...
 * Polls the escrow contract for execution settlement status.
 */
export async function GET(req: NextRequest) {
  const executionId = req.nextUrl.searchParams.get("executionId");
  if (!executionId) {
    return NextResponse.json({ error: "Missing executionId" }, { status: 400 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(NETWORK.rpcUrl);
    const escrow = new ethers.Contract(NETWORK.escrow, ESCROW_ABI, provider);

    const exec = await escrow.getExecution(executionId);

    // Look for ExecutionConfirmed event to get the receiptHash
    let receiptHash: string | null = null;
    if (exec.settled) {
      const filter = escrow.filters.ExecutionConfirmed(executionId);
      const events = await escrow.queryFilter(filter, -5000);
      if (events.length > 0) {
        const log = escrow.interface.parseLog({
          topics: events[0].topics as string[],
          data: events[0].data,
        });
        receiptHash = log?.args?.[1] as string ?? null;
      }
    }

    return NextResponse.json({
      executionId: exec.executionId,
      skillId: Number(exec.skillId),
      agent: exec.agent,
      amount: ethers.formatEther(exec.amount),
      payee: exec.payeeAtFunding,
      settled: exec.settled,
      refunded: exec.refunded,
      createdAt: Number(exec.createdAt),
      receiptHash,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

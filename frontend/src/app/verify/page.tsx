"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ethers } from "ethers";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { NETWORK, REGISTRY_ABI, ESCROW_ABI } from "@/lib/contracts";
import { hashInput } from "@/lib/hash";
import { parseError } from "@/lib/errors";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

interface ReceiptData {
  executionId: string;
  skillId: number;
  input?: string;
  inputHash: string;
  outputHash: string;
  chatID: string;
  teeVerified: boolean | null;
  providerAddress: string;
  nftOwner?: string;
  timestamp: number;
  paidA0GI: string;
  output: string;
}

interface SkillData {
  name: string;
  description: string;
  model: string;
  price: string;
  owner: string;
  developer: string;
  reputation: { total: number; successful: number; rate: number };
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const queryHash = searchParams.get("hash") || "";

  const [receiptHash, setReceiptHash] = useState(queryHash);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [skill, setSkill] = useState<SkillData | null>(null);
  const [onChainSettled, setOnChainSettled] = useState<boolean | null>(null);
  const [checks, setChecks] = useState<{
    rootMatch: boolean | null;
    inputHashOnChain: boolean | null;
    inputRecompute: boolean | null;
    outputRecompute: boolean | null;
  }>({ rootMatch: null, inputHashOnChain: null, inputRecompute: null, outputRecompute: null });

  useEffect(() => {
    if (queryHash) verify(queryHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryHash]);

  async function verify(hashOverride?: string) {
    const hash = (hashOverride || receiptHash).trim();
    if (!hash) return;
    setLoading(true); setError(""); setReceipt(null); setSkill(null); setOnChainSettled(null);
    setChecks({ rootMatch: null, inputHashOnChain: null, inputRecompute: null, outputRecompute: null });
    try {
      const res = await fetch(`/api/verify?hash=${encodeURIComponent(hash)}`);
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || `HTTP ${res.status}`); }
      const data: ReceiptData = await res.json();
      setReceipt(data);
      const provider = new ethers.JsonRpcProvider(NETWORK.rpcUrl);
      const registry = new ethers.Contract(NETWORK.registry, REGISTRY_ABI, provider);
      const escrow = new ethers.Contract(NETWORK.escrow, ESCROW_ABI, provider);
      const s = await registry.getSkill(data.skillId);
      const [total, successful, rate] = await registry.getReputationScore(data.skillId);
      const owner = await registry.ownerOf(data.skillId);
      const meta = JSON.parse(s.metadata);
      setSkill({
        name: meta.name || `Skill #${data.skillId}`,
        description: meta.description || "",
        model: s.model,
        price: ethers.formatEther(s.priceA0GI),
        owner,
        developer: s.developer,
        reputation: { total: Number(total), successful: Number(successful), rate: Number(rate) },
      });
      const exec = await escrow.getExecution(data.executionId);
      setOnChainSettled(exec.settled);

      // Real verification — not just display.
      // 1. On-chain receiptHash IS the 0G Storage root hash (see SkillEscrow.sol:133 —
      //    "receiptHash: rootHash of receipt JSON uploaded to 0G Storage"). Direct equality.
      const confirmedFilter = escrow.filters.ExecutionConfirmed(data.executionId);
      const confirmedEvents = await escrow.queryFilter(confirmedFilter, 0, "latest");
      let rootMatch: boolean | null = null;
      if (confirmedEvents.length > 0) {
        const ev = confirmedEvents[confirmedEvents.length - 1] as ethers.EventLog;
        const onChainReceiptHash = String(ev.args.receiptHash).toLowerCase();
        rootMatch = onChainReceiptHash === hash.toLowerCase();
      }

      // 2. Receipt inputHash == on-chain inputHash committed at funding time.
      const inputHashOnChain =
        String(data.inputHash).toLowerCase() === String(exec.inputHash).toLowerCase();

      // 3. Recompute keccak256(input) and match receipt.inputHash (byte-exact input).
      const inputRecompute =
        data.input != null
          ? hashInput(data.input).toLowerCase() === String(data.inputHash).toLowerCase()
          : null;

      // 4. Recompute keccak256(output) and match receipt.outputHash.
      const outputRecompute =
        hashInput(data.output).toLowerCase() === String(data.outputHash).toLowerCase();

      setChecks({ rootMatch, inputHashOnChain, inputRecompute, outputRecompute });
    } catch (err: unknown) {
      setError(parseError(err, "Couldn't verify this receipt."));
    } finally {
      setLoading(false);
    }
  }

  const allVerified =
    receipt &&
    receipt.teeVerified === true &&
    onChainSettled === true &&
    checks.rootMatch === true &&
    checks.inputHashOnChain === true &&
    checks.outputRecompute === true &&
    (checks.inputRecompute === true || checks.inputRecompute === null);

  const anyFailed =
    checks.rootMatch === false ||
    checks.inputHashOnChain === false ||
    checks.inputRecompute === false ||
    checks.outputRecompute === false;

  return (
    <main className="min-h-screen bg-[#0038FF] text-white grid-bg-brutal">
      <Navbar />

      <div className="pt-28 sm:pt-36 mx-auto max-w-3xl px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-block bg-white text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-black rounded-full mb-4">
            PUBLIC VERIFICATION
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white text-3d leading-[0.95] mb-4">
            VERIFY.<br /><span className="text-[#D4FF00] text-3d-lime">TRUST NOBODY.</span>
          </h1>
          <p className="text-white/90 text-lg mb-10 max-w-xl">
            Paste any SkillMint receipt hash and verify the execution, payment, and TEE attestation yourself. No wallet required.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white text-black border-2 border-black rounded-full shadow-brutal p-1.5 mb-3 flex gap-2"
        >
          <div className="flex-1 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              placeholder="0x receipt root hash..."
              value={receiptHash}
              onChange={(e) => setReceiptHash(e.target.value)}
              className="w-full h-11 bg-transparent border-0 pl-11 pr-3 text-sm font-mono font-bold placeholder-black/40 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
          </div>
          <button
            onClick={() => verify()}
            disabled={loading || !receiptHash.trim()}
            className="bg-[#D4FF00] text-black font-display text-sm px-6 h-11 border-2 border-black rounded-full btn-brutal disabled:opacity-50"
          >
            {loading ? "VERIFYING..." : "VERIFY →"}
          </button>
        </motion.div>

        <div className="mb-8" />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-5 mb-6"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF3333] border-2 border-black flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-base mb-1">VERIFICATION FAILED</h4>
                  <p className="text-sm text-black/80">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {receipt && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              {/* Certificate Card */}
              <div className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal-lg overflow-hidden">
                <div className={`${allVerified ? "bg-[#D4FF00]" : anyFailed ? "bg-[#FF3333]" : "bg-[#FF9D00]"} border-b-2 border-black h-2`} />
                <div className="p-8 text-center">
                  {allVerified ? (
                    <>
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.6, type: "spring" }}
                        className="w-24 h-24 rounded-3xl bg-[#D4FF00] border-2 border-black shadow-brutal flex items-center justify-center mx-auto mb-5"
                      >
                        <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </motion.div>
                      <h2 className="font-display text-4xl sm:text-5xl mb-2">VERIFIED</h2>
                      <p className="text-sm font-mono font-bold tracking-wider text-black/70 mb-6">
                        ROOT-MATCHED · HASH-BOUND · TEE-ATTESTED · ON-CHAIN SETTLED
                      </p>
                    </>
                  ) : anyFailed ? (
                    <>
                      <div className="w-24 h-24 rounded-3xl bg-[#FF3333] border-2 border-black shadow-brutal flex items-center justify-center mx-auto mb-5">
                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                      <h2 className="font-display text-4xl sm:text-5xl mb-2">TAMPERED</h2>
                      <p className="text-sm font-mono font-bold tracking-wider text-black/70 mb-6">
                        AT LEAST ONE CRYPTOGRAPHIC CHECK FAILED
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-24 h-24 rounded-3xl bg-[#FF9D00] border-2 border-black shadow-brutal flex items-center justify-center mx-auto mb-5">
                        <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" /></svg>
                      </div>
                      <h2 className="font-display text-4xl sm:text-5xl mb-2">PARTIAL</h2>
                      <p className="text-sm font-mono font-bold tracking-wider text-black/70 mb-6">
                        TEE: {receipt.teeVerified === true ? "VERIFIED" : receipt.teeVerified === false ? "TAMPERED" : "UNKNOWN"}
                      </p>
                    </>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                    <VerifyBadge label="ROOT ON-CHAIN" verified={checks.rootMatch === true} />
                    <VerifyBadge label="INPUT COMMITTED" verified={checks.inputHashOnChain === true} />
                    <VerifyBadge label="OUTPUT HASH" verified={checks.outputRecompute === true} />
                    <VerifyBadge label="INPUT RECOMPUTE" verified={checks.inputRecompute === true} na={checks.inputRecompute === null} />
                    <VerifyBadge label="TEE ATTESTED" verified={receipt.teeVerified === true} />
                    <VerifyBadge label="ON-CHAIN SETTLED" verified={onChainSettled === true} />
                  </div>
                </div>
              </div>

              {/* Skill */}
              {skill && (
                <div className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="font-mono text-[10px] font-bold tracking-widest text-black/50 mb-1">EXECUTED SKILL</div>
                      <h3 className="font-display text-xl">{skill.name.toUpperCase()}</h3>
                    </div>
                    <Link href={`/skill/${receipt.skillId}`}>
                      <button className="bg-[#D4FF00] text-black font-display text-xs px-3 py-1.5 border-2 border-black rounded-full shadow-brutal-sm btn-brutal">
                        VIEW SKILL →
                      </button>
                    </Link>
                  </div>
                  <p className="text-sm text-black/80 mb-4">{skill.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DetailRow label="Model" value={skill.model} />
                    <DetailRow label="Price" value={`${skill.price} A0GI`} />
                    <DetailRow label="Reputation" value={`${skill.reputation.successful}/${skill.reputation.total} (${skill.reputation.rate}%)`} />
                    <DetailRow label="NFT Owner" value={`${skill.owner.slice(0, 6)}...${skill.owner.slice(-4)}`} mono />
                  </div>
                </div>
              )}

              {/* TEE */}
              <div className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-6">
                <h3 className="font-display text-base tracking-wide mb-4">TEE ATTESTATION</h3>
                <div className="space-y-3">
                  <DetailRow label="Chat ID" value={receipt.chatID} mono />
                  <DetailRow label="Provider" value={receipt.providerAddress} mono />
                  <DetailRow label="Timestamp" value={new Date(receipt.timestamp).toLocaleString()} />
                </div>
              </div>

              {/* Payment */}
              <div className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-base tracking-wide">PAYMENT SETTLEMENT</h3>
                  {onChainSettled ? (
                    <span className="bg-[#D4FF00] text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-black rounded-full">SETTLED</span>
                  ) : (
                    <span className="bg-[#FAFAFA] text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-black rounded-full">PENDING</span>
                  )}
                </div>
                <div className="space-y-3">
                  <DetailRow label="Amount Paid" value={`${receipt.paidA0GI} A0GI`} highlight />
                  {receipt.nftOwner && <DetailRow label="Revenue To" value={receipt.nftOwner} mono />}
                  <DetailRow label="Execution ID" value={receipt.executionId} mono />
                  <DetailRow label="Input Hash" value={receipt.inputHash} mono />
                  <DetailRow label="Output Hash" value={receipt.outputHash} mono />
                </div>
              </div>

              {/* Input + Output — proof the real user input was processed, not just a hash */}
              {receipt.input && (
                <div className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-base tracking-wide">AGENT INPUT</h3>
                    <span className="bg-[#0038FF] text-white font-mono text-[9px] font-bold tracking-widest px-2.5 py-1 border-2 border-black rounded-full">
                      HASH-BOUND
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm bg-[#FAFAFA] border-2 border-black p-4 rounded-xl overflow-x-auto max-h-60">
                    {receipt.input}
                  </pre>
                  <p className="text-[11px] font-mono text-black/60 mt-3 leading-relaxed">
                    This is the exact input the TEE ran the skill on. Hash matches the on-chain
                    <code className="bg-[#FAFAFA] border border-black px-1 mx-1">inputHash</code>
                    committed with the payment — tampering breaks the chain.
                  </p>
                </div>
              )}

              <div className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-6">
                <h3 className="font-display text-base tracking-wide mb-4">AI OUTPUT</h3>
                <pre className="whitespace-pre-wrap text-sm bg-[#FAFAFA] border-2 border-black p-4 rounded-xl overflow-x-auto max-h-96">
                  {receipt.output}
                </pre>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-3">
                <a href={`${NETWORK.storageScan}/file/${receiptHash.trim()}`} target="_blank" rel="noopener noreferrer">
                  <button className="bg-white text-black font-display text-sm px-5 py-2.5 border-2 border-black rounded-full shadow-brutal-sm btn-brutal">
                    STORAGESCAN →
                  </button>
                </a>
                <a href={`${NETWORK.chainScan}/address/${NETWORK.escrow}`} target="_blank" rel="noopener noreferrer">
                  <button className="bg-white text-black font-display text-sm px-5 py-2.5 border-2 border-black rounded-full shadow-brutal-sm btn-brutal">
                    ESCROW ON CHAINSCAN →
                  </button>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0038FF] text-white grid-bg-brutal">
          <Navbar />
          <div className="pt-28 flex items-center justify-center min-h-[60vh]">
            <div className="w-10 h-10 border-[3px] border-[#D4FF00] border-t-transparent rounded-full animate-spin" />
          </div>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

function VerifyBadge({ label, verified, na }: { label: string; verified: boolean; na?: boolean }) {
  if (na) {
    return (
      <div className="border-2 border-black rounded-xl p-3 text-center bg-[#EEEEEE]">
        <div className="w-7 h-7 mx-auto rounded-full flex items-center justify-center mb-1.5 border-2 border-black bg-white text-black/50">
          <span className="font-mono text-[9px] font-bold">N/A</span>
        </div>
        <span className="font-mono text-[9px] font-bold tracking-widest text-black/50">{label}</span>
      </div>
    );
  }
  return (
    <div className={`border-2 border-black rounded-xl p-3 text-center ${verified ? "bg-[#D4FF00]" : "bg-[#FAFAFA]"}`}>
      <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center mb-1.5 border-2 border-black ${verified ? "bg-black text-[#D4FF00]" : "bg-white text-black/40"}`}>
        {verified ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
        )}
      </div>
      <span className={`font-mono text-[9px] font-bold tracking-widest ${verified ? "text-black" : "text-black/40"}`}>{label}</span>
    </div>
  );
}

function DetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="font-mono text-[10px] font-bold tracking-widest text-black/50 min-w-[120px] shrink-0 pt-0.5">{label.toUpperCase()}</span>
      <span className={`break-all ${
        highlight ? "text-[#0038FF] font-bold text-sm" :
        mono ? "font-mono text-xs text-black/80" : "text-sm text-black"
      }`}>
        {value}
      </span>
    </div>
  );
}

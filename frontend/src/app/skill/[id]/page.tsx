"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ethers } from "ethers";
import Link from "next/link";
import { motion } from "framer-motion";
import { NETWORK, REGISTRY_ABI, ESCROW_ABI } from "@/lib/contracts";
import { downloadAgentSkillBrowser, downloadBytes } from "@/lib/x402";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

type SkillKind = "prompt" | "agent-skill";

interface SkillMeta {
  kind?: SkillKind;
  name?: string;
  description?: string;
  storageRoot?: string;
  // agent-skill fields
  bundleStorageRoot?: string;
  bundleSha256?: string;
  manifest?: string[];
  sizeBytes?: number;
  format?: string;
  compatibleWith?: string[];
}

interface SkillDetail {
  id: number;
  kind: SkillKind;
  developer: string;
  owner: string;
  promptHash: string;
  computeProvider: string;
  model: string;
  price: string;
  metadata: SkillMeta;
  active: boolean;
  total: number;
  successful: number;
  rate: number;
  totalRevenue: string;
  createdAt: number;
  pendingRevenue: string;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SkillPage() {
  const params = useParams();
  const skillId = Number(params.id);
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentExecs, setRecentExecs] = useState<Array<{ executionId: string; txHash: string; settled: boolean; payee: string; timestamp?: number }>>([]);
  const [buyState, setBuyState] = useState<"idle" | "buying" | "done">("idle");
  const [buyErr, setBuyErr] = useState("");
  const [buyResult, setBuyResult] = useState<{ tx: string; receiptRoot: string; sha256: string; size: number } | null>(null);

  async function buyAndDownload() {
    if (!skill) return;
    setBuyState("buying"); setBuyErr(""); setBuyResult(null);
    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${NETWORK.chainId.toString(16)}` }],
      }).catch(() => {});
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const dl = await downloadAgentSkillBrowser(provider, skill.id);
      downloadBytes(dl.bundle, `${skill.metadata.name || `skill-${skill.id}`}.skill`);
      setBuyResult({ tx: dl.settlement.transaction, receiptRoot: dl.receiptRootHash, sha256: dl.bundleSha256, size: dl.bundle.length });
      setBuyState("done");
    } catch (e) {
      setBuyErr(e instanceof Error ? e.message : "download failed");
      setBuyState("idle");
    }
  }

  useEffect(() => { if (skillId) loadSkill(); }, [skillId]);

  async function loadSkill() {
    try {
      const provider = new ethers.JsonRpcProvider(NETWORK.rpcUrl);
      const registry = new ethers.Contract(NETWORK.registry, REGISTRY_ABI, provider);
      const escrow = new ethers.Contract(NETWORK.escrow, ESCROW_ABI, provider);

      const s = await registry.getSkill(skillId);
      const [total, successful, rate] = await registry.getReputationScore(skillId);
      const owner = await registry.ownerOf(skillId);
      const pendingWei = await escrow.payments(owner);

      let metadata: SkillMeta = {};
      try { metadata = JSON.parse(s.metadata); } catch { /* legacy */ }
      const kind: SkillKind = metadata.kind === "agent-skill" ? "agent-skill" : "prompt";

      setSkill({
        id: skillId,
        kind,
        developer: s.developer,
        owner,
        promptHash: s.promptHash,
        computeProvider: s.computeProvider,
        model: s.model,
        price: ethers.formatEther(s.priceA0GI),
        metadata,
        active: s.active,
        total: Number(total),
        successful: Number(successful),
        rate: Number(rate),
        totalRevenue: ethers.formatEther(s.totalRevenueEarned),
        createdAt: Number(s.createdAt),
        pendingRevenue: ethers.formatEther(pendingWei),
      });

      const filter = escrow.filters.ExecutionRequested(null, skillId);
      const events = await escrow.queryFilter(filter, -10000);
      const execs = await Promise.all(
        events.slice(-5).map(async (e) => {
          const log = escrow.interface.parseLog({ topics: e.topics as string[], data: e.data });
          const executionId = log?.args?.[0] as string;
          const exec = await escrow.getExecution(executionId);
          const block = await provider.getBlock(e.blockNumber);
          return {
            executionId,
            txHash: e.transactionHash,
            settled: exec.settled,
            payee: exec.payeeAtFunding,
            timestamp: block?.timestamp ? block.timestamp * 1000 : undefined,
          };
        })
      );
      setRecentExecs(execs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skill");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0038FF] text-white grid-bg-brutal">
        <Navbar />
        <div className="pt-28 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-10 h-10 border-[3px] border-[#D4FF00] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-mono font-bold tracking-widest text-xs text-white/70">LOADING FROM 0G CHAIN...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !skill) {
    return (
      <main className="min-h-screen bg-[#0038FF] text-white grid-bg-brutal">
        <Navbar />
        <div className="pt-28 flex items-center justify-center min-h-[60vh] px-6">
          <div className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal-lg p-8 text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-[#FF3333] border-2 border-black flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            </div>
            <h2 className="font-display text-xl mb-2">SKILL NOT FOUND</h2>
            <p className="text-sm text-black/70 mb-5">{error || "This skill doesn't exist yet."}</p>
            <Link href="/">
              <button className="bg-[#D4FF00] text-black font-display text-sm px-5 py-2.5 border-2 border-black rounded-full shadow-brutal-sm btn-brutal">
                BACK TO EXPLORE
              </button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isTransferred = skill.owner.toLowerCase() !== skill.developer.toLowerCase();

  return (
    <main className="min-h-screen bg-[#0038FF] text-white grid-bg-brutal">
      <Navbar />

      <div className="pt-28 sm:pt-36 mx-auto max-w-6xl px-6 pb-20">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-white/70 mb-6">
          <Link href="/" className="hover:text-[#D4FF00] transition-colors">EXPLORE</Link>
          <span>/</span>
          <span className="text-white">SKILL #{skill.id}</span>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="bg-[#D4FF00] text-black font-display text-sm px-3 py-1 border-2 border-black rounded-full">NFT #{skill.id}</span>
            {skill.kind === "agent-skill" ? (
              <span className="bg-white text-black font-display text-sm px-3 py-1 border-2 border-black rounded-full">📦 AGENT SKILL · TAMPER-PROOF</span>
            ) : (
              <span className="bg-white text-black font-display text-sm px-3 py-1 border-2 border-black rounded-full">⚡ AI SKILL · TEE-ATTESTED</span>
            )}
            {skill.active ? (
              <span className="bg-black text-[#D4FF00] font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 rounded-full">LIVE</span>
            ) : (
              <span className="bg-white/20 text-white font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border border-white/40 rounded-full">OFFLINE</span>
            )}
            {isTransferred && (
              <span className="bg-white text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-black rounded-full">TRANSFERRED</span>
            )}
          </div>
          <h1 className="font-display text-5xl sm:text-7xl text-white text-3d leading-[0.95] mb-4">
            {(skill.metadata.name || `Skill #${skill.id}`).toUpperCase()}
          </h1>
          <p className="text-white/90 text-lg max-w-2xl mb-6">{skill.metadata.description}</p>
          {skill.kind === "agent-skill" ? (
            <Link href={`/execute?skill=${skillId}`}>
              <button className="bg-[#D4FF00] text-black font-display text-base sm:text-lg px-6 sm:px-7 py-3 border-2 border-black rounded-full shadow-brutal btn-brutal">
                BUY & DOWNLOAD — {skill.price} W0G →
              </button>
            </Link>
          ) : (
            <Link href={`/execute?skill=${skillId}`}>
              <button className="bg-[#D4FF00] text-black font-display text-base sm:text-lg px-6 sm:px-7 py-3 border-2 border-black rounded-full shadow-brutal btn-brutal">
                EXECUTE — {skill.price} A0GI →
              </button>
            </Link>
          )}
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          {/* Left — Details */}
          <div className="lg:col-span-2 space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal p-6"
            >
              <h3 className="font-display text-base tracking-wide mb-4">SKILL DETAILS</h3>
              {skill.kind === "agent-skill" ? (
                <div className="space-y-3">
                  <DetailRow label="Kind" value="Agent Skill (folder bundle)" highlight />
                  <DetailRow label="Format" value={skill.metadata.format || "claude-skill"} />
                  <DetailRow label="Compatible with" value={(skill.metadata.compatibleWith || []).join(", ") || "—"} mono />
                  <DetailRow label="Price / download" value={`${skill.price} W0G`} highlight />
                  <DetailRow label="Bundle size" value={skill.metadata.sizeBytes ? fmtBytes(skill.metadata.sizeBytes) : "—"} />
                  <DetailRow label="Bundle sha256" value={skill.metadata.bundleSha256 || skill.promptHash} mono />
                  <DetailRow label="Storage root" value={skill.metadata.bundleStorageRoot || "—"} mono />
                  <DetailRow label="Created" value={new Date(skill.createdAt * 1000).toLocaleDateString()} />
                </div>
              ) : (
                <div className="space-y-3">
                  <DetailRow label="Model" value={skill.model} />
                  <DetailRow label="Price" value={`${skill.price} A0GI`} highlight />
                  <DetailRow label="Compute Provider" value={skill.computeProvider} mono />
                  <DetailRow label="Prompt Hash" value={skill.promptHash} mono />
                  <DetailRow label="Created" value={new Date(skill.createdAt * 1000).toLocaleDateString()} />
                </div>
              )}
            </motion.div>

            {skill.kind === "agent-skill" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
                className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal p-6"
              >
                <div className="flex items-center justify-between mb-4 gap-3">
                  <h3 className="font-display text-base tracking-wide">BUNDLE CONTENTS</h3>
                  <span className="font-mono text-[10px] tracking-widest text-black/50">{(skill.metadata.manifest || []).length} ENTRIES</span>
                </div>
                {(skill.metadata.manifest || []).length === 0 ? (
                  <div className="bg-[#FAFAFA] border-2 border-black rounded-xl p-5 text-center font-mono text-[11px] text-black/50">
                    NO MANIFEST AVAILABLE
                  </div>
                ) : (
                  <ul className="bg-[#FAFAFA] border-2 border-black rounded-xl p-4 font-mono text-[11px] space-y-0.5 max-h-64 overflow-y-auto">
                    {(skill.metadata.manifest || []).slice(0, 20).map((n) => (
                      <li key={n} className="truncate">
                        {n === "SKILL.md" ? <span className="text-[#0038FF] font-bold">▸ {n}</span> : <span className="text-black/75">  {n}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={buyAndDownload}
                    disabled={buyState === "buying" || !skill.active}
                    className="flex-1 h-12 rounded-full bg-[#D4FF00] text-black font-display text-sm border-2 border-black shadow-brutal btn-brutal disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {buyState === "buying" ? "PAYING & DOWNLOADING…" : `BUY & DOWNLOAD · ${skill.price} W0G →`}
                  </button>
                </div>
                {buyErr && (
                  <div className="mt-3 bg-[#FF3333]/20 border-2 border-[#FF3333] rounded-xl p-3 text-xs text-[#FF3333] font-bold break-words">{buyErr}</div>
                )}
                {buyState === "done" && buyResult && (
                  <div className="mt-3 bg-[#D4FF00] text-black border-2 border-black rounded-xl p-4 space-y-2">
                    <div className="font-display text-sm">✓ DOWNLOADED · sha256 verified</div>
                    <div className="font-mono text-[11px] break-all"><span className="text-black/60">size:</span> {fmtBytes(buyResult.size)}</div>
                    <div className="font-mono text-[11px] break-all"><span className="text-black/60">sha256:</span> {buyResult.sha256}</div>
                    {buyResult.tx && (
                      <a href={`${NETWORK.chainScan}/tx/${buyResult.tx}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-[#D4FF00] font-display text-xs px-3 py-1.5 border-2 border-black rounded-full">
                        SETTLE TX →
                      </a>
                    )}
                    {buyResult.receiptRoot && (
                      <a href={`${NETWORK.storageScan}/file/${buyResult.receiptRoot}`} target="_blank" rel="noopener noreferrer" className="inline-block ml-2 bg-white text-black font-display text-xs px-3 py-1.5 border-2 border-black rounded-full">
                        RECEIPT →
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal p-6"
            >
              <h3 className="font-display text-base tracking-wide mb-4">RECENT EXECUTIONS</h3>
              {recentExecs.length === 0 ? (
                <div className="bg-[#FAFAFA] border-2 border-black rounded-xl p-6 text-center">
                  <p className="font-mono text-xs font-bold tracking-widest text-black/50">NO EXECUTIONS YET</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentExecs.map((e) => (
                    <div key={e.executionId} className="flex items-center justify-between gap-3 p-3 bg-[#FAFAFA] border-2 border-black rounded-xl">
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="font-mono text-xs font-bold truncate">{e.executionId.slice(0, 18)}...{e.executionId.slice(-6)}</span>
                        <span className="text-[10px] font-mono text-black/50">
                          Payee: {e.payee.slice(0, 6)}...{e.payee.slice(-4)}
                          {e.timestamp && ` · ${new Date(e.timestamp).toLocaleDateString()}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {e.settled ? (
                          <span className="bg-[#D4FF00] text-black font-mono text-[10px] font-bold tracking-widest px-2 py-1 border-2 border-black rounded-full">SETTLED</span>
                        ) : (
                          <span className="bg-white text-black font-mono text-[10px] font-bold tracking-widest px-2 py-1 border-2 border-black rounded-full">PENDING</span>
                        )}
                        <a href={`${NETWORK.chainScan}/tx/${e.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[#0038FF] font-mono text-xs font-bold hover:underline">
                          TX →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Right — Sidebar */}
          <div className="space-y-5">
            {/* Reputation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
              className="bg-[#D4FF00] text-black border-2 border-black rounded-3xl shadow-brutal p-6 text-center"
            >
              <div className="font-display text-xs tracking-widest mb-4">REPUTATION</div>
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#000" strokeWidth="6" opacity="0.15" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke="#000" strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(skill.rate / 100) * 327} 327`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-4xl">{skill.rate}%</span>
                  <span className="font-mono text-[10px] font-bold tracking-widest mt-0.5">SUCCESS</span>
                </div>
              </div>
              <p className="text-xs font-mono font-bold">{skill.successful} / {skill.total} SUCCESSFUL</p>
            </motion.div>

            {/* NFT Ownership */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal p-6"
            >
              <h3 className="font-display text-base tracking-wide mb-4">NFT OWNERSHIP</h3>
              <div className="space-y-3">
                <DetailRow label="Owner" value={skill.owner} mono />
                <DetailRow label="Creator" value={skill.developer} mono />
                <DetailRow label="Revenue" value={`${skill.totalRevenue} A0GI`} />
                <DetailRow label="Pending" value={`${skill.pendingRevenue} A0GI`} highlight />
                <DetailRow label="Royalty" value="5% on secondary sales" />
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
              className="space-y-3"
            >
              <a href={`${NETWORK.chainScan}/address/${NETWORK.registry}`} target="_blank" rel="noopener noreferrer" className="block">
                <button className="w-full h-11 rounded-full bg-white text-black font-display text-sm border-2 border-black shadow-brutal-sm btn-brutal">
                  VIEW ON CHAINSCAN →
                </button>
              </a>
              <Link href="/verify" className="block">
                <button className="w-full h-11 rounded-full bg-black text-[#D4FF00] font-display text-sm border-2 border-black shadow-brutal-sm btn-brutal">
                  VERIFY AN EXECUTION
                </button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

function DetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="font-mono text-[10px] font-bold tracking-widest text-black/50 min-w-[110px] shrink-0 pt-0.5">{label.toUpperCase()}</span>
      <span className={`break-all ${
        highlight ? "text-[#0038FF] font-bold text-sm" :
        mono ? "font-mono text-xs text-black/80" : "text-sm text-black"
      }`}>
        {value}
      </span>
    </div>
  );
}

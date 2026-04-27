"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ethers } from "ethers";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { NETWORK, REGISTRY_ABI, ESCROW_ABI } from "@/lib/contracts";
import { hashInput } from "@/lib/hash";
import { downloadAgentSkillBrowser, downloadBytes } from "@/lib/x402";
import { parseError } from "@/lib/errors";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

type SkillKind = "prompt" | "agent-skill";

interface SkillOption {
  id: number;
  kind: SkillKind;
  name: string;
  description: string;
  model: string;
  price: string;
  priceWei: bigint;
  active: boolean;
  owner: string;
  reputation: number;
  manifestCount?: number;
}

type ExecutionPhase =
  | "idle"
  | "connecting"
  | "sending"
  | "waiting"
  | "confirmed"
  | "refunded"
  | "error";

interface ExecutionState {
  phase: ExecutionPhase;
  executionId: string;
  txHash: string;
  amount: string;
  payee: string;
  receiptHash: string;
  error: string;
  pollCount: number;
  submittedInput: string;
  skillName: string;
}

const INITIAL_STATE: ExecutionState = {
  phase: "idle",
  executionId: "",
  txHash: "",
  amount: "",
  payee: "",
  receiptHash: "",
  error: "",
  pollCount: 0,
  submittedInput: "",
  skillName: "",
};

function ExecuteContent() {
  const searchParams = useSearchParams();
  const preselectedSkill = searchParams.get("skill");

  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<number>(0);
  const [userInput, setUserInput] = useState("");
  const [exec, setExec] = useState<ExecutionState>(INITIAL_STATE);
  const [walletAddr, setWalletAddr] = useState("");
  const [receiptData, setReceiptData] = useState<Record<string, unknown> | null>(null);

  const [bundleState, setBundleState] = useState<"idle" | "buying" | "done">("idle");
  const [bundleErr, setBundleErr] = useState("");
  const [bundleResult, setBundleResult] = useState<{ tx: string; receiptRoot: string; sha256: string; size: number; manifestLen: number } | null>(null);

  async function handleAgentSkillBuy() {
    const s = skills.find((x) => x.id === selectedSkill);
    if (!s) return;
    setBundleState("buying"); setBundleErr(""); setBundleResult(null);
    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${NETWORK.chainId.toString(16)}` }],
      }).catch(() => {});
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const dl = await downloadAgentSkillBrowser(provider, s.id);
      downloadBytes(dl.bundle, `${s.name || `skill-${s.id}`}.skill`);
      setBundleResult({
        tx: dl.settlement.transaction,
        receiptRoot: dl.receiptRootHash,
        sha256: dl.bundleSha256,
        size: dl.bundle.length,
        manifestLen: dl.manifest.length,
      });
      setBundleState("done");
    } catch (e) {
      setBundleErr(parseError(e, "Download failed."));
      setBundleState("idle");
    }
  }

  useEffect(() => { loadSkills(); }, []);

  async function loadSkills() {
    try {
      const provider = new ethers.JsonRpcProvider(NETWORK.rpcUrl);
      const registry = new ethers.Contract(NETWORK.registry, REGISTRY_ABI, provider);
      const count = Number(await registry.skillCount());
      const loaded: SkillOption[] = [];
      for (let i = 1; i <= count; i++) {
        const skill = await registry.getSkill(i);
        const [, , rate] = await registry.getReputationScore(i);
        const owner = await registry.ownerOf(i);
        let meta: { name?: string; description?: string; kind?: SkillKind; manifest?: string[] } = {};
        try { meta = JSON.parse(skill.metadata); } catch { /* legacy */ }
        const kind: SkillKind = meta.kind === "agent-skill" ? "agent-skill" : "prompt";
        loaded.push({
          id: i,
          kind,
          name: meta.name || `Skill #${i}`,
          description: meta.description || "",
          model: skill.model,
          price: ethers.formatEther(skill.priceA0GI),
          priceWei: skill.priceA0GI,
          active: skill.active,
          owner,
          reputation: Number(rate),
          manifestCount: meta.manifest?.length,
        });
      }
      setSkills(loaded);
      if (preselectedSkill && loaded.find((s) => s.id === Number(preselectedSkill))) {
        setSelectedSkill(Number(preselectedSkill));
      } else if (loaded.length > 0) {
        setSelectedSkill(loaded[0].id);
      }
    } catch (err) {
      console.error("Failed to load skills:", err);
    } finally {
      setLoadingSkills(false);
    }
  }

  const pollStatus = useCallback(async (executionId: string) => {
    const MAX_POLLS = 90;
    let count = 0;
    const poll = async () => {
      if (count >= MAX_POLLS) {
        setExec((prev) => ({ ...prev, phase: "error", error: "Timed out waiting for oracle." }));
        return;
      }
      count++;
      setExec((prev) => ({ ...prev, pollCount: count }));
      try {
        const res = await fetch(`/api/execute/status?executionId=${encodeURIComponent(executionId)}`);
        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
        const data = await res.json();
        if (data.settled) {
          setExec((prev) => ({ ...prev, phase: "confirmed", payee: data.payee, receiptHash: data.receiptHash || "" }));
          if (data.receiptHash) {
            try {
              const receiptRes = await fetch(`/api/verify?hash=${encodeURIComponent(data.receiptHash)}`);
              if (receiptRes.ok) setReceiptData(await receiptRes.json());
            } catch {}
          }
          return;
        }
        if (data.refunded) { setExec((prev) => ({ ...prev, phase: "refunded" })); return; }
        setTimeout(poll, 2000);
      } catch {
        setTimeout(poll, 3000);
      }
    };
    poll();
  }, []);

  async function handleExecute() {
    setExec(INITIAL_STATE);
    setReceiptData(null);
    const skill = skills.find((s) => s.id === selectedSkill);
    if (!skill) return;
    // Client-side guards: surface a clean message before the wallet bothers
    // the user with a contract-revert dialog.
    if (!skill.active) {
      setExec((prev) => ({ ...prev, phase: "error", error: "This skill is currently inactive. Pick another one." }));
      return;
    }
    if (!userInput.trim()) {
      setExec((prev) => ({ ...prev, phase: "error", error: "Type something to send to the skill first." }));
      return;
    }
    try {
      setExec((prev) => ({ ...prev, phase: "connecting", submittedInput: userInput, skillName: skill.name }));
      if (!window.ethereum) throw new Error("MetaMask not found.");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${NETWORK.chainId.toString(16)}` }],
      }).catch(async () => {
        await window.ethereum!.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${NETWORK.chainId.toString(16)}`,
            chainName: NETWORK.chainId === 16661 ? "0G Aristotle Mainnet" : "0G Testnet",
            rpcUrls: [NETWORK.rpcUrl],
            blockExplorerUrls: [NETWORK.chainScan],
            nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
          }],
        });
      });
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const browserProvider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const signer = await browserProvider.getSigner();
      const addr = await signer.getAddress();
      setWalletAddr(addr);
      setExec((prev) => ({ ...prev, phase: "sending" }));
      const escrow = new ethers.Contract(NETWORK.escrow, ESCROW_ABI, signer);
      const inputHash = hashInput(userInput);
      const tx = await escrow.requestExecution(selectedSkill, inputHash, { value: skill.priceWei });
      const receipt = await tx.wait();
      let executionId = "";
      for (const log of receipt.logs) {
        try {
          const parsed = escrow.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === "ExecutionRequested") { executionId = parsed.args[0] as string; break; }
        } catch {}
      }
      if (!executionId) throw new Error("ExecutionRequested event not found");
      setExec((prev) => ({ ...prev, phase: "waiting", executionId, txHash: tx.hash, amount: skill.price }));
      // Hand the real input off to the oracle so the TEE can run the actual skill, not just a hash.
      const inputRes = await fetch("/api/oracle/input", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ executionId, input: userInput }),
      });
      if (!inputRes.ok) {
        const errText = await inputRes.text().catch(() => "");
        throw new Error(`Failed to hand input to oracle: ${inputRes.status} ${errText}`);
      }
      pollStatus(executionId);
    } catch (err: unknown) {
      setExec((prev) => ({ ...prev, phase: "error", error: parseError(err, "Couldn't send execution.") }));
    }
  }

  const currentSkill = skills.find((s) => s.id === selectedSkill);
  const isRunning = exec.phase === "connecting" || exec.phase === "sending" || exec.phase === "waiting";

  return (
    <main className="min-h-screen bg-[#0038FF] text-white grid-bg-brutal">
      <Navbar />

      <div className="pt-28 sm:pt-36 mx-auto max-w-3xl px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-block bg-[#D4FF00] text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-black rounded-full mb-4">
            EXECUTE A SKILL
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white text-3d leading-[0.95] mb-4">
            PICK.<br/>PAY.<br/><span className="text-[#D4FF00] text-3d-lime">VERIFY.</span>
          </h1>
          <p className="text-white/90 text-lg mb-10 max-w-xl">
            Pick a skill. Type your input. Pay with your wallet. Get a TEE-verified result back on-chain.
          </p>
        </motion.div>

        {/* ── Main Form Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal-lg p-6 sm:p-8 mb-6"
        >
          <div className="space-y-6">
            <div>
              <label className="font-display text-sm tracking-wide mb-2 block">
                1 — SELECT SKILL
              </label>
              {loadingSkills ? (
                <div className="skeleton h-12 w-full rounded-xl border-2 border-black" />
              ) : (
                <select
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full h-12 bg-white border-2 border-black rounded-xl px-4 text-sm font-medium focus:outline-none focus:shadow-brutal-sm disabled:opacity-50 transition-shadow"
                >
                  {skills.map((s) => (
                    <option key={s.id} value={s.id} disabled={!s.active}>
                      #{s.id} {s.kind === "agent-skill" ? "📦" : "⚡"} {s.name} — {s.price} {s.kind === "agent-skill" ? "W0G" : "A0GI"}{!s.active ? " (Inactive)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {currentSkill && (
              <motion.div
                key={currentSkill.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#0038FF] text-white border-2 border-black rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-display text-lg">{currentSkill.name.toUpperCase()}</span>
                  <span className="bg-[#D4FF00] text-black font-display text-[10px] px-2 py-0.5 rounded-full border border-black">NFT #{currentSkill.id}</span>
                  {currentSkill.active ? (
                    <span className="bg-black text-[#D4FF00] font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
                  ) : (
                    <span className="bg-white/20 text-white font-mono text-[10px] px-2 py-0.5 rounded-full border border-white/40">OFFLINE</span>
                  )}
                </div>
                <p className="text-sm text-white/90">{currentSkill.description}</p>
                <div className="flex gap-4 text-xs font-mono font-bold text-white/70 mt-2">
                  <span>Model: {currentSkill.model.split("/").pop()}</span>
                  <span>Rep: {currentSkill.reputation}%</span>
                </div>
              </motion.div>
            )}

            {currentSkill?.kind === "agent-skill" ? (
              <>
                <div className="bg-[#0038FF] text-white border-2 border-black rounded-2xl p-4">
                  <div className="font-display text-xs tracking-widest mb-2">📦 AGENT SKILL · TAMPER-PROOF DOWNLOAD</div>
                  <p className="text-sm text-white/90">Pay {currentSkill.price} W0G to download the encrypted `.skill` bundle. The browser sha256-verifies it byte-for-byte against the on-chain commitment.</p>
                  {currentSkill.manifestCount && (
                    <div className="mt-2 font-mono text-[11px] text-white/70">{currentSkill.manifestCount} files in bundle</div>
                  )}
                </div>

                <button
                  onClick={handleAgentSkillBuy}
                  disabled={bundleState === "buying" || !currentSkill.active}
                  className="w-full h-14 rounded-2xl bg-[#D4FF00] text-black font-display text-lg border-2 border-black shadow-brutal btn-brutal disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bundleState === "buying"
                    ? "PAYING & DOWNLOADING..."
                    : `BUY & DOWNLOAD — ${currentSkill.price} W0G →`}
                </button>

                {bundleErr && (
                  <div className="bg-[#FF3333]/20 border-2 border-[#FF3333] rounded-xl p-3 text-xs text-[#FF3333] font-bold break-words">{bundleErr}</div>
                )}
                {bundleState === "done" && bundleResult && (
                  <div className="bg-[#D4FF00] text-black border-2 border-black rounded-2xl p-4 space-y-2">
                    <div className="font-display text-base">✓ DOWNLOADED · sha256 verified</div>
                    <div className="font-mono text-[11px] break-all"><span className="text-black/60">size:</span> {bundleResult.size} B · <span className="text-black/60">files:</span> {bundleResult.manifestLen}</div>
                    <div className="font-mono text-[11px] break-all"><span className="text-black/60">sha256:</span> {bundleResult.sha256}</div>
                    <div className="flex gap-2 flex-wrap pt-1">
                      {bundleResult.tx && (
                        <a href={`${NETWORK.chainScan}/tx/${bundleResult.tx}`} target="_blank" rel="noopener noreferrer" className="bg-black text-[#D4FF00] font-display text-xs px-3 py-1.5 border-2 border-black rounded-full">
                          SETTLE TX →
                        </a>
                      )}
                      {bundleResult.receiptRoot && (
                        <a href={`${NETWORK.storageScan}/file/${bundleResult.receiptRoot}`} target="_blank" rel="noopener noreferrer" className="bg-white text-black font-display text-xs px-3 py-1.5 border-2 border-black rounded-full">
                          RECEIPT →
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="font-display text-sm tracking-wide mb-2 block">
                    2 — YOUR INPUT
                  </label>
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    disabled={isRunning}
                    placeholder="What do you want the AI to do?"
                    className="w-full h-32 bg-white border-2 border-black rounded-xl px-4 py-3 text-sm resize-y focus:outline-none focus:shadow-brutal-sm disabled:opacity-50 transition-shadow"
                  />
                </div>

                <button
                  onClick={handleExecute}
                  disabled={isRunning || !userInput.trim() || !currentSkill?.active}
                  className="w-full h-14 rounded-2xl bg-[#D4FF00] text-black font-display text-lg border-2 border-black shadow-brutal btn-brutal disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exec.phase === "connecting"
                    ? "CONNECTING WALLET..."
                    : exec.phase === "sending"
                    ? "CONFIRM IN METAMASK..."
                    : exec.phase === "waiting"
                    ? "WAITING FOR ORACLE..."
                    : currentSkill
                    ? `EXECUTE — ${currentSkill.price} A0GI →`
                    : "SELECT A SKILL"}
                </button>
              </>
            )}

            {walletAddr && exec.phase === "idle" && (
              <p className="text-xs text-black/60 text-center font-mono">
                Connected: <span className="font-bold text-black">{walletAddr.slice(0, 6)}...{walletAddr.slice(-4)}</span>
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {exec.phase === "error" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-5 mb-6"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF3333] border-2 border-black flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-base mb-1">EXECUTION FAILED</h4>
                  <p className="text-sm text-black/80 break-words">{exec.error}</p>
                  <button
                    onClick={() => setExec(INITIAL_STATE)}
                    className="mt-3 inline-block bg-black text-white font-display text-xs px-3 py-1.5 border-2 border-black rounded-full hover:bg-[#0038FF]"
                  >
                    DISMISS
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Progress Steps ── */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-6 mb-6"
            >
              <h3 className="font-display text-base tracking-wide mb-5">EXECUTION PROGRESS</h3>
              <div className="space-y-4">
                <Step num={1} title="PAYMENT SENT" desc={`You paid ${exec.amount || currentSkill?.price || "?"} A0GI to escrow`} done={exec.phase === "sending" || exec.phase === "waiting"} active={exec.phase === "connecting" || exec.phase === "sending"} />
                <Step num={2} title="ORACLE PROCESSING" desc="Oracle picks up request, runs skill inside TEE hardware" done={false} active={exec.phase === "waiting"} />
                <Step num={3} title="TEE VERIFICATION" desc="Output verified by Trusted Execution Environment" done={false} active={false} />
                <Step num={4} title="RECEIPT STORED" desc="Verified receipt uploaded to 0G decentralized storage" done={false} active={false} />
              </div>
              {exec.phase === "waiting" && (
                <div className="mt-6 pt-5 border-t-2 border-black">
                  <div className="flex items-center gap-2 text-sm font-mono font-bold">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#D4FF00] border border-black animate-pulse-dot" />
                    Waiting for oracle... ({exec.pollCount}s)
                  </div>
                  {exec.txHash && (
                    <a href={`${NETWORK.chainScan}/tx/${exec.txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0038FF] font-bold underline mt-2 inline-block">
                      View payment TX →
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Result ── */}
        <AnimatePresence>
          {exec.phase === "confirmed" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              {/* AI Output Hero */}
              <div className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal-lg overflow-hidden">
                <div className="bg-[#D4FF00] border-b-2 border-black px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black text-[#D4FF00] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="font-display text-sm tracking-wider">TEE VERIFIED</span>
                  </div>
                  <span className="font-display text-sm">{exec.skillName.toUpperCase()}</span>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <div className="font-mono text-[10px] tracking-widest font-bold text-black/50 mb-2">YOUR INPUT</div>
                    <div className="bg-[#FAFAFA] border-2 border-black rounded-xl p-3 text-sm">{exec.submittedInput}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] tracking-widest font-bold text-black/50 mb-2">AI RESPONSE</div>
                    {receiptData ? (
                      <pre className="whitespace-pre-wrap text-sm bg-[#FAFAFA] border-2 border-black p-4 rounded-xl overflow-x-auto max-h-96">
                        {(receiptData.output as string) || "No output returned"}
                      </pre>
                    ) : (
                      <div className="bg-[#FAFAFA] border-2 border-black rounded-xl p-4 text-sm text-black/60">
                        Output syncing from 0G Storage. Check the verify page if this takes a moment.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Verification badges */}
              <div className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-6">
                <h3 className="font-display text-base tracking-wide mb-4">VERIFICATION DETAILS</h3>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <VerifyBadge label="TEE ATTESTED" verified={receiptData?.teeVerified === true} />
                  <VerifyBadge label="ON-CHAIN SETTLED" verified />
                  <VerifyBadge label="RECEIPT STORED" verified={!!exec.receiptHash} />
                </div>
                <div className="space-y-3 pt-5 border-t-2 border-black">
                  <DetailRow label="Paid" value={`${exec.amount} A0GI`} highlight />
                  <DetailRow label="Revenue To" value={exec.payee} mono />
                  <DetailRow label="Execution ID" value={exec.executionId} mono />
                  <DetailRow label="Payment TX" value={exec.txHash} mono link={`${NETWORK.chainScan}/tx/${exec.txHash}`} />
                  {exec.receiptHash && <DetailRow label="Receipt Hash" value={exec.receiptHash} mono link={`${NETWORK.storageScan}/file/${exec.receiptHash}`} />}
                  {typeof receiptData?.chatID === "string" && <DetailRow label="TEE Chat ID" value={receiptData.chatID} mono />}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {exec.receiptHash && (
                  <Link href={`/verify?hash=${exec.receiptHash}`}>
                    <button className="bg-[#D4FF00] text-black font-display text-sm px-5 py-2.5 border-2 border-black rounded-full shadow-brutal-sm btn-brutal">
                      FULL VERIFICATION →
                    </button>
                  </Link>
                )}
                <a href={`${NETWORK.chainScan}/tx/${exec.txHash}`} target="_blank" rel="noopener noreferrer">
                  <button className="bg-white text-black font-display text-sm px-5 py-2.5 border-2 border-black rounded-full shadow-brutal-sm btn-brutal">
                    CHAINSCAN →
                  </button>
                </a>
                {exec.receiptHash && (
                  <a href={`${NETWORK.storageScan}/file/${exec.receiptHash}`} target="_blank" rel="noopener noreferrer">
                    <button className="bg-white text-black font-display text-sm px-5 py-2.5 border-2 border-black rounded-full shadow-brutal-sm btn-brutal">
                      STORAGESCAN →
                    </button>
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Refunded */}
        <AnimatePresence>
          {exec.phase === "refunded" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white text-black border-2 border-black rounded-2xl shadow-brutal p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#D4FF00] border-2 border-black flex items-center justify-center">
                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </div>
                <div>
                  <h3 className="font-display text-lg">EXECUTION REFUNDED</h3>
                  <p className="text-sm text-black/70">Your A0GI has been returned.</p>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <DetailRow label="Execution ID" value={exec.executionId} mono />
                <DetailRow label="TX" value={exec.txHash} mono link={`${NETWORK.chainScan}/tx/${exec.txHash}`} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </main>
  );
}

function Step({ num, title, desc, done, active }: { num: number; title: string; desc: string; done: boolean; active: boolean }) {
  return (
    <div className="flex gap-4">
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-display text-base transition-all border-2 border-black ${
        done ? "bg-[#D4FF00]" : active ? "bg-[#0038FF] text-white animate-pulse-dot" : "bg-[#FAFAFA] text-black/40"
      }`}>
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        ) : num}
      </div>
      <div className="flex-1 pt-1">
        <div className={`font-display text-sm tracking-wide ${done ? "text-black" : active ? "text-black" : "text-black/40"}`}>{title}</div>
        <div className="text-xs text-black/60 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function VerifyBadge({ label, verified }: { label: string; verified: boolean }) {
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

function DetailRow({ label, value, mono, highlight, link }: { label: string; value: string; mono?: boolean; highlight?: boolean; link?: string }) {
  const content = link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="text-[#0038FF] hover:underline break-all text-xs font-mono font-bold">{value}</a>
  ) : (
    <span className={`break-all ${highlight ? "text-[#0038FF] font-bold text-sm" : mono ? "font-mono text-xs text-black/80" : "text-sm text-black"}`}>{value}</span>
  );
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="font-mono text-[10px] font-bold tracking-widest text-black/50 min-w-[130px] shrink-0 pt-0.5">{label.toUpperCase()}</span>
      {content}
    </div>
  );
}

export default function ExecutePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0038FF]" />}>
      <ExecuteContent />
    </Suspense>
  );
}

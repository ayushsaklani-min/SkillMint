"use client";

import { useState } from "react";
import { ethers } from "ethers";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { NETWORK, REGISTRY_ABI, AGENT_SKILL_PROVIDER, AGENT_SKILL_MODEL } from "@/lib/contracts";
import { hashPrompt } from "@/lib/hash";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

type Kind = "prompt" | "agent-skill";
const stepsForKind = (k: Kind) => [
  { num: 1, title: "BASICS" },
  { num: 2, title: k === "prompt" ? "PROMPT" : "BUNDLE" },
  { num: 3, title: "PRICING" },
  { num: 4, title: "REVIEW" },
];

const MODELS = [
  { value: "qwen/qwen-2.5-7b-instruct", label: "Qwen 2.5 7B", network: "Testnet" },
  { value: "deepseek-chat-v3-0324", label: "DeepSeek v3", network: "Mainnet" },
  { value: "gpt-oss-120b", label: "GPT-OSS 120B", network: "Mainnet" },
  { value: "qwen3-vl-30b-a3b-instruct", label: "Qwen3 VL 30B", network: "Mainnet" },
];

const COMPAT = ["claude-code", "cursor", "codex"] as const;

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function PublishPage() {
  const [kind, setKind] = useState<Kind>("prompt");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [price, setPrice] = useState("0.001");
  const [model, setModel] = useState("qwen/qwen-2.5-7b-instruct");
  const [computeProvider, setComputeProvider] = useState("0xa48f01287233509FD694a22Bf840225062E67836");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ skillId: string; txHash: string; nftOwner: string; kind: Kind } | null>(null);
  const [error, setError] = useState("");

  // Agent-skill bundle state
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [bundleManifest, setBundleManifest] = useState<string[]>([]);
  const [bundleErr, setBundleErr] = useState("");
  const [compat, setCompat] = useState<string[]>(["claude-code"]);

  const STEPS = stepsForKind(kind);

  async function onPickBundle(file: File | null) {
    setBundleFile(null); setBundleManifest([]); setBundleErr("");
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setBundleErr("bundle exceeds 10 MB limit"); return; }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
      if (!names.includes("SKILL.md")) { setBundleErr("bundle must contain SKILL.md at the root"); return; }
      const sorted = [...names].sort((a, b) => a === "SKILL.md" ? -1 : b === "SKILL.md" ? 1 : a.localeCompare(b));
      setBundleFile(file);
      setBundleManifest(sorted.slice(0, 20));
      if (!name) setName(file.name.replace(/\.(skill|zip)$/i, ""));
    } catch (e) {
      setBundleErr(`could not open zip: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  async function ensureWalletReady() {
    if (!window.ethereum) throw new Error("MetaMask not found.");
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${NETWORK.chainId.toString(16)}` }],
    }).catch(async () => {
      await window.ethereum!.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: `0x${NETWORK.chainId.toString(16)}`,
          chainName: "0G Testnet",
          rpcUrls: [NETWORK.rpcUrl],
          blockExplorerUrls: [NETWORK.chainScan],
          nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
        }],
      });
    });
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    return { provider, signer, address: await signer.getAddress() };
  }

  async function publish() {
    setLoading(true); setError(""); setResult(null);
    try {
      if (kind === "agent-skill") return await publishAgent();
      const { signer, address } = await ensureWalletReady();
      const registry = new ethers.Contract(NETWORK.registry, REGISTRY_ABI, signer);

      // Encrypt prompt via the oracle: the ciphertext goes to 0G Storage, the plaintext
      // never touches on-chain metadata. Only the oracle (inside the TEE flow) can decrypt.
      const encRes = await fetch("/api/oracle/encrypt-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ systemPrompt }),
      });
      if (!encRes.ok) {
        const errText = await encRes.text().catch(() => "");
        throw new Error(`Prompt encryption failed: ${encRes.status} ${errText}`);
      }
      const enc = await encRes.json();
      if (!enc?.storageRoot || !enc?.iv) {
        throw new Error("Oracle returned malformed encryption payload");
      }

      const promptHash = hashPrompt(systemPrompt);
      const priceWei = ethers.parseEther(price);
      const metadata = JSON.stringify({
        kind: "prompt",
        name,
        description,
        storageRoot: enc.storageRoot,
        iv: enc.iv,
        algo: enc.algo,
        keyId: enc.keyId,
      });
      const tx = await registry.registerSkill(promptHash, computeProvider, model, priceWei, metadata);
      await tx.wait();
      const skillCount = await registry.skillCount();
      setResult({ skillId: skillCount.toString(), txHash: tx.hash, nftOwner: address, kind: "prompt" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg.includes("user rejected") ? "Transaction rejected by user" : msg);
    } finally {
      setLoading(false);
    }
  }

  async function publishAgent() {
    if (!bundleFile) throw new Error("pick a .skill or .zip bundle first");
    const { signer, address } = await ensureWalletReady();

    // 1. Encrypt + upload via oracle (multipart)
    const form = new FormData();
    form.append("bundle", bundleFile, bundleFile.name);
    form.append("name", name);
    const encRes = await fetch("/api/oracle/encrypt-bundle", { method: "POST", body: form });
    if (!encRes.ok) {
      const errText = await encRes.text().catch(() => "");
      throw new Error(`Bundle encryption failed: ${encRes.status} ${errText}`);
    }
    const enc = await encRes.json() as {
      storageRoot: string; iv: string; algo: "aes-256-gcm"; keyId: string;
      sha256: string; manifest: string[]; sizeBytes: number;
    };

    // 2. Mint NFT — promptHash = bundleSha256 (the cryptographic prompt-equivalent)
    const registry = new ethers.Contract(NETWORK.registry, REGISTRY_ABI, signer);
    const priceWei = ethers.parseEther(price);
    const metadata = JSON.stringify({
      kind: "agent-skill",
      name,
      description,
      bundleStorageRoot: enc.storageRoot,
      bundleIv: enc.iv,
      bundleAlgo: enc.algo,
      keyId: enc.keyId,
      bundleSha256: enc.sha256,
      sizeBytes: enc.sizeBytes,
      manifest: enc.manifest,
      format: "claude-skill",
      compatibleWith: compat,
    });
    const tx = await registry.registerSkill(enc.sha256, AGENT_SKILL_PROVIDER, AGENT_SKILL_MODEL, priceWei, metadata);
    await tx.wait();
    const skillCount = await registry.skillCount();
    setResult({ skillId: skillCount.toString(), txHash: tx.hash, nftOwner: address, kind: "agent-skill" });
  }

  const canNext = () => {
    if (step === 1) return name.trim() && description.trim();
    if (step === 2) {
      return kind === "prompt"
        ? systemPrompt.trim().length > 10
        : !!bundleFile && !bundleErr;
    }
    if (step === 3) {
      if (kind === "agent-skill") return Number(price) >= 0.001;
      return Number(price) >= 0.001 && computeProvider.trim();
    }
    return true;
  };

  return (
    <main className="min-h-screen bg-[#0038FF] text-white grid-bg-brutal">
      <Navbar />

      <div className="pt-28 sm:pt-36 mx-auto max-w-3xl px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-block bg-[#D4FF00] text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-black rounded-full mb-4">
            MINT A SKILL NFT
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white text-3d leading-[0.95] mb-4">
            SHIP YOUR<br /><span className="text-[#D4FF00] text-3d-lime">AI SKILL.</span>
          </h1>
          <p className="text-white/90 text-lg mb-10 max-w-xl">
            Register on-chain. Receive an ERC-721 NFT that earns 90% of every execution. Transfer, sell, or hodl.
          </p>
        </motion.div>

        {!result && (
          <>
            {/* Kind toggle — choose AI Skill (TEE inference) vs Agent Skill (folder bundle) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
              className="grid grid-cols-2 gap-3 mb-5"
            >
              <button
                type="button"
                onClick={() => { setKind("prompt"); setStep(1); }}
                className={`text-left p-4 rounded-2xl border-2 border-black btn-brutal ${
                  kind === "prompt" ? "bg-[#D4FF00] text-black shadow-brutal" : "bg-white text-black shadow-brutal-sm"
                }`}
              >
                <div className="font-display text-base leading-tight">⚡ AI SKILL</div>
                <div className="font-mono text-[10px] tracking-widest mt-1 text-black/70">PROMPT · TEE-ATTESTED</div>
              </button>
              <button
                type="button"
                onClick={() => { setKind("agent-skill"); setStep(1); }}
                className={`text-left p-4 rounded-2xl border-2 border-black btn-brutal ${
                  kind === "agent-skill" ? "bg-[#D4FF00] text-black shadow-brutal" : "bg-white text-black shadow-brutal-sm"
                }`}
              >
                <div className="font-display text-base leading-tight">📦 AGENT SKILL</div>
                <div className="font-mono text-[10px] tracking-widest mt-1 text-black/70">FOLDER · CLAUDE / CODEX</div>
              </button>
            </motion.div>

            {/* Stepper */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal p-5 mb-5"
            >
              <div className="flex items-center justify-between">
                {STEPS.map((s, i) => (
                  <div key={s.num} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-display text-base border-2 border-black transition-all ${
                        step > s.num ? "bg-[#D4FF00]" : step === s.num ? "bg-[#0038FF] text-white shadow-brutal-sm" : "bg-[#FAFAFA] text-black/40"
                      }`}>
                        {step > s.num ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : s.num}
                      </div>
                      <div className={`font-mono text-[10px] font-bold tracking-widest hidden sm:block ${step >= s.num ? "text-black" : "text-black/40"}`}>{s.title}</div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 mt-[-18px] ${step > s.num ? "bg-[#D4FF00]" : "bg-black/10"}`} />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
              className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal-lg p-6 sm:p-8 mb-5"
            >
              {step === 1 && (
                <div className="space-y-5">
                  <Field label="SKILL NAME">
                    <input
                      value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Smart Contract Auditor"
                      className="w-full h-12 bg-[#FAFAFA] border-2 border-black rounded-xl px-4 text-sm font-medium focus:outline-none focus:shadow-brutal-sm transition-shadow"
                    />
                  </Field>
                  <Field label="DESCRIPTION">
                    <textarea
                      value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Audits Solidity code for vulnerabilities and gas inefficiencies..."
                      className="w-full h-24 bg-[#FAFAFA] border-2 border-black rounded-xl px-4 py-3 text-sm resize-y focus:outline-none focus:shadow-brutal-sm transition-shadow"
                    />
                  </Field>
                </div>
              )}

              {step === 2 && kind === "prompt" && (
                <div className="space-y-5">
                  <Field label="SYSTEM PROMPT">
                    <textarea
                      value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="You are a smart contract security auditor. Analyze the provided Solidity code and return JSON: { vulnerabilities: [...], severity: 'low'|'medium'|'high'|'critical', gasOptimizations: [...], summary: string }"
                      className="w-full h-56 bg-[#FAFAFA] border-2 border-black rounded-xl px-4 py-3 text-sm font-mono resize-y focus:outline-none focus:shadow-brutal-sm transition-shadow"
                    />
                  </Field>
                  <div className="flex items-start gap-3 p-4 bg-[#D4FF00] border-2 border-black rounded-xl">
                    <span className="font-display text-xl">💡</span>
                    <div className="text-xs font-medium text-black">
                      <span className="font-display">PRO TIP:</span> Request structured JSON output. Agents will reliably parse it.
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && kind === "agent-skill" && (
                <div className="space-y-5">
                  <Field label="BUNDLE FILE (.skill or .zip · ≤ 10 MB · must contain SKILL.md)">
                    <input
                      type="file"
                      accept=".skill,.zip,application/zip"
                      onChange={(e) => onPickBundle(e.target.files?.[0] ?? null)}
                      className="w-full h-12 bg-[#FAFAFA] border-2 border-black rounded-xl px-4 text-xs font-mono cursor-pointer file:mr-3 file:px-3 file:py-1.5 file:bg-[#D4FF00] file:text-black file:border-2 file:border-black file:rounded-lg file:font-display file:text-[10px] file:tracking-widest file:cursor-pointer focus:outline-none"
                    />
                  </Field>
                  {bundleErr && (
                    <div className="bg-[#FF3333]/20 border-2 border-[#FF3333] rounded-xl p-3 text-xs text-[#FF3333] font-bold">
                      {bundleErr}
                    </div>
                  )}
                  {bundleFile && !bundleErr && (
                    <div className="bg-[#FAFAFA] border-2 border-black rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-xs font-bold truncate">{bundleFile.name}</div>
                        <div className="font-mono text-[10px] text-black/60 shrink-0">{fmtBytes(bundleFile.size)}</div>
                      </div>
                      <div className="font-mono text-[10px] tracking-widest text-black/50">MANIFEST · {bundleManifest.length} ENTRIES</div>
                      <ul className="font-mono text-[11px] space-y-0.5 max-h-44 overflow-y-auto">
                        {bundleManifest.map((n) => (
                          <li key={n} className="truncate">
                            {n === "SKILL.md" ? <span className="text-[#0038FF] font-bold">▸ {n}</span> : <span className="text-black/75">  {n}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Field label="COMPATIBLE WITH (informational)">
                    <div className="flex flex-wrap gap-2">
                      {COMPAT.map((c) => {
                        const active = compat.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCompat(active ? compat.filter((x) => x !== c) : [...compat, c])}
                            className={`px-3 py-1.5 font-mono text-[11px] tracking-widest border-2 border-black rounded-full btn-brutal ${
                              active ? "bg-[#0038FF] text-white shadow-brutal-sm" : "bg-white text-black"
                            }`}
                          >
                            {c.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <div className="flex items-start gap-3 p-4 bg-[#D4FF00] border-2 border-black rounded-xl">
                    <span className="font-display text-xl">📦</span>
                    <div className="text-xs font-medium text-black">
                      <span className="font-display">HOW IT WORKS:</span> Bundle is encrypted on 0G Storage. sha256 anchored on-chain. Buyers pay W0G via x402, get the zip back, verify byte-for-byte.
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && kind === "prompt" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label="PRICE (A0GI)">
                      <input
                        value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.001" min="0.001"
                        className="w-full h-12 bg-[#FAFAFA] border-2 border-black rounded-xl px-4 text-sm font-mono font-bold focus:outline-none focus:shadow-brutal-sm transition-shadow"
                      />
                    </Field>
                    <Field label="MODEL">
                      <select
                        value={model} onChange={(e) => setModel(e.target.value)}
                        className="w-full h-12 bg-[#FAFAFA] border-2 border-black rounded-xl px-4 text-sm font-medium focus:outline-none focus:shadow-brutal-sm transition-shadow"
                      >
                        {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label} ({m.network})</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="COMPUTE PROVIDER ADDRESS">
                    <input
                      value={computeProvider} onChange={(e) => setComputeProvider(e.target.value)}
                      className="w-full h-12 bg-[#FAFAFA] border-2 border-black rounded-xl px-4 text-xs font-mono font-bold focus:outline-none focus:shadow-brutal-sm transition-shadow"
                    />
                  </Field>
                  <div className="bg-[#0038FF] text-white border-2 border-black rounded-2xl p-5">
                    <div className="font-display text-xs tracking-widest mb-3">REVENUE SPLIT</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Price per execution</span><span className="font-mono font-bold">{price} A0GI</span></div>
                      <div className="flex justify-between"><span className="text-[#D4FF00]">Your earnings (90%)</span><span className="font-mono font-bold text-[#D4FF00]">{(Number(price) * 0.9).toFixed(4)} A0GI</span></div>
                      <div className="flex justify-between text-white/70"><span>Protocol fee (10%)</span><span className="font-mono">{(Number(price) * 0.1).toFixed(4)} A0GI</span></div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && kind === "agent-skill" && (
                <div className="space-y-5">
                  <Field label="PRICE PER DOWNLOAD (W0G)">
                    <input
                      value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.001" min="0.001"
                      className="w-full h-12 bg-[#FAFAFA] border-2 border-black rounded-xl px-4 text-sm font-mono font-bold focus:outline-none focus:shadow-brutal-sm transition-shadow"
                    />
                  </Field>
                  <div className="bg-[#0038FF] text-white border-2 border-black rounded-2xl p-5">
                    <div className="font-display text-xs tracking-widest mb-3">REVENUE SPLIT (PER DOWNLOAD)</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Price per download</span><span className="font-mono font-bold">{price} W0G</span></div>
                      <div className="flex justify-between"><span className="text-[#D4FF00]">Your earnings (90%)</span><span className="font-mono font-bold text-[#D4FF00]">{(Number(price) * 0.9).toFixed(4)} W0G</span></div>
                      <div className="flex justify-between text-white/70"><span>Protocol fee (10%)</span><span className="font-mono">{(Number(price) * 0.1).toFixed(4)} W0G</span></div>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="font-display text-lg tracking-wide mb-2">REVIEW YOUR {kind === "agent-skill" ? "AGENT SKILL" : "SKILL"}</h3>
                  <div className="bg-[#FAFAFA] border-2 border-black rounded-xl p-4 space-y-3">
                    <ReviewRow label="Kind" value={kind === "agent-skill" ? "Agent Skill (folder bundle)" : "AI Skill (prompt)"} highlight />
                    <ReviewRow label="Name" value={name} />
                    <ReviewRow label="Description" value={description} />
                    {kind === "prompt" ? (
                      <>
                        <ReviewRow label="Model" value={MODELS.find(m => m.value === model)?.label || model} />
                        <ReviewRow label="Price" value={`${price} A0GI`} highlight />
                        <ReviewRow label="Compute Provider" value={computeProvider} mono />
                        <ReviewRow label="System Prompt" value={systemPrompt.slice(0, 120) + (systemPrompt.length > 120 ? "..." : "")} />
                      </>
                    ) : (
                      <>
                        <ReviewRow label="Bundle" value={`${bundleFile?.name ?? "(none)"} · ${bundleFile ? fmtBytes(bundleFile.size) : ""}`} mono />
                        <ReviewRow label="Manifest" value={`${bundleManifest.length} entr${bundleManifest.length === 1 ? "y" : "ies"}`} />
                        <ReviewRow label="Compatible with" value={compat.length ? compat.join(", ") : "(none)"} mono />
                        <ReviewRow label="Price per download" value={`${price} W0G`} highlight />
                      </>
                    )}
                  </div>
                  <div className="bg-[#D4FF00] text-black border-2 border-black rounded-xl p-4">
                    <div className="font-display text-sm mb-1">ERC-721 NFT MINTING</div>
                    <p className="text-xs">
                      {kind === "agent-skill"
                        ? "On publish, the bundle is encrypted on 0G Storage and the sha256 is anchored on-chain. You earn 90% of every download, forever."
                        : "On publish, you'll receive an NFT token that earns 90% of every execution. Transfer or sell — revenue follows the owner."}
                    </p>
                  </div>
                  {error && (
                    <div className="bg-[#FF3333]/20 border-2 border-[#FF3333] rounded-xl p-3 text-sm text-[#FF3333] font-bold">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1 || loading}
                className="flex-1 h-12 rounded-full bg-white text-black font-display text-sm border-2 border-black shadow-brutal-sm btn-brutal disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← BACK
              </button>
              {step < 4 ? (
                <button
                  onClick={() => setStep(Math.min(4, step + 1))}
                  disabled={!canNext()}
                  className="flex-1 h-12 rounded-full bg-[#D4FF00] text-black font-display text-sm border-2 border-black shadow-brutal btn-brutal disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  CONTINUE →
                </button>
              ) : (
                <button
                  onClick={publish}
                  disabled={loading}
                  className="flex-1 h-12 rounded-full bg-[#D4FF00] text-black font-display text-sm border-2 border-black shadow-brutal btn-brutal disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "MINTING NFT..." : "MINT SKILL NFT →"}
                </button>
              )}
            </div>
          </>
        )}

        {/* Success */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal-lg overflow-hidden"
            >
              <div className="bg-[#D4FF00] border-b-2 border-black h-2" />
              <div className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.6, type: "spring" }}
                  className="w-24 h-24 rounded-3xl bg-[#D4FF00] border-2 border-black shadow-brutal flex items-center justify-center mx-auto mb-5"
                >
                  <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </motion.div>
                <h2 className="font-display text-4xl sm:text-5xl mb-2">{result.kind === "agent-skill" ? "BUNDLE MINTED!" : "SKILL MINTED!"}</h2>
                <p className="text-sm font-mono font-bold tracking-wider text-black/70 mb-6">
                  LIVE ON 0G CHAIN · {result.kind === "agent-skill" ? "AGENTS CAN DOWNLOAD NOW" : "AGENTS CAN EXECUTE NOW"}
                </p>
                <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                  <span className="bg-[#0038FF] text-white font-display text-sm px-3 py-1.5 border-2 border-black rounded-full">NFT #{result.skillId}</span>
                  <span className="bg-[#D4FF00] text-black font-display text-sm px-3 py-1.5 border-2 border-black rounded-full">LIVE</span>
                  <span className="bg-white text-black font-display text-sm px-3 py-1.5 border-2 border-black rounded-full">{result.kind === "agent-skill" ? "📦 AGENT SKILL" : "⚡ AI SKILL"}</span>
                </div>
                <div className="bg-[#FAFAFA] border-2 border-black rounded-xl p-4 text-left mb-6 space-y-3">
                  <ReviewRow label="Skill ID" value={`#${result.skillId}`} />
                  <ReviewRow label="NFT Owner" value={result.nftOwner} mono />
                  <ReviewRow label="TX Hash" value={result.txHash} mono />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href={`/skill/${result.skillId}`} className="flex-1">
                    <button className="w-full h-12 rounded-full bg-[#D4FF00] text-black font-display text-sm border-2 border-black shadow-brutal btn-brutal">
                      VIEW MY SKILL →
                    </button>
                  </Link>
                  <a href={`${NETWORK.chainScan}/tx/${result.txHash}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <button className="w-full h-12 rounded-full bg-white text-black font-display text-sm border-2 border-black shadow-brutal-sm btn-brutal">
                      VIEW ON CHAINSCAN
                    </button>
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] font-bold tracking-widest text-black/70 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="font-mono text-[10px] font-bold tracking-widest text-black/50 min-w-[130px] shrink-0 pt-0.5">{label.toUpperCase()}</span>
      <span className={`break-all ${
        highlight ? "text-[#0038FF] font-bold text-sm" :
        mono ? "font-mono text-xs text-black/80" : "text-sm text-black"
      }`}>
        {value}
      </span>
    </div>
  );
}

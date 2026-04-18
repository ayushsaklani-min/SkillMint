"use client";

import { useEffect, useState, useRef } from "react";
import { ethers } from "ethers";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { NETWORK, REGISTRY_ABI, ESCROW_ABI } from "@/lib/contracts";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

// ─── Types ────────────────────────────────────────────────────────────────

interface SkillCard {
  id: number;
  name: string;
  description: string;
  model: string;
  price: string;
  total: number;
  successful: number;
  rate: number;
  active: boolean;
  owner: string;
}

interface Stats {
  skillCount: number;
  totalExecutions: number;
  totalRevenue: string;
}

// ─── Helper Components ────────────────────────────────────────────────────

function FadeIn({
  children,
  className = "",
  delay = 0,
  y = 30,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Hand-drawn SVG arrow — wobbly, curved, brutalist */
function ScribbleArrow({
  className = "",
  color = "#D4FF00",
  direction = "down-right",
}: {
  className?: string;
  color?: string;
  direction?: "down-right" | "down-left" | "right" | "left-curve";
}) {
  const paths: Record<string, string> = {
    "down-right":
      "M10 10 C 30 20, 50 35, 70 55 C 85 70, 95 85, 110 95 M 95 80 L 110 95 L 98 100",
    "down-left":
      "M110 10 C 90 20, 70 35, 50 55 C 35 70, 25 85, 10 95 M 25 80 L 10 95 L 22 100",
    right: "M5 30 C 25 20, 55 20, 75 30 C 90 37, 100 45, 115 40 M 105 32 L 118 40 L 108 48",
    "left-curve":
      "M115 15 C 85 10, 55 30, 40 50 C 25 68, 20 80, 15 95 M 25 82 L 12 96 L 28 100",
  };
  return (
    <svg
      viewBox="0 0 125 110"
      className={className}
      fill="none"
      stroke={color}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[direction]} />
    </svg>
  );
}

/** Rotating circular badge — "GET STARTED • GET STARTED •" */
function RotatingBadge({ label = "GET STARTED", size = 140 }: { label?: string; size?: number }) {
  const text = `${label} • ${label} • `;
  const chars = text.split("");
  const radius = size / 2 - 18;
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-[#D4FF00] border-2 border-black shadow-brutal animate-spin-slow">
        {chars.map((ch, i) => {
          const angle = (i / chars.length) * 360;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 font-display text-[10px] tracking-widest text-black"
              style={{
                transform: `rotate(${angle}deg) translateY(-${radius}px)`,
                transformOrigin: "0 0",
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      {/* arrow center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-10 h-10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
            <path d="M5 19 L 19 5" />
            <path d="M8 5 L 19 5 L 19 16" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** Mini floating skill card (glass over blue) */
function FloatingSkillCard({
  skill,
  className = "",
  variant = "a",
}: {
  skill: SkillCard | null;
  className?: string;
  variant?: "a" | "b";
}) {
  if (!skill) return null;
  return (
    <div
      className={`glass-brutal p-4 w-[240px] ${
        variant === "a" ? "animate-float-1" : "animate-float-2"
      } ${className}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 shrink-0 rounded-xl bg-[#D4FF00] border-2 border-black flex items-center justify-center font-display text-black text-lg">
          #{skill.id}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white font-display text-sm truncate">{skill.name}</div>
          <div className="text-white/70 text-xs">{skill.total} runs · {skill.rate}%</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="bg-black text-[#D4FF00] font-mono text-xs font-bold px-2 py-1 rounded-full border border-black">
          {skill.price} A0GI
        </span>
        <span className="text-white/80 text-[10px] font-mono">
          {skill.owner.slice(0, 4)}...{skill.owner.slice(-3)}
        </span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [skills, setSkills] = useState<SkillCard[]>([]);
  const [stats, setStats] = useState<Stats>({ skillCount: 0, totalExecutions: 0, totalRevenue: "0" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const provider = new ethers.JsonRpcProvider(NETWORK.rpcUrl);
      const registry = new ethers.Contract(NETWORK.registry, REGISTRY_ABI, provider);
      const escrow = new ethers.Contract(NETWORK.escrow, ESCROW_ABI, provider);
      const count = Number(await registry.skillCount());
      const loaded: SkillCard[] = [];
      let totalExecs = 0;

      for (let i = 1; i <= count; i++) {
        const skill = await registry.getSkill(i);
        const [total, successful, rate] = await registry.getReputationScore(i);
        const owner = await registry.ownerOf(i);
        let meta: { name?: string; description?: string } = {};
        try { meta = JSON.parse(skill.metadata); } catch {}

        const execCount = Number(total);
        totalExecs += execCount;

        loaded.push({
          id: i,
          name: meta.name || `Skill #${i}`,
          description: meta.description || "",
          model: skill.model,
          price: ethers.formatEther(skill.priceA0GI),
          total: execCount,
          successful: Number(successful),
          rate: Number(rate),
          active: skill.active,
          owner,
        });
      }

      let totalRevWei = BigInt(0);
      try {
        const filter = escrow.filters.ExecutionConfirmed();
        const events = await escrow.queryFilter(filter, -50000);
        for (const ev of events) {
          const parsed = escrow.interface.parseLog({ topics: ev.topics as string[], data: ev.data });
          if (parsed?.args) {
            totalRevWei += BigInt(parsed.args.payeeAmount || 0);
          }
        }
      } catch {}

      setSkills(loaded);
      setStats({
        skillCount: count,
        totalExecutions: totalExecs,
        totalRevenue: Number(ethers.formatEther(totalRevWei)).toFixed(3),
      });
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }

  const heroSkillA = skills[0] || null;
  const heroSkillB = skills[1] || null;

  return (
    <main className="min-h-screen bg-[#0038FF] text-white overflow-hidden">
      <Navbar />

      {/* ═══════════════════════════════════════════════════════════════
         HERO
         ═══════════════════════════════════════════════════════════════ */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 grid-bg-brutal overflow-hidden">

        {/* Left / right floating arrow buttons (decorative / carousel style) */}
        <button
          aria-hidden="true"
          className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center bg-black text-white rounded-xl border-2 border-black shadow-brutal-sm btn-brutal z-20"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M15 18 L 9 12 L 15 6" />
          </svg>
        </button>
        <button
          aria-hidden="true"
          className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center bg-black text-white rounded-xl border-2 border-black shadow-brutal-sm btn-brutal z-20"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M9 18 L 15 12 L 9 6" />
          </svg>
        </button>

        <div className="relative mx-auto max-w-7xl px-6">
          {/* Live badge */}
          <FadeIn className="flex justify-center mb-8">
            <div className="flex items-center gap-2 bg-black text-[#D4FF00] font-mono text-xs font-bold px-4 py-2 border-2 border-black rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#D4FF00] animate-pulse-dot" />
              LIVE ON 0G GALILEO TESTNET
            </div>
          </FadeIn>

          {/* Massive stacked display typography */}
          <div className="relative">
            <FadeIn delay={0.05}>
              <h1 className="font-display text-center leading-[0.9] tracking-tight">
                <span className="block text-[#D4FF00] text-3d-lime text-[clamp(3.5rem,13vw,11rem)]">
                  #VERIFIED
                </span>
                <span className="block text-white text-3d text-[clamp(3rem,11vw,9.5rem)] mt-2">
                  AI·SKILLS
                </span>
                <span className="block text-white text-3d text-[clamp(2.5rem,9vw,8rem)] mt-2">
                  ON&nbsp;CHAIN
                </span>
              </h1>
            </FadeIn>



            {/* Rotating GET STARTED badge */}
            <Link
              href="/execute"
              className="hidden md:block absolute right-[4%] bottom-[-40px] z-10"
            >
              <RotatingBadge label="GET STARTED" size={150} />
            </Link>
          </div>

          {/* Subtitle */}
          <FadeIn delay={0.2} className="mt-16 text-center">
            <p className="mx-auto max-w-2xl text-lg sm:text-xl text-white/90 font-medium">
              The first AI skill marketplace where every execution is{" "}
              <span className="bg-[#D4FF00] text-black px-2 border-2 border-black rounded-md font-bold">hardware-verified</span>,
              every payment is automatic, and every result is provable.
            </p>
          </FadeIn>

          {/* CTAs */}
          <FadeIn delay={0.3} className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/execute">
              <button className="bg-[#D4FF00] text-black font-display text-base sm:text-lg px-7 sm:px-8 py-3.5 border-2 border-black rounded-full shadow-brutal btn-brutal">
                EXPLORE SKILLS →
              </button>
            </Link>
            <Link href="/publish">
              <button className="bg-white text-black font-display text-base sm:text-lg px-7 sm:px-8 py-3.5 border-2 border-black rounded-full shadow-brutal btn-brutal">
                PUBLISH A SKILL
              </button>
            </Link>
            <Link href="/explainer">
              <button className="bg-black text-[#D4FF00] font-display text-base sm:text-lg px-7 sm:px-8 py-3.5 border-2 border-black rounded-full shadow-brutal btn-brutal flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />
                </svg>
                WATCH EXPLAINER
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
         STATS STRIP — white panel overlapping blue
         ═══════════════════════════════════════════════════════════════ */}
      <section className="relative -mt-10 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="bg-white text-black border-2 border-black rounded-3xl shadow-brutal-lg overflow-hidden">
              <div className="grid grid-cols-3 divide-x-2 divide-black">
                <StatBox label="SKILLS MINTED" value={loading ? "…" : stats.skillCount.toString()} />
                <StatBox label="EXECUTIONS" value={loading ? "…" : stats.totalExecutions.toString()} accent />
                <StatBox label="A0GI SETTLED" value={loading ? "…" : stats.totalRevenue} />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
         EXPLAINER PROMO — scroll-story CTA
         ═══════════════════════════════════════════════════════════════ */}
      <section className="relative px-4 sm:px-6 mt-16">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <Link href="/explainer" className="block group">
              <div className="relative bg-black text-white border-2 border-black rounded-3xl shadow-brutal-lg overflow-hidden">
                <div className="grid md:grid-cols-[1.3fr_1fr]">
                  {/* Left — copy */}
                  <div className="p-8 sm:p-12 relative">
                    <div className="inline-flex items-center gap-2 bg-[#D4FF00] text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-black rounded-full mb-5">
                      <span className="w-1.5 h-1.5 rounded-full bg-black" />
                      SCROLL-DRIVEN EXPLAINER
                    </div>
                    <h2 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[0.95] mb-5">
                      SEE HOW<br />
                      <span className="text-[#D4FF00]">SKILLMINT</span><br />
                      ACTUALLY WORKS.
                    </h2>
                    <p className="text-white/80 text-base max-w-md mb-6">
                      A 7-scene animated walkthrough — Problem, Brand, Explore, Execute, Verify, Publish, Outro. Scroll through the whole SkillMint story in 30 seconds.
                    </p>
                    <div className="inline-flex items-center gap-2 bg-[#D4FF00] text-black font-display text-sm sm:text-base px-5 py-3 border-2 border-[#D4FF00] rounded-full shadow-brutal btn-brutal">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <polygon points="6 4 20 12 6 20 6 4" />
                      </svg>
                      WATCH EXPLAINER →
                    </div>
                  </div>

                  {/* Right — visual preview (static brutalist collage) */}
                  <div className="relative bg-[#1A3CFF] grid-bg-brutal border-l-2 border-black overflow-hidden min-h-[280px] flex items-center justify-center p-6">
                    <div className="absolute top-6 left-6 bg-black text-[#D4FF00] font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-[#D4FF00] rounded-full">
                      ● 01 PROBLEM
                    </div>
                    <div className="absolute top-6 right-6 bg-white text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-black rounded-full">
                      SCROLL ↓
                    </div>
                    {/* stacked brutalist text preview */}
                    <div className="font-display text-center leading-[0.9]">
                      <div className="text-white text-3d text-4xl sm:text-5xl md:text-6xl">
                        #VERIFIED
                      </div>
                      <div className="text-[#D4FF00] text-3d-lime text-3xl sm:text-4xl md:text-5xl mt-2">
                        AI·SKILLS
                      </div>
                      <div className="text-white text-3d text-2xl sm:text-3xl md:text-4xl mt-2">
                        ON·CHAIN
                      </div>
                    </div>
                    {/* floating card hint */}
                    <div className="absolute bottom-6 left-6 glass-brutal p-3 rotate-[-4deg]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#D4FF00] border-2 border-black" />
                        <div className="flex flex-col">
                          <span className="text-white font-display text-xs">SKILL #1</span>
                          <span className="text-white/60 text-[10px] font-mono">TEE VERIFIED</span>
                        </div>
                      </div>
                    </div>
                    {/* rotating sticker badge */}
                    <div className="absolute bottom-6 right-6 w-20 h-20 rounded-full bg-[#D4FF00] border-2 border-black shadow-brutal flex items-center justify-center font-display text-[10px] tracking-widest rotate-[12deg]">
                      PLAY
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
         HOW IT WORKS — white panel with 3 brutal cards
         ═══════════════════════════════════════════════════════════════ */}
      <section className="relative bg-white text-black mt-20 border-y-2 border-black">
        <div className="grid-bg-light">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
            <FadeIn className="text-center mb-14">
              <div className="inline-block bg-black text-[#D4FF00] font-mono text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                HOW IT WORKS
              </div>
              <h2 className="font-display text-4xl sm:text-6xl text-black">
                THREE STEPS.<br />
                <span className="text-[#0038FF]">ZERO TRUST REQUIRED.</span>
              </h2>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
              {[
                {
                  step: "01",
                  title: "PUBLISH\nSKILL NFT",
                  desc: "Register your AI prompt on-chain. Receive an ERC-721 NFT that captures 90% of every execution forever.",
                  tone: "white" as const,
                  illustration: (
                    <div className="bg-[#0038FF] text-white font-display text-xs px-3 py-2 rounded-full border-2 border-black inline-flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#D4FF00] border border-black" />
                      baseclub.eth
                      <span className="bg-[#D4FF00] text-black px-2 py-0.5 rounded-full border border-black ml-2">
                        NFT #7
                      </span>
                    </div>
                  ),
                },
                {
                  step: "02",
                  title: "EXECUTE\nIN TEE",
                  desc: "Agent pays escrow. Oracle runs prompt inside Trusted Execution Environment on 0G Compute.",
                  tone: "blue" as const,
                  illustration: (
                    <div className="inline-flex items-center gap-2">
                      <div className="bg-[#D4FF00] text-black font-display text-sm px-3 py-2 rounded-full border-2 border-black">
                        0.001
                      </div>
                      <div className="bg-white text-black font-display text-sm px-3 py-2 rounded-full border-2 border-black">
                        A0GI
                      </div>
                      <div className="bg-black text-[#D4FF00] w-9 h-9 rounded-full border-2 border-black flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M5 19 L 19 5" /><path d="M8 5 L 19 5 L 19 16" /></svg>
                      </div>
                    </div>
                  ),
                },
                {
                  step: "03",
                  title: "EARN\nA0GI",
                  desc: "90% to NFT owner on verified receipt. 10% protocol fee. Everything settles in one block.",
                  tone: "lime" as const,
                  illustration: (
                    <div className="bg-[#D4FF00] text-black font-display px-4 py-2 rounded-full border-2 border-black inline-flex items-center gap-2">
                      <span className="text-[10px] tracking-wider">EST. MONTHLY</span>
                      <span className="text-base">188.34</span>
                    </div>
                  ),
                },
              ].map((item, i) => (
                <div key={item.step} className="relative">
                  <FadeIn delay={i * 0.1}>
                    <div
                      className={`relative border-2 border-black rounded-3xl shadow-brutal-lg p-7 min-h-[340px] flex flex-col ${
                        item.tone === "white"
                          ? "bg-white text-black"
                          : item.tone === "blue"
                          ? "bg-[#0038FF] text-white"
                          : "bg-[#D4FF00] text-black"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-5">
                        <div className={`font-mono text-xs font-bold px-2.5 py-1 rounded-full border-2 border-black ${
                          item.tone === "blue" ? "bg-white text-black" : "bg-black text-white"
                        }`}>
                          STEP {item.step}
                        </div>
                      </div>

                      <h3 className="font-display text-3xl sm:text-4xl leading-[0.95] whitespace-pre-line mb-4">
                        {item.title}
                      </h3>

                      <p className={`text-sm leading-relaxed mb-6 ${
                        item.tone === "blue" ? "text-white/90" : "text-black/75"
                      }`}>
                        {item.desc}
                      </p>

                      <div className="mt-auto">{item.illustration}</div>
                    </div>
                  </FadeIn>

                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
         LIVE SKILLS — blue section with brutal cards
         ═══════════════════════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 grid-bg-brutal">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="mb-12 flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="inline-block bg-[#D4FF00] text-black font-mono text-xs font-bold px-3 py-1.5 border-2 border-black rounded-full mb-4">
                LIVE SKILLS
              </div>
              <h2 className="font-display text-5xl sm:text-6xl text-white text-3d">
                MINTED.<br />
                TRADEABLE.
              </h2>
            </div>
            <Link
              href="/publish"
              className="bg-white text-black font-display text-sm px-5 py-2.5 border-2 border-black rounded-full shadow-brutal-sm btn-brutal"
            >
              MINT YOURS →
            </Link>
          </FadeIn>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white/20 border-2 border-white/40 rounded-2xl h-56" />
              ))}
            </div>
          ) : skills.length === 0 ? (
            <div className="bg-white border-2 border-black rounded-2xl shadow-brutal p-12 text-center text-black">
              <p className="font-display text-xl mb-2">NO SKILLS YET</p>
              <Link href="/publish" className="text-[#0038FF] font-bold underline">
                Be the first to mint →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {skills.map((s, i) => (
                <FadeIn key={s.id} delay={i * 0.04}>
                  <Link href={`/skill/${s.id}`}>
                    <div className="relative h-full bg-white text-black border-2 border-black rounded-2xl shadow-brutal btn-brutal p-5 group cursor-pointer">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="bg-[#D4FF00] text-black font-display text-xs px-2.5 py-1 border-2 border-black rounded-full">
                          NFT #{s.id}
                        </div>
                        {s.active ? (
                          <div className="flex items-center gap-1.5 bg-black text-[#D4FF00] font-mono text-[10px] font-bold px-2 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D4FF00] animate-pulse-dot" />
                            LIVE
                          </div>
                        ) : (
                          <div className="bg-zinc-200 text-zinc-600 font-mono text-[10px] font-bold px-2 py-1 rounded-full border border-zinc-300">
                            OFFLINE
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <h3 className="font-display text-xl sm:text-2xl leading-[0.95] mb-3 line-clamp-2 group-hover:text-[#0038FF] transition-colors">
                        {s.name.toUpperCase()}
                      </h3>

                      <p className="text-sm text-black/70 line-clamp-2 mb-5 leading-relaxed">
                        {s.description || "No description."}
                      </p>

                      {/* Stats row */}
                      <div className="flex items-center justify-between gap-2 pt-4 border-t-2 border-black">
                        <span className="bg-[#0038FF] text-white font-display text-xs px-3 py-1.5 rounded-full border-2 border-black">
                          {s.price} A0GI
                        </span>
                        <div className="flex items-center gap-2 text-xs font-mono font-bold">
                          {s.total > 0 && (
                            <span className="text-black">
                              {s.rate}% <span className="text-black/50">· {s.total} runs</span>
                            </span>
                          )}
                          {s.total === 0 && <span className="text-black/50">NEW</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
         WHY SKILLMINT — white panel
         ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-white text-black border-y-2 border-black">
        <div className="grid-bg-light">
          <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
            <FadeIn className="text-center mb-14">
              <div className="inline-block bg-[#0038FF] text-white font-mono text-xs font-bold px-3 py-1.5 border-2 border-black rounded-full mb-4">
                WHY SKILLMINT
              </div>
              <h2 className="font-display text-4xl sm:text-6xl">
                BUILT FOR A<br />
                <span className="text-[#0038FF]">TRUSTLESS</span> WORLD.
              </h2>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: "TEE VERIFIED",
                  desc: "Every execution runs in hardware-isolated enclaves. Outputs cryptographically attested on 0G Compute.",
                  tone: "blue" as const,
                },
                {
                  title: "AUTO PAYMENT",
                  desc: "Escrow releases only on confirmed receipt. 90% NFT owner · 10% protocol. PullPayment for reentrancy-safe withdrawals.",
                  tone: "white" as const,
                },
                {
                  title: "ON-CHAIN REPUTATION",
                  desc: "Success rate baked into the smart contract. No reviews to fake, no badges to spoof. Just executions.",
                  tone: "lime" as const,
                },
                {
                  title: "OPEN VERIFICATION",
                  desc: "Anyone can verify any past execution. Receipts permanently on 0G Storage. Trust nobody. Verify everything.",
                  tone: "white" as const,
                },
              ].map((item, i) => (
                <FadeIn key={item.title} delay={i * 0.08}>
                  <div
                    className={`border-2 border-black rounded-2xl shadow-brutal p-7 h-full ${
                      item.tone === "blue"
                        ? "bg-[#0038FF] text-white"
                        : item.tone === "lime"
                        ? "bg-[#D4FF00] text-black"
                        : "bg-white text-black"
                    }`}
                  >
                    <h3 className="font-display text-2xl sm:text-3xl mb-3">{item.title}</h3>
                    <p className={`text-sm leading-relaxed ${item.tone === "blue" ? "text-white/90" : "text-black/80"}`}>
                      {item.desc}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
         BIG CTA
         ═══════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 grid-bg-brutal">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <FadeIn>
            <h2 className="font-display text-[clamp(3rem,10vw,7.5rem)] text-white text-3d leading-[0.9]">
              READY TO <br />
              <span className="text-[#D4FF00] text-3d-lime">SHIP?</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-8 text-white/90 text-lg max-w-xl mx-auto">
              Mint your first skill NFT in under 60 seconds. No gatekeepers, no review boards — just code, prompts, and chain.
            </p>
          </FadeIn>
          <FadeIn delay={0.2} className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/publish">
              <button className="bg-[#D4FF00] text-black font-display text-lg px-8 py-4 border-2 border-black rounded-full shadow-brutal-lg btn-brutal">
                MINT A SKILL NFT →
              </button>
            </Link>
            <Link href="/verify">
              <button className="bg-white text-black font-display text-lg px-8 py-4 border-2 border-black rounded-full shadow-brutal-lg btn-brutal">
                VERIFY EXECUTION
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </main>
  );
}

// ─── Sub Components ─────────────────────────────────────────────────────

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`px-6 py-7 sm:py-10 text-center ${accent ? "bg-[#D4FF00]" : "bg-white"}`}>
      <div className="font-display text-4xl sm:text-5xl md:text-6xl text-black leading-none">
        {value}
      </div>
      <div className="mt-2 text-[10px] sm:text-xs font-mono font-bold tracking-widest text-black/70">
        {label}
      </div>
    </div>
  );
}

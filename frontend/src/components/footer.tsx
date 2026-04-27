import Link from "next/link";
import Image from "next/image";
import { NETWORK } from "@/lib/contracts";

export default function Footer() {
  return (
    <footer className="bg-black text-white border-t-2 border-black">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-1 group mb-5">
              <Image
                src="/logo.png.png"
                alt="SkillMint"
                width={144}
                height={144}
                className="w-32 h-32 sm:w-36 sm:h-36 object-contain transition-transform group-hover:scale-105"
              />
              <span className="font-display text-3xl sm:text-4xl font-black tracking-tight leading-none text-white -ml-4 sm:-ml-5">
                SKILL<span className="text-[#20C20E]">MINT</span>
              </span>
            </Link>
            <p className="text-white/70 text-sm max-w-md leading-relaxed mb-6">
              The verified AI skill execution protocol.<br />
              Every execution TEE-attested. Every payment automatic. Every result provable.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="bg-[#0038FF] text-white font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-[#0038FF] rounded-full">
                BUILT ON 0G
              </span>
              <span className="bg-[#D4FF00] text-black font-mono text-[10px] font-bold tracking-widest px-3 py-1.5 border-2 border-[#D4FF00] rounded-full">
                0G APAC HACKATHON 2026
              </span>
            </div>
          </div>

          {/* Protocol */}
          <div>
            <h4 className="font-display text-sm tracking-widest text-[#D4FF00] mb-4">PROTOCOL</h4>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li><Link href="/" className="hover:text-[#D4FF00] transition-colors">Explore Skills</Link></li>
              <li><Link href="/execute" className="hover:text-[#D4FF00] transition-colors">Execute</Link></li>
              <li><Link href="/verify" className="hover:text-[#D4FF00] transition-colors">Verify</Link></li>
              <li><Link href="/publish" className="hover:text-[#D4FF00] transition-colors">Publish</Link></li>
              <li><Link href="/explainer" className="hover:text-[#D4FF00] transition-colors">Explainer</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display text-sm tracking-widest text-[#D4FF00] mb-4">RESOURCES</h4>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li>
                <a href={NETWORK.chainScan} target="_blank" rel="noopener noreferrer" className="hover:text-[#D4FF00] transition-colors">
                  0G ChainScan →
                </a>
              </li>
              <li>
                <a href={NETWORK.storageScan} target="_blank" rel="noopener noreferrer" className="hover:text-[#D4FF00] transition-colors">
                  StorageScan →
                </a>
              </li>
              <li>
                <a href="https://0g.ai" target="_blank" rel="noopener noreferrer" className="hover:text-[#D4FF00] transition-colors">
                  0G Network →
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t-2 border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono font-bold tracking-widest">
          <span className="text-white/50">SKILLMINT PROTOCOL · VERIFIED AI SKILL EXECUTION</span>
          <span className="text-[#D4FF00]">{NETWORK.chainId === 16661 ? "0G ARISTOTLE MAINNET" : "0G GALILEO TESTNET"}</span>
        </div>
      </div>
    </footer>
  );
}

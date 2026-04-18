"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NETWORK } from "@/lib/contracts";

const NAV_LINKS = [
  { href: "/", label: "Explore" },
  { href: "/execute", label: "Execute" },
  { href: "/verify", label: "Verify" },
  { href: "/publish", label: "Publish" },
  { href: "/explainer", label: "Explainer" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [walletAddr, setWalletAddr] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!walletMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(e.target as Node)) {
        setWalletMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [walletMenuOpen]);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY && y > 80);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          const accts = accounts as string[];
          if (accts.length > 0) setWalletAddr(accts[0]);
        })
        .catch(() => {});

      window.ethereum.on?.("accountsChanged", (accounts) => {
        const accts = accounts as string[];
        setWalletAddr(accts.length > 0 ? accts[0] : "");
      });
    }
  }, []);

  async function disconnectWallet() {
    setWalletAddr("");
    setWalletMenuOpen(false);
    try {
      await window.ethereum?.request?.({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      /* wallet doesn't support revokePermissions — local clear is enough */
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not found. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      await window.ethereum
        .request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${NETWORK.chainId.toString(16)}` }],
        })
        .catch(async () => {
          await window.ethereum!.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${NETWORK.chainId.toString(16)}`,
                chainName: "0G Galileo Testnet",
                rpcUrls: [NETWORK.rpcUrl],
                blockExplorerUrls: [NETWORK.chainScan],
                nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
              },
            ],
          });
        });

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts.length > 0) setWalletAddr(accounts[0]);
    } catch {
      /* user rejected */
    } finally {
      setConnecting(false);
    }
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[90] px-4 sm:px-6 pt-4 sm:pt-6 transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* ── Brand logo ── */}
        <Link href="/" className="flex items-center gap-0.5 shrink-0 group">
          <Image
            src="/logo.png.png"
            alt="SkillMint"
            width={112}
            height={112}
            priority
            className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 object-contain transition-transform group-hover:scale-105"
          />
          <span className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-none text-black -ml-3 sm:-ml-4 lg:-ml-5">
            SKILL<span className="text-[#20C20E] [text-shadow:2px_2px_0_#000]">MINT</span>
          </span>
        </Link>

        {/* ── Desktop Nav pills ── */}
        <div className="hidden lg:flex items-center gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-5 py-2 font-display text-sm tracking-tight border-2 border-black rounded-full transition-all btn-brutal ${
                isActive(link.href)
                  ? "bg-[#D4FF00] text-black shadow-brutal-sm"
                  : "bg-white text-black shadow-brutal-sm"
              }`}
            >
              {link.label.toUpperCase()}
            </Link>
          ))}
        </div>

        {/* ── Wallet + Mobile ── */}
        <div className="flex items-center gap-3 shrink-0">
          {walletAddr ? (
            <div ref={walletMenuRef} className="relative">
              <button
                onClick={() => setWalletMenuOpen((o) => !o)}
                className="flex items-center gap-2 bg-white text-black font-mono text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 border-2 border-black rounded-full shadow-brutal-sm btn-brutal"
                aria-haspopup="menu"
                aria-expanded={walletMenuOpen}
              >
                <span className="w-2 h-2 rounded-full bg-[#D4FF00] border border-black animate-pulse-dot" />
                <span>
                  {walletAddr.slice(0, 6)}...{walletAddr.slice(-4)}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-3.5 h-3.5 transition-transform ${walletMenuOpen ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {walletMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-48 bg-white border-2 border-black rounded-2xl shadow-brutal p-2 z-[100]"
                >
                  <button
                    role="menuitem"
                    onClick={disconnectWallet}
                    className="w-full text-left px-3 py-2.5 font-display text-sm tracking-tight bg-black text-[#D4FF00] border-2 border-black rounded-xl hover:bg-[#1a1a1a] transition-colors shadow-brutal-sm btn-brutal"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={connecting}
              className="bg-[#D4FF00] text-black font-display text-sm tracking-tight px-4 sm:px-5 py-2 border-2 border-black rounded-full shadow-brutal-sm btn-brutal disabled:opacity-60"
            >
              {connecting ? "CONNECTING..." : "CONNECT WALLET"}
            </button>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            className="lg:hidden w-10 h-10 flex items-center justify-center bg-white border-2 border-black rounded-full shadow-brutal-sm btn-brutal"
          >
            <span className="flex flex-col gap-1">
              <span
                className={`block w-4 h-0.5 bg-black transition-transform ${
                  mobileOpen ? "rotate-45 translate-y-1.5" : ""
                }`}
              />
              <span
                className={`block w-4 h-0.5 bg-black transition-opacity ${
                  mobileOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block w-4 h-0.5 bg-black transition-transform ${
                  mobileOpen ? "-rotate-45 -translate-y-1.5" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="lg:hidden mx-auto max-w-7xl mt-3 bg-white border-2 border-black rounded-2xl shadow-brutal p-2 space-y-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-3 font-display text-base tracking-tight border-2 border-black rounded-full text-center ${
                isActive(link.href) ? "bg-[#D4FF00] text-black" : "bg-white text-black"
              }`}
            >
              {link.label.toUpperCase()}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

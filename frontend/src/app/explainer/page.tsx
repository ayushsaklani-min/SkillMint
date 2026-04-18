"use client";

import Link from "next/link";

export default function ExplainerPage() {
  return (
    <main className="fixed inset-0 bg-[#1A3CFF] text-white">
      {/* Close/back button — top right */}
      <Link
        href="/"
        aria-label="Close"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 w-11 h-11 flex items-center justify-center bg-black text-white border-2 border-black rounded-full shadow-brutal-sm btn-brutal"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>

      {/* Full-screen explainer iframe */}
      <iframe
        src="/explainer/index.html"
        title="SkillMint Explainer"
        className="absolute inset-0 w-full h-full border-0"
        allow="fullscreen"
      />
    </main>
  );
}

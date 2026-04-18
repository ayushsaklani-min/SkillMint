import type { Metadata } from "next";
import { Geist, Geist_Mono, Archivo_Black } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SkillMint — Verified AI Skill Execution",
  description:
    "The first AI skill marketplace where every execution is hardware-verified, every payment is automatic, and every result is provable. Built on 0G.",
  icons: {
    icon: "/feviicon.png.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0038FF] text-white">
        {children}
      </body>
    </html>
  );
}

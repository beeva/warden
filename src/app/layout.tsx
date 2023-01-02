import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3522"),
  title: {
    default: "Warden — every contract, adversarially reviewed",
    template: "%s · Warden",
  },
  description:
    "Static analysis for smart contracts that models the exploit classes that actually recur on-chain, runs on every commit, and gates CI on criticals.",
  openGraph: {
    title: "Warden — every contract, adversarially reviewed",
    description: "A security review that runs on every push, not a scramble before launch.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-steel-950 font-sans text-steel-200 antialiased">{children}</body>
    </html>
  );
}

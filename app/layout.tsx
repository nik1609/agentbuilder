import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title: { default: "AgentHub", template: "%s · AgentHub" },
  description: "Visually build AI agents and expose them as live REST APIs. Plug into any product, chatbot, or service.",
  openGraph: {
    title: "AgentHub",
    description: "Build AI agents visually. Deploy as REST APIs instantly.",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full`}>
      <body className="min-h-full bg-[#0a0a12] text-[#e8e6f8] antialiased">{children}</body>
    </html>
  );
}

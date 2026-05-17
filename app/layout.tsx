import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600'] })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', style: ['normal', 'italic'], weight: ['400', '600', '700', '800'] })

export const metadata: Metadata = {
  title: { default: "AgentHub – Visual AI Agent Builder", template: "%s · AgentHub" },
  description: "Build AI agents visually with a drag-and-drop canvas. Connect LLM nodes, tools, loops, and human-in-the-loop steps. Deploy every agent as a live REST API instantly. No code required.",
  keywords: [
    "AI agent builder", "visual AI agents", "LLM pipeline builder", "drag and drop AI",
    "no-code AI", "REST API AI agents", "agentic AI", "human in the loop AI",
    "AI workflow automation", "LLM orchestration", "OpenAI agent builder",
    "Gemini agent builder", "Claude agent builder", "multi-step AI pipeline",
    "AgentHub", "AI agent platform", "AI automation tool",
  ],
  authors: [{ name: "AgentHub" }],
  creator: "AgentHub",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: "AgentHub – Visual AI Agent Builder",
    description: "Build AI agents visually. Connect AI Step nodes, tools, conditions, loops, and human review steps. Deploy as REST APIs instantly.",
    type: "website",
    siteName: "AgentHub",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentHub – Visual AI Agent Builder",
    description: "Build AI agents visually. Deploy as REST APIs instantly. No code required.",
    creator: "@agenthub",
  },
  icons: { icon: "/icon.svg" },
  category: "technology",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Plain script tag — executes before hydration, prevents theme flash.
            Defaults to light; only goes dark if user explicitly chose dark. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('agenthub-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){}})()` }} />
      </head>
      <body className={`${playfair.variable} min-h-full antialiased`}>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentBase — AI Agent 研究引擎",
  description:
    "基于 500+ 顶会论文和前沿技术博客的深度 RAG 问答系统。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ask the Issue",
  description: "AgentBase 对话页。",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

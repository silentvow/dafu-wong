import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "大腹翁",
  description: "比誰生最多小孩的大富翁遊戲",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="bg-amber-50 min-h-screen">{children}</body>
    </html>
  );
}

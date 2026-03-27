import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "大腹翁",
  description: "比誰生最多小孩的大富翁遊戲",
  openGraph: {
    title: "大腹翁",
    description: "最會生孩子的才是贏家！多人網頁互動遊戲",
    images: [{ url: "/ogimage.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "大腹翁",
    description: "最會生孩子的才是贏家！多人網頁互動遊戲",
    images: ["/ogimage.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

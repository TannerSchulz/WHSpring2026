import type { Metadata } from "next";
import "./globals.css";

const title = "MortgageAI | Better Borrower Conversations";
const description = "Branded affordability tools that help mortgage teams turn borrower curiosity into qualified conversations.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    title,
    description,
    images: [{ url: "/og.png", width: 1728, height: 910, alt: "MortgageAI — Better borrower conversations" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

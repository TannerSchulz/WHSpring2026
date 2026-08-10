import type { Metadata } from "next";
import "./globals.css";

const title = "MortgageAI | Better Borrower Conversations";
const description = "Branded affordability tools that help mortgage teams turn borrower curiosity into qualified conversations.";

export const metadata: Metadata = {
  title,
  description,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

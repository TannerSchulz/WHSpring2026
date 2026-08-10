import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MortgageAI | Loan Officer Workspace",
  description: "A focused workspace for reviewing borrower affordability activity and managing shared links.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

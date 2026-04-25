import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trainer Portal",
  description: "Macros, food journal, and body fat tracking for personal training clients.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

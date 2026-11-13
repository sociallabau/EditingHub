import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Editing Hub",
  description: "Social Lab internal editing hub",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

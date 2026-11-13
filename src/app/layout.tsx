import type { Metadata } from "next";
import "@astryxdesign/theme-chocolate/fonts.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Editing Hub",
  description: "Social Lab internal editing hub",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

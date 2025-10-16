// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Excel Delivery",
  description: "Πλατφόρμα διαχείρισης αρχείων Excel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

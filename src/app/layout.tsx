import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Ruria Pantau", description: "Dashboard e-commerce multi-klien Ruria" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

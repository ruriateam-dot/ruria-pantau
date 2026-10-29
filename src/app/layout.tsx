import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Ruria Report", description: "Dashboard e-commerce multi-klien Ruria" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Terapkan pilihan tema sebelum halaman tampil (hindari kedip)
/* Tema default terang untuk semua. Gelap/otomatis hanya bisa dipilih superadmin (tersimpan di perangkatnya). */
const themeScript = `try{var t=localStorage.getItem("rp-theme"),d=document.documentElement;d.dataset.theme=t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}

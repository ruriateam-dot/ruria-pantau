"use client";
import { useEffect, useRef } from "react";
import markup from "@/data/aff/markup.json";

/* Ruang kerja affiliate (modul lama), dimuat ulang setiap kali tab dibuka */
export default function Affiliate({ client, user }: { client: string; user: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.innerHTML = markup as string;
    const add = (src: string) => new Promise<void>((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = () => ok(); s.onerror = () => no(); s.dataset.aff = "1"; document.body.appendChild(s); });
    let off = false;
    (async () => {
      if (!(window as unknown as { __affInit?: unknown }).__affInit) await add("/aff/shim.js?v=1");
      if (off) return;
      (window as unknown as { __affInit: (c: string, u: string) => void }).__affInit(client, user);
      await add("/aff/aff.js?v=1&t=" + Date.now());
    })().catch(() => { el.insertAdjacentHTML("afterbegin", "<p>Ruang kerja affiliate gagal dimuat. Muat ulang halaman.</p>"); });
    return () => { off = true; (window as unknown as { __affGen: number }).__affGen++; document.querySelectorAll("script[data-aff]").forEach((s) => { if (s.getAttribute("src")?.includes("aff.js")) s.remove(); }); };
  }, [client, user]);
  return <>
    <link rel="stylesheet" href="/aff/aff.css?v=1" />
    <div id="aff-root" ref={ref} />
  </>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import markup from "@/data/aff/markup.json";

type Brand = { nama: string; catatan?: string; ganti?: [string, string][]; hpp?: Record<string, number>; hpp_default?: number };
type Win = { __affInit?: (c: string, u: string) => void; __affGen: number; AFF_SRC: (f: string) => string };
const w = () => window as unknown as Win;

/* Ruang kerja affiliate. Modul yang sama dipakai semua klien; nama brand & teks khusus disesuaikan per klien. */
export default function Affiliate({ client, user, nama }: { client: string; user: string; nama: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    const el = ref.current!;
    let off = false; const urls: string[] = [];
    const add = (src: string) => new Promise<void>((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = () => ok(); s.onerror = () => no(); s.dataset.aff = "1"; document.body.appendChild(s); });
    (async () => {
      if (!w().__affInit) await add("/aff/shim.js?v=2");
      if (off) return;
      w().__affInit!(client, user);
      const b: Brand = await fetch(w().AFF_SRC("brand.json")).then((r) => (r.ok ? r.json() : null)).catch(() => null) ?? { nama: client === "jf" ? "Just Fluff" : nama };
      const fix = (t: string) => { let x = t; if (b.nama !== "Just Fluff") { for (const [a, z] of b.ganti ?? []) x = x.split(a).join(z); x = x.split("JustFluff").join(b.nama).split("Just Fluff").join(b.nama); } return x; };
      if (off) return;
      el.innerHTML = fix(markup as string);
      setNote(b.catatan ?? "");
      const ww = window as unknown as { AFF_HPP?: Record<string, number>; AFF_HPP_DEFAULT?: number };
      ww.AFF_HPP = b.hpp ? Object.fromEntries(Object.entries(b.hpp).map(([k, v]) => [k.toUpperCase().trim(), v])) : undefined; ww.AFF_HPP_DEFAULT = b.hpp_default;
      const js = fix(await fetch("/aff/aff.js?v=10").then((r) => r.text()));
      const u = URL.createObjectURL(new Blob([js], { type: "text/javascript" })); urls.push(u);
      if (!off) await add(u);
    })().catch(() => { el.insertAdjacentHTML("afterbegin", "<p>Ruang kerja affiliate gagal dimuat. Muat ulang halaman.</p>"); });
    return () => { off = true; w().__affGen++; document.querySelectorAll("script[data-aff]").forEach((s) => { if (s.getAttribute("src")?.startsWith("blob:")) s.remove(); }); urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [client, user, nama]);
  return <>
    <link rel="stylesheet" href="/aff/aff.css?v=1" />
    {note && <p className="note">{note}</p>}
    <div id="aff-root" ref={ref} />
  </>;
}

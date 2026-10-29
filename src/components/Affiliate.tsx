"use client";
import { useEffect, useRef, useState } from "react";
import markup from "@/data/aff/markup.json";

type Brand = { nama: string; catatan?: string; ganti?: [string, string][]; hpp?: Record<string, number>; hpp_default?: number; roi_min?: number };
type Win = { __affInit?: (c: string, u: string, t?: string) => void; __affGen: number; AFF_SRC: (f: string) => string };
const w = () => window as unknown as Win;

/* Ruang kerja affiliate. Modul yang sama dipakai semua klien; nama brand & teks khusus disesuaikan per klien. */
export default function Affiliate({ client, user, nama, readOnly = false, token }: { client: string; user: string; nama: string; readOnly?: boolean; token?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    const el = ref.current!;
    let off = false; const urls: string[] = [];
    const add = (src: string) => new Promise<void>((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = () => ok(); s.onerror = () => no(); s.dataset.aff = "1"; document.body.appendChild(s); });
    (async () => {
      if (!w().__affInit) await add("/aff/shim.js?v=3");
      if (off) return;
      w().__affInit!(client, user, token);
      const b: Brand = await fetch(w().AFF_SRC("brand.json")).then((r) => (r.ok ? r.json() : null)).catch(() => null) ?? { nama: client === "jf" ? "Just Fluff" : nama };
      const fix = (t: string) => { let x = t; if (b.nama !== "Just Fluff") { for (const [a, z] of b.ganti ?? []) x = x.split(a).join(z); x = x.split("JustFluff").join(b.nama).split("Just Fluff").join(b.nama); } return x; };
      if (off) return;
      el.innerHTML = fix(markup as string);
      setNote(b.catatan ?? "");
      const ww = window as unknown as { AFF_HPP?: Record<string, number>; AFF_HPP_DEFAULT?: number; AFF_ROI_MIN?: number };
      ww.AFF_HPP = b.hpp ? Object.fromEntries(Object.entries(b.hpp).map(([k, v]) => [k.toUpperCase().trim(), v])) : undefined; ww.AFF_HPP_DEFAULT = b.hpp_default; ww.AFF_ROI_MIN = b.roi_min ?? (client === "jf" ? 10 : 5);
      const js = fix(await fetch("/aff/aff.js?v=18").then((r) => r.text()));
      const u = URL.createObjectURL(new Blob([js], { type: "text/javascript" })); urls.push(u);
      if (!off) await add(u);
      if (readOnly) {
        // Tampilan klien: hanya lihat. Matikan semua isian di laci kreator & form, sembunyikan tab Input Sampel
        const lock = () => { el.querySelectorAll<HTMLElement>(".drawer input, .drawer textarea, .drawer select, .drawer button.btn, #fu-save, #fu-sampel, #fu-today").forEach((x) => { (x as HTMLInputElement).disabled = true; }); };
        const mo = new MutationObserver(lock); mo.observe(el, { childList: true, subtree: true }); lock(); urls.push("mo:"); (el as unknown as { _mo?: MutationObserver })._mo = mo;
      }
    })().catch(() => { el.insertAdjacentHTML("afterbegin", "<p>Ruang kerja affiliate gagal dimuat. Muat ulang halaman.</p>"); });
    return () => { off = true; (el as unknown as { _mo?: MutationObserver })._mo?.disconnect(); w().__affGen++; document.querySelectorAll("script[data-aff]").forEach((s) => { if (s.getAttribute("src")?.startsWith("blob:")) s.remove(); }); urls.forEach((u) => { if (u.startsWith("blob:")) URL.revokeObjectURL(u); }); };
  }, [client, user, nama, readOnly, token]);
  return <>
    <link rel="stylesheet" href="/aff/aff.css?v=13" />
    {note && <p className="note">{note}</p>}
    {readOnly && <p className="note">Tampilan baca saja: data affiliate dan database kreator bisa dilihat, perubahan hanya dilakukan oleh tim Ruria.</p>}
    <div id="aff-root" ref={ref} className={readOnly ? "ro" : undefined} />
  </>;
}
